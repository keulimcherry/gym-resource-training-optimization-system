# Database scripts (MySQL 8)

Run in this order (the order matters because of foreign keys):

1. `schema.sql` creates the database `moksha_fitness`: 22 tables with primary keys, foreign keys
   (ON DELETE RESTRICT / CASCADE / SET NULL), UNIQUE and CHECK constraints, indexes, 6 triggers,
   1 stored procedure and 4 views.
2. `sample_data.sql` inserts realistic test records into every table, parents before children.
   Dates are relative to the day you load it, so the data always looks current.
3. `app_user.sql` (optional) creates the restricted account `moksha_app` that the website connects with.
   Replace `CHANGE_ME_to_a_long_random_password` first. `source_code/server/setup_db.py` does this automatically.

```bash
mysql -u root -p < schema.sql
mysql -u root -p < sample_data.sql
```

Or in phpMyAdmin: Import, `schema.sql`, Go, then Import, `sample_data.sql`, Go.
Loading `schema.sql` again drops and rebuilds the database.

---

<sub>© 2026 Sneha Shah. All rights reserved.</sub>
