from db import query, q, to_json_value

STAFF = ("owner", "accountant", "front_desk")

SECRET_COLS = {"User": {"password_hash"}}

TABLES = ["MembershipPlan", "Member", "Trainer", "User", "Membership", "PersonalTrainingEnrollment", "TrainingPlan",
          "SessionSeries", "Session", "SessionChangeRequest", "TrainerChange", "ProgressRecord", "ClassSchedule",
          "GroupClass", "ClassAttendance", "Payment", "CheckIn", "Equipment", "Announcement", "Lead", "AuditLog", "Notification"]


def ids(sql, args=()):
    return {next(iter(r.values())) for r in query(sql, args)}


class Scope:

    def __init__(self, user):
        self.user = user
        self.role = user["role"]
        self.uid = user["user_id"]
        self.mid = user.get("member_id")
        self.tid = user.get("trainer_id")
        self._cache = {}

    def _memo(self, key, fn):
        if key not in self._cache:
            self._cache[key] = fn()
        return self._cache[key]

    def my_enrollments(self):
        if self.role == "trainer":
            return self._memo("enr", lambda: ids("SELECT pt_enrollment_id FROM PersonalTrainingEnrollment WHERE trainer_id = %s "
                                                  "UNION SELECT pt_enrollment_id FROM Session WHERE trainer_id = %s", (self.tid, self.tid)))
        if self.role == "member":
            return self._memo("enr", lambda: ids("SELECT pt_enrollment_id FROM PersonalTrainingEnrollment WHERE member_id = %s", (self.mid,)))
        return None

    def my_active_enrollments(self):
        if self.role != "trainer":
            return self.my_enrollments()
        return self._memo("act", lambda: ids("SELECT pt_enrollment_id FROM PersonalTrainingEnrollment WHERE trainer_id = %s "
                                              "AND (end_date IS NULL OR end_date >= CURDATE())", (self.tid,)))

    def my_classes(self):
        return self._memo("cls", lambda: ids("SELECT class_id FROM ClassSchedule WHERE trainer_id = %s", (self.tid,)))

    def my_occurrences(self):
        return self._memo("occ", lambda: ids("SELECT g.occurrence_id FROM GroupClass g JOIN ClassSchedule c ON c.class_id = g.class_id "
                                              "WHERE c.trainer_id = %s", (self.tid,)))

    def client_ids(self):
        e = self.my_active_enrollments()
        if not e:
            return set()
        return self._memo("cli", lambda: ids(f"SELECT member_id FROM PersonalTrainingEnrollment WHERE pt_enrollment_id IN ({','.join(['%s'] * len(e))})", tuple(e)))

    def visible_members(self):
        if self.role in STAFF:
            return None
        if self.role == "member":
            return {self.mid}

        def calc():
            e = self.my_enrollments()
            m = ids(f"SELECT member_id FROM PersonalTrainingEnrollment WHERE pt_enrollment_id IN ({','.join(['%s'] * len(e))})", tuple(e)) if e else set()
            occ = self.my_occurrences()
            if occ:
                m |= ids(f"SELECT member_id FROM ClassAttendance WHERE occurrence_id IN ({','.join(['%s'] * len(occ))})", tuple(occ))
            return m
        return self._memo("mem", calc)

    def my_sessions(self):
        e = self.my_enrollments()
        if e is None:
            return None
        if not e and self.role != "trainer":
            return set()
        if self.role == "trainer":
            return self._memo("ses", lambda: ids(
                f"SELECT session_id FROM Session WHERE trainer_id = %s" + (f" OR pt_enrollment_id IN ({','.join(['%s'] * len(e))})" if e else ""),
                (self.tid, *e)))
        return self._memo("ses", lambda: ids(f"SELECT session_id FROM Session WHERE pt_enrollment_id IN ({','.join(['%s'] * len(e))})", tuple(e)))


def _in(col, values):
    if not values:
        return "1 = 0", ()
    return f"{q(col)} IN ({','.join(['%s'] * len(values))})", tuple(values)


def row_filter(scope, table):
    r = scope.role
    if r == "owner":
        return "1 = 1", ()
    if r in ("accountant", "front_desk"):
        if table == "AuditLog" and r == "front_desk":
            return None
        if table == "Notification":
            return "user_id = %s", (scope.uid,)
        if table == "Lead" and r == "accountant":
            return None
        if table == "User":
            return "1 = 1", ()
        return "1 = 1", ()

    if table in ("MembershipPlan", "Trainer", "ClassSchedule", "GroupClass"):
        return "1 = 1", ()
    if table == "Announcement":
        return "is_published = 1", ()
    if table == "Notification":
        return "user_id = %s", (scope.uid,)
    if table in ("AuditLog", "Lead", "Equipment"):
        return None

    mem = scope.visible_members()
    enr = scope.my_enrollments()
    if table == "Member":
        return _in("member_id", mem)
    if table == "User":
        extra = " OR member_id IN (" + ",".join(["%s"] * len(mem)) + ")" if mem else ""
        return f"user_id = %s OR role IN ('owner','front_desk','trainer'){extra}", (scope.uid, *mem)
    if table == "Membership":
        return _in("member_id", mem)
    if table == "Payment":
        return _in("member_id", {scope.mid}) if r == "member" else None
    if table == "PersonalTrainingEnrollment":
        return _in("pt_enrollment_id", enr)
    if table in ("TrainingPlan", "SessionSeries", "TrainerChange"):
        return _in("pt_enrollment_id", enr)
    if table == "Session":
        return _in("session_id", scope.my_sessions())
    if table == "SessionChangeRequest":
        return _in("session_id", scope.my_sessions())
    if table == "ProgressRecord":
        return _in("member_id", mem if r == "trainer" else {scope.mid})
    if table == "ClassAttendance":
        return _in("occurrence_id", scope.my_occurrences()) if r == "trainer" else _in("member_id", {scope.mid})
    if table == "CheckIn":
        return _in("member_id", mem)
    return None


def hidden_cols(scope, table):
    cols = set(SECRET_COLS.get(table, ()))
    r = scope.role
    if table == "Member" and r == "accountant":
        cols.add("medical_history")
    if table == "TrainerChange" and r == "trainer":
        cols |= {"reason", "staff_note"}
    if table == "User" and r not in ("owner",):
        cols |= {"last_login", "created_at"}
    return cols


def snapshot(schema, scope):
    out = {}
    for table in TABLES:
        name = schema.name(table)
        if not name:
            continue
        flt = row_filter(scope, table)
        if flt is None:
            out[table] = []
            continue
        where, args = flt
        meta = schema.tables[name]
        hide = hidden_cols(scope, table) | meta["generated"]
        cols = [c for c in meta["columns"] if c not in hide]
        rows = query(f"SELECT {', '.join(q(c) for c in cols)} FROM {q(name)} WHERE {where} ORDER BY {q(meta['pk'])}", args)
        out[table] = [{c: to_json_value(schema, name, c, row[c]) for c in cols} for row in rows]
        if table == "User" and scope.role not in STAFF:
            for row in out[table]:
                if row["user_id"] != scope.uid:
                    row["username"] = None
    if out.get("CheckIn"):
        add_checkin_source(out["CheckIn"])
    return out


def add_checkin_source(rows):
    today = [r["checkin_id"] for r in rows if str(r.get("check_in_time", "")) >= query("SELECT CURDATE() AS d")[0]["d"].isoformat()]
    if not today:
        return
    marks = ",".join(["%s"] * len(today))
    found = query(f"""
        SELECT c.checkin_id,
               (SELECT cs.class_name FROM AuditLog a
                  JOIN ClassAttendance ca ON ca.attendance_id = a.record_id
                  JOIN GroupClass g ON g.occurrence_id = ca.occurrence_id
                  JOIN ClassSchedule cs ON cs.class_id = g.class_id
                 WHERE a.table_name = 'ClassAttendance' AND ca.member_id = c.member_id AND ca.status = 'Attended'
                   AND ABS(TIMESTAMPDIFF(SECOND, a.created_at, c.check_in_time)) <= 5 LIMIT 1) AS class_name,
               EXISTS (SELECT 1 FROM AuditLog a
                  JOIN Session s ON s.session_id = a.record_id
                  JOIN PersonalTrainingEnrollment e ON e.pt_enrollment_id = s.pt_enrollment_id
                 WHERE a.table_name = 'Session' AND e.member_id = c.member_id AND s.status = 'Completed'
                   AND ABS(TIMESTAMPDIFF(SECOND, a.created_at, c.check_in_time)) <= 5) AS pt
          FROM CheckIn c WHERE c.checkin_id IN ({marks})""", tuple(today))
    via = {f["checkin_id"]: (f"class:{f['class_name']}" if f["class_name"] else "pt" if f["pt"] else "desk") for f in found}
    for r in rows:
        if r["checkin_id"] in via:
            r["via"] = via[r["checkin_id"]]
