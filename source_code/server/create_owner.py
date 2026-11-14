import os
import re
import secrets
import string
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pymysql
from werkzeug.security import generate_password_hash

ROOT = Path(__file__).resolve().parent
env = ROOT / ".env"
if env.exists():
    for line in env.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


def main():
    name = input("Owner's full name: ").strip()
    username = input("Username (letters, numbers, dots): ").strip().lower()
    if not name or not re.fullmatch(r"[a-z0-9._-]{3,40}", username):
        sys.exit("Give a name and a username of 3-40 letters, numbers, dots, dashes or underscores.")
    alphabet = string.ascii_letters + string.digits
    temp = "".join(secrets.choice(alphabet) for _ in range(12)) + secrets.choice(string.digits)
    conn = pymysql.connect(host=os.environ.get("DB_HOST", "127.0.0.1"), port=int(os.environ.get("DB_PORT", "3306")),
                           user=os.environ.get("DB_USER", "moksha_app"), password=os.environ.get("DB_PASSWORD", ""),
                           database=os.environ.get("DB_NAME", "moksha_fitness"), autocommit=False)
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO `User` (username, password_hash, display_name, role, must_change_password) VALUES (%s, %s, %s, 'owner', 1)",
                        (username, generate_password_hash(temp), name))
            uid = cur.lastrowid
            cur.execute("INSERT INTO AuditLog (user_id, action, table_name, record_id, new_values, reason) VALUES (%s, 'create', 'User', %s, %s, %s)",
                        (uid, uid, '{"role": "owner"}', "First owner account created from the server"))
        conn.commit()
    except pymysql.err.IntegrityError:
        sys.exit("That username is already taken.")
    finally:
        conn.close()
    print(f"\nOwner account created.\n  Username:           {username}\n  Temporary password: {temp}\n"
          "They'll be asked to choose their own password at first login. This password isn't shown again.")


if __name__ == "__main__":
    main()
