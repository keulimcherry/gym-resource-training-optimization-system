# Gym Resource & Training Optimization System

A gym management web app backed by a MySQL database: a public homepage plus separate dashboards
for the owner, accountant, front desk, trainers and members. Every page reads from and saves to MySQL.

Built as a Database Systems (CSE 2205) project, modelled on a real gym in Kathmandu.

**Video walkthrough and live demo:** https://youtu.be/j_1k7d9ncWU

## What's inside

- **22-table MySQL schema** with primary and foreign keys, weak entities, `ON DELETE` rules,
  `UNIQUE` and `CHECK` constraints and indexes
- **Rules enforced inside MySQL itself:** triggers that block deleting payments, keep the audit log
  append-only, stop a trainer from being double-booked, and check members in automatically
- **Derived values as views:** amounts owed and live gym occupancy are calculated, never stored
- **Least-privilege app account:** the website connects as a MySQL user that can't drop tables or
  delete money and history records
- **Five roles, one site:** each role sees only the rows it is allowed to, and every save runs in a
  single transaction

## Tech stack

| Layer | Technology |
|---|---|
| Database | MySQL 8.4 |
| Backend | Python, Flask, PyMySQL |
| Frontend | HTML, CSS, JavaScript |

## Folders

```
database/      schema.sql, sample_data.sql, app_user.sql
source_code/   Flask server (server/) and the website (design/)
```

## Run it locally

1. Install Python 3.10+ and MySQL 8 (WampServer works; MariaDB does not).
2. Start MySQL.
3. Windows: double-click `source_code/start-server.bat`. It installs the packages, loads the schema
   and sample data, and opens http://localhost:8800.

Full setup steps, environment variables and demo logins are in [`source_code/README.md`](source_code/README.md).
The database scripts are described in [`database/README.md`](database/README.md).

## Using this project

This repository is open for students to read, take notes from and get ideas for their own work.
Please don't copy the project or submit it as your own.

---

<sub>© 2026 Sneha Shah. All rights reserved.</sub>
