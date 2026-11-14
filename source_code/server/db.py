import datetime as dt
import decimal
import json

import pymysql
import pymysql.cursors
from flask import current_app, g


def connect():
    cfg = current_app.config
    return pymysql.connect(
        host=cfg["DB_HOST"], port=int(cfg["DB_PORT"]), user=cfg["DB_USER"], password=cfg["DB_PASSWORD"],
        database=cfg["DB_NAME"], charset="utf8mb4", autocommit=False,
        cursorclass=pymysql.cursors.DictCursor, connect_timeout=5,
        init_command="SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,ONLY_FULL_GROUP_BY'",
    )


def get_db():
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(_exc=None):
    conn = g.pop("db", None)
    if conn is not None:
        try:
            conn.rollback()
        finally:
            conn.close()


def query(sql, args=None):
    with get_db().cursor() as cur:
        cur.execute(sql, args or ())
        return cur.fetchall()


def query_one(sql, args=None):
    rows = query(sql, args)
    return rows[0] if rows else None


def execute(sql, args=None):
    with get_db().cursor() as cur:
        cur.execute(sql, args or ())
        return cur.lastrowid, cur.rowcount


class Schema:

    def __init__(self, conn, db_name, names=()):
        with conn.cursor() as cur:
            cur.execute("""SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_KEY, EXTRA, IS_NULLABLE
                             FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = %s ORDER BY TABLE_NAME, ORDINAL_POSITION""", (db_name,))
            cols = cur.fetchall()
            cur.execute("""SELECT k.TABLE_NAME, k.COLUMN_NAME, k.REFERENCED_TABLE_NAME
                             FROM information_schema.KEY_COLUMN_USAGE k
                             JOIN information_schema.TABLES t ON t.TABLE_SCHEMA = k.TABLE_SCHEMA AND t.TABLE_NAME = k.TABLE_NAME
                            WHERE k.TABLE_SCHEMA = %s AND k.REFERENCED_TABLE_NAME IS NOT NULL AND t.TABLE_TYPE = 'BASE TABLE'""", (db_name,))
            fks = cur.fetchall()
            cur.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_TYPE = 'BASE TABLE'", (db_name,))
            base = {r["TABLE_NAME"] for r in cur.fetchall()}
        conn.commit()
        proper = {n.lower(): n for n in names}
        fix = lambda n: proper.get(n.lower(), n)
        self.tables = {}
        for c in cols:
            if c["TABLE_NAME"] not in base:
                continue
            t = self.tables.setdefault(fix(c["TABLE_NAME"]), {"columns": {}, "pk": None, "generated": set(), "fks": {}})
            extra = (c["EXTRA"] or "").upper()
            gen = "STORED GENERATED" in extra or "VIRTUAL GENERATED" in extra
            t["columns"][c["COLUMN_NAME"]] = {"type": c["DATA_TYPE"].lower(), "ctype": c["COLUMN_TYPE"].lower(), "nullable": c["IS_NULLABLE"] == "YES"}
            if gen:
                t["generated"].add(c["COLUMN_NAME"])
            if c["COLUMN_KEY"] == "PRI":
                t["pk"] = c["COLUMN_NAME"]
        for f in fks:
            if fix(f["TABLE_NAME"]) in self.tables:
                self.tables[fix(f["TABLE_NAME"])]["fks"][f["COLUMN_NAME"]] = fix(f["REFERENCED_TABLE_NAME"])
        self.canonical = {name.lower(): name for name in self.tables}

    def name(self, table):
        return self.canonical.get(str(table).lower())

    def pk(self, table):
        return self.tables[table]["pk"]

    def writable(self, table):
        t = self.tables[table]
        return [c for c in t["columns"] if c not in t["generated"] and c != t["pk"]]

    def is_bool(self, table, col):
        return self.tables[table]["columns"][col]["ctype"] == "tinyint(1)"


def q(name):
    return "`" + name.replace("`", "") + "`"


def to_json_value(schema, table, col, v):
    if v is None:
        return None
    meta = schema.tables[table]["columns"][col]
    t = meta["type"]
    if t == "date":
        return v.isoformat()
    if t == "time":
        secs = int(v.total_seconds()) if isinstance(v, dt.timedelta) else v.hour * 3600 + v.minute * 60
        return f"{secs // 3600:02d}:{secs % 3600 // 60:02d}"
    if t in ("datetime", "timestamp"):
        return v.strftime("%Y-%m-%d %H:%M")
    if t == "decimal":
        f = float(v)
        return int(f) if f.is_integer() else f
    if meta["ctype"] == "tinyint(1)":
        return bool(v)
    if t == "json":
        return json.loads(v) if isinstance(v, (str, bytes)) else v
    if isinstance(v, decimal.Decimal):
        return float(v)
    return v


def to_db_value(schema, table, col, v):
    if v is None or v == "":
        meta = schema.tables[table]["columns"][col]
        if v == "" and meta["type"] in ("varchar", "text", "char", "enum") and not meta["nullable"]:
            return ""
        return None
    meta = schema.tables[table]["columns"][col]
    t = meta["type"]
    if meta["ctype"] == "tinyint(1)":
        return 1 if v else 0
    if t == "json":
        return json.dumps(v)
    if t in ("datetime", "timestamp") and isinstance(v, str) and len(v) == 16:
        return v + ":00"
    if isinstance(v, (dict, list)):
        raise ValueError(f"{table}.{col}: unexpected value")
    return v
