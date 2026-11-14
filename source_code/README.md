# Moksha Fitness: Gym Resource & Training Optimization System

CSE 2205 Database Systems, Group 21: Sneha Shah (240242), Prerana Gupta (240241)

A gym management website: a public homepage plus dashboards for the owner, accountant,
front desk, trainers and members. Every page reads from and saves to a MySQL database.

| Layer | Technology | Folder |
|---|---|---|
| Front end | HTML, CSS, JavaScript | `design/` |
| Back end | Python 3, Flask, PyMySQL | `server/` |
| Database | MySQL 8 | `../database/` (`schema.sql`, `sample_data.sql`) |

## Requirements

- Python 3.10 or newer (tick "Add Python to PATH" when installing)
- MySQL 8 (we use WampServer's MySQL 8.4 on port 3306; **not** MariaDB)

## Run it locally (Windows, quickest)

1. Start WampServer (or your MySQL 8 service) and wait until it is running.
2. Keep the folders as they are: `database/` must sit next to `source_code/`.
3. Double-click `source_code/start-server.bat`. The first time it:
   - installs Flask and PyMySQL (`server/requirements.txt`)
   - runs `server/setup_db.py`, which loads `schema.sql` then `sample_data.sql` into a database
     called `moksha_fitness`, creates a restricted MySQL account `moksha_app`, and writes `server/.env`
4. Your browser opens **http://localhost:8800**. Keep the black window open while using the site.

If MySQL's root user has a password, the setup script asks for it.

## Run it by hand (any OS)

```bash
pip install -r server/requirements.txt
mysql -u root -p < ../database/schema.sql
mysql -u root -p < ../database/sample_data.sql
mysql -u root -p < ../database/app_user.sql   # first replace CHANGE_ME_to_a_long_random_password in this file
python server/app.py
```

Then create `server/.env` (see below) and open http://localhost:8800.

## Database environment variables (`server/.env`)

The server reads these from `server/.env` (one `NAME=value` per line) or from real environment variables.
`setup_db.py` writes this file for you with random secrets.

| Variable | Meaning | Default |
|---|---|---|
| `DB_HOST` | MySQL host | `127.0.0.1` |
| `DB_PORT` | MySQL port | `3306` |
| `DB_NAME` | Database name | `moksha_fitness` |
| `DB_USER` | MySQL account the website uses | `moksha_app` |
| `DB_PASSWORD` | That account's password | (empty) |
| `SECRET_KEY` | Signs login sessions; any long random text | random each start |
| `PORT` | Website port | `8800` |

Example:

```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=moksha_fitness
DB_USER=moksha_app
DB_PASSWORD=your-password-here
SECRET_KEY=any-long-random-text
PORT=8800
```

To use the MySQL `root` account instead of `moksha_app` while testing, set `DB_USER=root` and its password.

## Demo logins

The password for every sample account is **moksha123** (only salted hashes are stored in the database).

| Role | Usernames |
|---|---|
| Owner | `owner` |
| Accountant | `accounts` |
| Front desk | `frontdesk` |
| Trainers | `coach.rohan`, `coach.mira`, `coach.suman`, `coach.asha`, `coach.bijay` |
| Members | `aarav.shrestha`, `anjali.gurung`, `prakriti.karki`, `bikash.rai` and 8 more |

## Code map

```
source_code/
  start-server.bat        one-click start (installs packages, sets up the database the first time)
  server/
    app.py                Flask app: serves design/, login, /api/session (read), /api/tx (save)
    db.py                 MySQL connection; every save is one transaction (all or nothing)
    scope.py              which rows each role may see
    policy.py             which changes each role may make; writes the audit log
    setup_db.py           one-time database setup and .env writer
    create_owner.py       creates a real owner account on an empty database
  design/
    home.html             public homepage with login
    dashboard.html        dashboards for all five roles
    assets/               CSS and JavaScript (data.js talks to the API)
    serve.py, start-demo.bat   offline prototype mode without MySQL (data kept in the browser)
```

Reset to fresh sample data any time: `python server/setup_db.py` and type `YES`.
Check the data in phpMyAdmin (http://localhost/phpmyadmin) or MySQL Workbench, database `moksha_fitness`.

---

<sub>© 2026 Sneha Shah. All rights reserved.</sub>
