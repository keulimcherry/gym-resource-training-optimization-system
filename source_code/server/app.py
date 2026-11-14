import os
import re
import secrets
import string
import time
from collections import defaultdict
from datetime import timedelta
from pathlib import Path

import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))

import pymysql
from flask import Flask, abort, jsonify, request, send_from_directory, session
from werkzeug.security import check_password_hash, generate_password_hash

import db as dbm
from db import Schema, execute, q, query, query_one, to_db_value, to_json_value
from policy import AUDITED, Forbidden, Invalid, authorize
from scope import STAFF, TABLES as TABLE_NAMES, Scope, snapshot

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent / "design"


def load_env(path):
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

load_env(ROOT / ".env")

app = Flask(__name__, static_folder=None)
app.config.update(
    DB_HOST=os.environ.get("DB_HOST", "127.0.0.1"),
    DB_PORT=os.environ.get("DB_PORT", "3306"),
    DB_NAME=os.environ.get("DB_NAME", "moksha_fitness"),
    DB_USER=os.environ.get("DB_USER", "moksha_app"),
    DB_PASSWORD=os.environ.get("DB_PASSWORD", ""),
    SECRET_KEY=os.environ.get("SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Strict",
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
    SESSION_COOKIE_NAME="moksha_session",
    PERMANENT_SESSION_LIFETIME=timedelta(hours=int(os.environ.get("SESSION_HOURS", "12"))),
    MAX_CONTENT_LENGTH=512 * 1024,
)
app.teardown_appcontext(dbm.close_db)

SCHEMA = None


def schema():
    global SCHEMA
    if SCHEMA is None:
        conn = dbm.connect()
        try:
            SCHEMA = Schema(conn, app.config["DB_NAME"], names=TABLE_NAMES)
        finally:
            conn.close()
    return SCHEMA

CSP = ("default-src 'self'; "
       "script-src 'self'; "
       "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
       "font-src 'self' https://fonts.gstatic.com; "
       "img-src 'self' data: https://images.unsplash.com; "
       "frame-src https://www.google.com https://maps.google.com; "
       "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'")


@app.after_request
def headers(resp):
    resp.headers["Content-Security-Policy"] = CSP
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if request.path.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store"
    else:
        resp.headers["Cache-Control"] = "no-cache"
    if app.config["SESSION_COOKIE_SECURE"]:
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return resp


def fail(status, message):
    return jsonify(ok=False, error=message), status

TRUST_PROXY = os.environ.get("TRUST_PROXY", "0") == "1"


def client_ip():
    if TRUST_PROXY and request.headers.get("X-Forwarded-For"):
        return request.headers["X-Forwarded-For"].split(",")[0].strip()[:45]
    return (request.remote_addr or "")[:45]


def current_user():
    uid = session.get("uid")
    if not uid:
        return None
    u = query_one("SELECT user_id, username, display_name, role, member_id, trainer_id, is_active, must_change_password "
                  "FROM `User` WHERE user_id = %s", (uid,))
    if not u or not u["is_active"] or session.get("ver") != password_version(uid):
        session.clear()
        return None
    return u


def password_version(uid):
    row = query_one("SELECT password_hash FROM `User` WHERE user_id = %s", (uid,))
    return (row or {}).get("password_hash", "")[-12:]


def require_csrf():
    token = request.headers.get("X-CSRF-Token", "")
    if not token or not secrets.compare_digest(token, session.get("csrf", "")):
        resp = jsonify(ok=False, error="Your session expired. Reload the page and log in again.")
        resp.status_code = 403
        abort(resp)


def me_json(u):
    return {"user_id": u["user_id"], "username": u["username"], "display_name": u["display_name"], "role": u["role"],
            "member_id": u["member_id"], "trainer_id": u["trainer_id"], "must_change_password": bool(u["must_change_password"])}

FAILS = defaultdict(list)
MAX_FAILS, MAX_FAILS_PER_IP, WINDOW = 5, 20, 15 * 60


def locked(key, limit=MAX_FAILS):
    now = time.time()
    FAILS[key] = [t for t in FAILS[key] if now - t < WINDOW]
    return len(FAILS[key]) >= limit

AREA = {"member": ("member",), "trainer": ("trainer",), "staff": ("owner", "accountant", "front_desk")}
DUMMY_HASH = generate_password_hash("not-a-real-password")


@app.post("/api/login")
def login():
    data = request.get_json(silent=True) or {}
    username = str(data.get("username", "")).strip().lower()[:60]
    password = str(data.get("password", ""))[:128]
    area = data.get("area")
    key = f"{client_ip()}|{username}"
    if locked(key) or locked(client_ip() + "|*", MAX_FAILS_PER_IP):
        return fail(429, "Too many failed attempts. Try again in 15 minutes.")
    u = query_one("SELECT user_id, password_hash, role, is_active FROM `User` WHERE username = %s", (username,))
    ok = check_password_hash(u["password_hash"] if u else DUMMY_HASH, password) and u and u["is_active"]
    if not ok:
        FAILS[key].append(time.time())
        FAILS[client_ip() + "|*"].append(time.time())
        return fail(401, "Incorrect username or password.")
    if area in AREA and u["role"] not in AREA[area]:
        tab = "staff" if u["role"] in STAFF else u["role"]
        return fail(400, f'That is a {tab} account. Choose "{tab.capitalize()}" above.')
    FAILS.pop(key, None)
    session.clear()
    session.permanent = True
    session["uid"] = u["user_id"]
    session["ver"] = u["password_hash"][-12:]
    session["csrf"] = secrets.token_urlsafe(32)
    execute("UPDATE `User` SET last_login = NOW() WHERE user_id = %s", (u["user_id"],))
    dbm.get_db().commit()
    user = current_user()
    return jsonify(ok=True, user=me_json(user))


@app.post("/api/logout")
def logout():
    session.clear()
    return jsonify(ok=True)


def strong_enough(pw):
    return len(pw) >= 10 and re.search(r"[A-Za-z]", pw) and re.search(r"\d", pw)


@app.post("/api/password")
def change_password():
    u = current_user()
    if not u:
        return fail(401, "Please log in.")
    require_csrf()
    data = request.get_json(silent=True) or {}
    cur, new = str(data.get("current", "")), str(data.get("new", ""))
    row = query_one("SELECT password_hash FROM `User` WHERE user_id = %s", (u["user_id"],))
    if not check_password_hash(row["password_hash"], cur):
        return fail(400, "Your current password is wrong.")
    if not strong_enough(new):
        return fail(400, "Use at least 10 characters, with letters and numbers.")
    if new == cur:
        return fail(400, "Choose a password you haven't used here before.")
    h = generate_password_hash(new)
    execute("UPDATE `User` SET password_hash = %s, must_change_password = 0 WHERE user_id = %s", (h, u["user_id"]))
    write_audit(u["user_id"], "update", "User", u["user_id"], None, {"password": "changed"}, "Changed own password")
    dbm.get_db().commit()
    session["ver"] = h[-12:]
    return jsonify(ok=True)


@app.get("/api/session")
def get_session():
    u = current_user()
    if not u:
        return fail(401, "Not logged in.")
    data = snapshot(schema(), Scope(u))
    dbm.get_db().commit()
    return jsonify(ok=True, user=me_json(u), csrf=session["csrf"], tables=data)

ACTOR_COLS = {"recorded_by", "voided_by", "entered_by", "created_by", "requested_by", "decided_by", "posted_by"}
MAX_OPS = 400


def write_audit(uid, action, table, rid, old, new, reason):
    import json
    execute("INSERT INTO AuditLog (user_id, action, table_name, record_id, old_values, new_values, reason, ip_address) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            (uid, action, table, rid, json.dumps(old) if old is not None else None, json.dumps(new) if new is not None else None,
             (reason or None) and str(reason)[:255], client_ip()))


def temp_password():
    alphabet = string.ascii_letters + string.digits
    while True:
        p = "".join(secrets.choice(alphabet) for _ in range(12))
        if re.search(r"\d", p) and re.search(r"[A-Za-z]", p):
            return p

FRIENDLY_CHECK = {
    "chk_payment_one_purpose": "A payment can be linked to a membership or a PT enrollment, not both.",
    "chk_payment_void": "A voided payment needs a reason.",
    "chk_user_links": "Member accounts must link to a member, trainer accounts to a trainer, and staff accounts to neither.",
    "chk_membership_dates": "End date can't be before the start date.",
    "chk_pt_dates": "End date can't be before the start date.",
    "chk_series_dates": "The schedule's end date can't be before its start date.",
    "chk_change_differs": "Pick a different trainer from the current one.",
    "chk_member_entry_no_trainer": "A member's own journal entry can't name a trainer.",
    "chk_move_has_time": "Pick the new date and time.",
    "chk_checkout_after": "Check-out can't be before check-in.",
}
FRIENDLY_DUP = {
    "uq_progress": "There's already an entry for this member, date and source. Edit that one instead.",
    "uq_session": "This client already has a session at that date and time.",
    "uq_occurrence": "That class already has an occurrence on this date.",
    "uq_attendance": "This member is already marked for that class.",
    "uq_one_current_plan": "Only one plan version can be current.",
    "uq_plan_version": "That plan version number already exists.",
    "uq_one_pending_request": "There's already a pending request for this session.",
    "uq_one_pending_change": "There's already a pending trainer-change request for this training.",
    "username": "That username is taken.",
    "email": "A member with this email already exists.",
    "plan_type": "A plan with that name already exists.",
}


def friendly(e):
    code, msg = (e.args + ("", ""))[:2]
    if code == 1644:
        return msg
    if code == 3819:
        for k, v in FRIENDLY_CHECK.items():
            if k in msg:
                return v
        return "That value isn't allowed."
    if code == 1062:
        for k, v in FRIENDLY_DUP.items():
            if k in msg:
                return v
        return "That would create a duplicate record."
    if code in (1451,):
        return "Other records depend on this one, so it can't be removed."
    if code in (1452,):
        return "A linked record doesn't exist (it may have been removed)."
    if code in (1048, 1364):
        col = re.search(r"'(\w+)'", msg)
        return f"{col.group(1).replace('_', ' ').capitalize() if col else 'A required field'} is required."
    if code in (1265, 1292, 1366, 1406):
        col = re.search(r"column '(\w+)'", msg)
        return f"{col.group(1).replace('_', ' ').capitalize() if col else 'A value'} isn't valid."
    return None


@app.post("/api/tx")
def tx():
    u = current_user()
    if not u:
        return fail(401, "Your session ended. Please log in again.")
    require_csrf()
    if u["must_change_password"]:
        return fail(403, "Set a new password first.")
    payload = request.get_json(silent=True) or {}
    ops = payload.get("ops")
    if not isinstance(ops, list) or not ops or len(ops) > MAX_OPS:
        return fail(400, "Nothing to save.")
    S = schema()
    scope = Scope(u)
    conn = dbm.get_db()
    idmap, notices = {}, []

    def real_id(table, v):
        if isinstance(v, int) and v < 0:
            if v not in idmap.get(table, {}):
                raise Invalid("A change refers to a record that wasn't saved.")
            return idmap[table][v]
        return v

    try:
        for op in ops:
            kind = op.get("op")
            table = S.name(op.get("table", ""))
            if kind not in ("insert", "update", "delete") or not table or table in ("AuditLog",):
                raise Forbidden("That change isn't allowed.")
            meta = S.tables[table]
            pk = meta["pk"]
            raw = op.get("row") or {}
            if not isinstance(raw, dict):
                raise Invalid("Bad request.")
            row = {}
            for k, v in raw.items():
                if k == pk or k in ACTOR_COLS:
                    continue
                if k not in meta["columns"] or k in meta["generated"] or k == "password_hash" or k == "must_change_password":
                    raise Invalid(f"Unknown field {k}.")
                if k in meta["fks"]:
                    v = real_id(meta["fks"][k], v)
                row[k] = v

            if kind == "insert":
                authorize(scope, "insert", table, row, None)
                extra = {}
                if table == "User":
                    pw = temp_password()
                    extra = {"password_hash": generate_password_hash(pw), "must_change_password": 1}
                    notices.append({"type": "temp_password", "username": row.get("username"), "password": pw})
                cols = list(row) + list(extra)
                vals = [to_db_value(S, table, c, row[c]) for c in row] + list(extra.values())
                rid, _ = execute(f"INSERT INTO {q(table)} ({', '.join(q(c) for c in cols)}) VALUES ({', '.join(['%s'] * len(cols))})", vals)
                temp = raw.get(pk)
                if isinstance(temp, int) and temp < 0:
                    idmap.setdefault(table, {})[temp] = rid
                if table in AUDITED:
                    new = {c: v for c, v in row.items() if not isinstance(v, (dict, list))}
                    write_audit(u["user_id"], "create", table, rid, None, new, op.get("reason"))
                if table in ("PersonalTrainingEnrollment", "Session"):
                    scope._cache.clear()
            else:
                rid = real_id(table, op.get("id"))
                old = query_one(f"SELECT * FROM {q(table)} WHERE {q(pk)} = %s FOR UPDATE", (rid,))
                if not old:
                    raise Invalid("That record no longer exists. Reload the page.")
                old_js = {c: to_json_value(S, table, c, old[c]) for c in meta["columns"] if c in old}
                if kind == "delete":
                    authorize(scope, "delete", table, {}, old_js)
                    if table == "Session":
                        execute("DELETE FROM SessionChangeRequest WHERE session_id = %s AND status <> 'Pending'", (rid,))
                    execute(f"DELETE FROM {q(table)} WHERE {q(pk)} = %s", (rid,))
                    continue
                row = {k: v for k, v in row.items() if to_db_value(S, table, k, v) != old.get(k) and v != old_js.get(k)}
                if table == "Payment" and row and u["role"] in ("owner", "accountant") and not (op.get("reason") or "").strip() and row.get("status") != "void":
                    raise Invalid("Give a reason for changing this payment.")
                if not row:
                    continue
                authorize(scope, "update", table, row, old_js)
                sets = ", ".join(f"{q(c)} = %s" for c in row)
                execute(f"UPDATE {q(table)} SET {sets} WHERE {q(pk)} = %s", [to_db_value(S, table, c, row[c]) for c in row] + [rid])
                if table in AUDITED:
                    action = "void" if table == "Payment" and row.get("status") == "void" else "update"
                    changed = {c: row[c] for c in row}
                    write_audit(u["user_id"], action, table, rid, {c: old_js.get(c) for c in changed}, changed,
                                op.get("reason") or row.get("void_reason"))
        conn.commit()
    except (Forbidden, Invalid) as e:
        conn.rollback()
        return fail(403 if isinstance(e, Forbidden) else 400, str(e))
    except pymysql.MySQLError as e:
        conn.rollback()
        msg = friendly(e)
        app.logger.warning("tx refused by MySQL: %s", e)
        return fail(400, msg or "The database refused this change.")
    except (ValueError, TypeError) as e:
        conn.rollback()
        return fail(400, "Some values aren't valid.")

    data = snapshot(S, Scope(u))
    conn.commit()
    return jsonify(ok=True, idmap={t: {str(k): v for k, v in m.items()} for t, m in idmap.items()}, notices=notices, tables=data)


@app.post("/api/users/<int:uid>/reset-password")
def reset_password(uid):
    u = current_user()
    if not u or u["role"] != "owner":
        return fail(403, "Only the owner can reset passwords.")
    require_csrf()
    target = query_one("SELECT user_id, username FROM `User` WHERE user_id = %s", (uid,))
    if not target or uid == u["user_id"]:
        return fail(400, "Use 'Change password' for your own account.")
    pw = temp_password()
    execute("UPDATE `User` SET password_hash = %s, must_change_password = 1 WHERE user_id = %s", (generate_password_hash(pw), uid))
    write_audit(u["user_id"], "update", "User", uid, None, {"password": "reset"}, "Password reset by owner")
    dbm.get_db().commit()
    return jsonify(ok=True, username=target["username"], password=pw)


@app.get("/api/public/live")
def live():
    row = query_one("""SELECT
        (SELECT COUNT(*) FROM CheckIn WHERE check_out_time IS NULL AND check_in_time >= NOW() - INTERVAL 3 HOUR) AS active,
        (SELECT COALESCE(SUM(quantity), 0) FROM Equipment WHERE next_service_due IS NULL OR next_service_due >= CURDATE()) AS equip,
        (SELECT COUNT(*) FROM Session WHERE session_date = CURDATE() AND status IN ('Scheduled','Completed')
            AND time_slot <= CURTIME() AND time_slot > CURTIME() - INTERVAL 60 MINUTE) AS pt""")
    posts = query("SELECT title, body, tag, posted_date, image_path FROM Announcement WHERE is_published = 1 ORDER BY posted_date DESC, announcement_id DESC LIMIT 3")
    dbm.get_db().commit()
    return jsonify(ok=True, active=int(row["active"]), equip=int(row["equip"]), pt=int(row["pt"]),
                   posts=[{"title": p["title"], "body": p["body"], "tag": p["tag"], "date": p["posted_date"].isoformat()} for p in posts])

LEAD_LIMIT = defaultdict(list)


@app.post("/api/public/lead")
def lead():
    ip = client_ip()
    now = time.time()
    LEAD_LIMIT[ip] = [t for t in LEAD_LIMIT[ip] if now - t < 3600]
    if len(LEAD_LIMIT[ip]) >= 5:
        return fail(429, "Thanks! We already have your details and will call you soon.")
    d = request.get_json(silent=True) or {}
    name, contact = str(d.get("name", "")).strip()[:100], str(d.get("contact", "")).strip()[:120]
    interest = str(d.get("interest", "")).strip()[:60] or "Gym membership"
    message = str(d.get("message", "")).strip()[:1000] or None
    if not name or not contact:
        return fail(400, "Add your name and a phone number or email.")
    if str(d.get("website", "")):
        return jsonify(ok=True)
    execute("INSERT INTO `Lead` (name, contact, interest, message) VALUES (%s, %s, %s, %s)", (name, contact, interest, message))
    dbm.get_db().commit()
    LEAD_LIMIT[ip].append(now)
    return jsonify(ok=True)


@app.get("/")
def index():
    return send_from_directory(SITE, "home.html")


@app.get("/<path:path>")
def site(path):
    if path.startswith("api/"):
        abort(404)
    if not (SITE / path).resolve().is_relative_to(SITE.resolve()):
        abort(404)
    return send_from_directory(SITE, path)


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return fail(404, "Not found.")
    return "Not found", 404


@app.errorhandler(500)
def server_error(_e):
    return fail(500, "Something went wrong on the server.")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8800"))
    print(f"Moksha Fitness is running at http://localhost:{port}/")
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=port, debug=False)
