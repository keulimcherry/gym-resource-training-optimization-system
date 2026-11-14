import getpass
import glob
import os
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PROJECT = ROOT.parent
ENV = ROOT / ".env"

DB_DIR = next((d for d in (PROJECT / "database", PROJECT.parent / "database") if d.is_dir()), PROJECT / "database")
SQL_FILES = ([DB_DIR / "moksha_fitness_full.sql"] if (DB_DIR / "moksha_fitness_full.sql").exists()
             else [DB_DIR / "schema.sql", DB_DIR / "sample_data.sql"])
SQL_USER = next((f for f in (DB_DIR / "03_app_user.sql", DB_DIR / "app_user.sql") if f.exists()), DB_DIR / "03_app_user.sql")


def find_mysql():
    found = (sorted(glob.glob(r"C:\wamp64\bin\mysql\mysql*\bin\mysql.exe")) + sorted(glob.glob(r"C:\wamp\bin\mysql\mysql*\bin\mysql.exe"))
             + sorted(glob.glob(r"C:\Program Files\MySQL\MySQL Server *\bin\mysql.exe")))
    if found:
        return found[-1]
    return shutil.which("mysql")


def run(mysql, args, sql_text=None, password=""):
    env = dict(os.environ, MYSQL_PWD=password)
    return subprocess.run([mysql, *args], input=sql_text, capture_output=True, text=True, env=env, encoding="utf-8")


def main():
    mysql = find_mysql()
    if not mysql:
        sys.exit("Couldn't find MySQL. Install WampServer (or MySQL 8), start it, and run this again.")
    host = os.environ.get("DB_HOST", "127.0.0.1")
    port = os.environ.get("DB_PORT", "3306")
    base = ["-h", host, "-P", port, "-u", "root"]
    print(f"Using {mysql} on {host}:{port}")

    pw = ""
    r = run(mysql, base + ["-N", "-e", "SELECT VERSION()"], password=pw)
    if r.returncode != 0:
        if "Access denied" in r.stderr:
            pw = getpass.getpass("MySQL root password: ")
            r = run(mysql, base + ["-N", "-e", "SELECT VERSION()"], password=pw)
        if r.returncode != 0:
            sys.exit("Couldn't connect to MySQL. Is WampServer running (green icon)?\n" + r.stderr.strip())
    version = r.stdout.strip()
    if "mariadb" in version.lower():
        sys.exit(f"That server is MariaDB {version}. This project needs MySQL 8: in WampServer use MySQL (port 3306), not MariaDB.")
    print(f"MySQL {version}")

    r = run(mysql, base + ["-N", "-e", "SHOW DATABASES LIKE 'moksha_fitness'"], password=pw)
    if r.stdout.strip():
        print("\nA moksha_fitness database already exists. Replacing it DELETES everything in it.")
        if input('Type YES to replace it, anything else to keep it: ').strip() != "YES":
            print("Kept the existing database. Only the app account and .env will be refreshed.")
        else:
            load(mysql, base, pw)
    else:
        load(mysql, base, pw)

    app_pw = secrets.token_urlsafe(24)
    sql = SQL_USER.read_text(encoding="utf-8").replace("CHANGE_ME_to_a_long_random_password", app_pw)
    r = run(mysql, base, sql, pw)
    if r.returncode != 0:
        sys.exit("Couldn't create the app account:\n" + r.stderr.strip())
    print("Created the restricted app account 'moksha_app'.")

    ENV.write_text(
        "# Moksha Fitness server settings (keep this file private; it is not shared or committed)\n"
        f"DB_HOST={host}\nDB_PORT={port}\nDB_NAME=moksha_fitness\nDB_USER=moksha_app\nDB_PASSWORD={app_pw}\n"
        f"SECRET_KEY={secrets.token_hex(32)}\nPORT=8800\n"
        "# set to 1 when the site is served over HTTPS\nCOOKIE_SECURE=0\n"
        "# set to 1 only when running behind a reverse proxy (Caddy/nginx) that sets X-Forwarded-For\nTRUST_PROXY=0\n",
        encoding="utf-8")
    print(f"Wrote {ENV}")
    print("\nDone. Start the website with start-server.bat (or: python server/app.py) and open http://localhost:8800")


def load(mysql, base, pw):
    print("Loading the database (22 tables, rules and sample data)...")
    for f in SQL_FILES:
        if not f.exists():
            sys.exit(f"Couldn't find {f}")
        r = run(mysql, base, f.read_text(encoding="utf-8"), pw)
        if r.returncode != 0:
            sys.exit(f"Loading {f.name} failed:\n" + r.stderr.strip())
    print("Database loaded.")


if __name__ == "__main__":
    main()
