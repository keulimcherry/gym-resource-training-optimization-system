from db import query_one

STAFF = ("owner", "accountant", "front_desk")


class Forbidden(Exception):
    pass


class Invalid(Exception):
    pass

ROLES = {
    "Member":                     {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk", "member")},
    "Trainer":                    {"insert": ("owner",), "update": ("owner",)},
    "User":                       {"insert": ("owner",), "update": ("owner",)},
    "MembershipPlan":             {"insert": ("owner",), "update": ("owner",)},
    "Membership":                 {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "PersonalTrainingEnrollment": {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "TrainingPlan":               {"insert": ("owner", "front_desk", "trainer"), "update": ("owner", "trainer")},
    "SessionSeries":              {"insert": ("owner", "front_desk", "trainer"), "update": ("owner", "front_desk", "trainer")},
    "Session":                    {"insert": ("owner", "front_desk", "trainer", "member"), "update": ("owner", "front_desk", "trainer", "member"),
                                   "delete": ("owner", "front_desk", "trainer")},
    "SessionChangeRequest":       {"insert": ("owner", "front_desk", "trainer", "member"), "update": ("owner", "front_desk", "trainer")},
    "TrainerChange":              {"insert": ("owner", "front_desk", "member"), "update": ("owner", "front_desk", "member")},
    "ProgressRecord":             {"insert": ("owner", "trainer", "member"), "update": ("owner", "trainer", "member")},
    "ClassSchedule":              {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "GroupClass":                 {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "ClassAttendance":            {"insert": ("owner", "front_desk", "trainer"), "update": ("owner", "front_desk", "trainer")},
    "Payment":                    {"insert": ("owner", "accountant", "front_desk"), "update": ("owner", "accountant")},
    "CheckIn":                    {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "Equipment":                  {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "Announcement":               {"insert": ("owner", "front_desk"), "update": ("owner", "front_desk")},
    "Lead":                       {"update": ("owner", "front_desk"), "delete": ("owner", "front_desk")},
    "Notification":               {"insert": ("owner", "accountant", "front_desk", "trainer", "member"),
                                   "update": ("owner", "accountant", "front_desk", "trainer", "member")},
}

UPDATE_COLS = {
    ("Member", "member"): {"contact_number", "email"},
    ("Session", "member"): {"status"},
    ("Session", "trainer"): {"status", "session_date", "time_slot", "is_exception", "series_id", "plan_version_id"},
    ("SessionSeries", "trainer"): {"days_of_week", "time_slot", "start_date", "end_date", "status"},
    ("TrainingPlan", "trainer"): {"is_current", "details"},
    ("TrainerChange", "member"): {"status", "decided_at"},
    ("ProgressRecord", "member"): {"record_date", "weight", "strength_metric", "notes"},
    ("ProgressRecord", "trainer"): {"record_date", "weight", "strength_metric", "notes", "plan_version_id"},
    ("Notification", "*"): {"read_at"},
    ("User", "owner"): {"role", "is_active", "display_name"},
    ("Payment", "*"): {"amount", "payment_date", "method", "status", "void_reason", "membership_id", "pt_enrollment_id"},
    ("ClassAttendance", "trainer"): {"status"},
}

AUDITED = ("Payment", "Membership", "PersonalTrainingEnrollment", "Member", "User", "MembershipPlan", "TrainerChange",
           "CheckIn", "ClassAttendance", "Session")


def _row(table, pk, rid):
    return query_one(f"SELECT * FROM `{table}` WHERE `{pk}` = %s", (rid,))


def _enrollment(eid):
    return query_one("SELECT * FROM PersonalTrainingEnrollment WHERE pt_enrollment_id = %s", (eid,)) or {}


def _session(sid):
    return query_one("SELECT * FROM Session WHERE session_id = %s", (sid,)) or {}


def authorize(scope, op, table, row, old):
    role = scope.role
    allowed = ROLES.get(table, {}).get(op, ())
    if role not in allowed:
        raise Forbidden(f"Your role can't {'add' if op == 'insert' else 'change' if op == 'update' else 'remove'} {table} records.")

    if op == "update":
        cols = UPDATE_COLS.get((table, role)) or UPDATE_COLS.get((table, "*"))
        if cols is not None:
            extra = set(row) - cols
            if extra:
                raise Forbidden(f"Your role can't change {', '.join(sorted(extra))} on {table}.")

    uid, mid, tid = scope.uid, scope.mid, scope.tid
    enr_mine = lambda eid: role in ("owner", "front_desk") or (eid in (scope.my_enrollments() or set()))
    cur = dict(old or {}, **row)

    if table == "Member" and role == "member" and old["member_id"] != mid:
        raise Forbidden("You can only change your own details.")

    if table == "User":
        if op == "update" and old["user_id"] == uid and ("role" in row or row.get("is_active") is False):
            raise Forbidden("You can't change your own role or disable your own account.")

    if table in ("TrainingPlan", "SessionSeries") and role == "trainer":
        if not enr_mine(cur["pt_enrollment_id"]):
            raise Forbidden("That client isn't yours.")
        if table == "SessionSeries" and op == "insert":
            row["trainer_id"] = tid

    if table == "SessionSeries" and op == "insert":
        row["created_by"] = uid

    if table == "Session":
        if role == "member":
            e = _enrollment(cur["pt_enrollment_id"])
            if e.get("member_id") != mid:
                raise Forbidden("That isn't your session.")
            if op == "insert":
                if row.get("status") != "Requested":
                    raise Forbidden("Members can only request a session.")
                row["trainer_id"] = e["trainer_id"]
            elif not (old["status"] == "Requested" and row.get("status") == "Cancelled"):
                raise Forbidden("You can only withdraw a session you requested.")
        elif role == "trainer":
            if not enr_mine(cur["pt_enrollment_id"]) and (old or {}).get("trainer_id") != tid:
                raise Forbidden("That client isn't yours.")
            if op == "insert":
                row["trainer_id"] = _enrollment(cur["pt_enrollment_id"]).get("trainer_id", tid)
        if op == "delete" and old["status"] not in ("Scheduled", "Requested"):
            raise Forbidden("Only upcoming sessions can be removed; past ones stay in the history.")

    if table == "Lead" and op == "delete" and old["status"] == "Converted":
        raise Forbidden("This person is already a member; their enquiry is kept.")

    if table == "SessionChangeRequest":
        s = _session(cur["session_id"])
        if role == "member":
            if _enrollment(s.get("pt_enrollment_id")).get("member_id") != mid:
                raise Forbidden("That isn't your session.")
            row["status"] = "Pending"
        elif role == "trainer" and not (enr_mine(s.get("pt_enrollment_id")) or s.get("trainer_id") == tid):
            raise Forbidden("That client isn't yours.")
        if op == "insert":
            row["requested_by"] = uid
        elif "status" in row and row["status"] != old["status"]:
            row["decided_by"] = uid

    if table == "TrainerChange":
        if role == "member":
            if op == "insert":
                e = _enrollment(row.get("pt_enrollment_id"))
                if e.get("member_id") != mid:
                    raise Forbidden("That isn't your training.")
                row.update(member_id=mid, from_trainer_id=e["trainer_id"], status="Pending")
            else:
                if old["member_id"] != mid or not (old["status"] == "Pending" and row.get("status") == "Withdrawn"):
                    raise Forbidden("You can only withdraw your own pending request.")
        if op == "insert":
            row["requested_by"] = uid
            if row.get("status") in ("Approved", "Declined"):
                row["decided_by"] = uid
        elif "status" in row and row["status"] != old["status"] and row["status"] in ("Approved", "Declined"):
            row["decided_by"] = uid

    if table == "ProgressRecord":
        if role == "member":
            if cur["member_id"] != mid or cur.get("source") != "member" or (old and old["source"] != "member"):
                raise Forbidden("You can only write your own journal.")
            if op == "insert":
                row["trainer_id"] = None
        elif role == "trainer":
            if cur["member_id"] not in scope.client_ids() and not (old and old.get("trainer_id") == tid):
                raise Forbidden("That member isn't your client.")
            if cur.get("source") != "trainer" or (old and old["source"] != "trainer"):
                raise Forbidden("Trainers write coach logs; the journal belongs to the member.")
            if op == "insert":
                row["trainer_id"] = tid
        if op == "insert":
            row["entered_by"] = uid

    if table == "ClassAttendance" and role == "trainer":
        if cur["occurrence_id"] not in scope.my_occurrences():
            raise Forbidden("You can only mark attendance for your own classes.")

    if table == "Payment":
        if op == "insert":
            row["recorded_by"] = uid
            row["status"] = "valid"
            row["void_reason"] = None
            row["voided_by"] = None
        else:
            if row.get("status") == "void" and old["status"] != "void":
                if not (row.get("void_reason") or "").strip():
                    raise Invalid("Give a reason for voiding this payment.")
                row["voided_by"] = uid

    if table == "Announcement" and op == "insert":
        row["posted_by"] = uid

    if table == "Notification":
        if op == "update":
            if old["user_id"] != uid:
                raise Forbidden("That notification isn't yours.")
        else:
            row["read_at"] = None
            target = query_one("SELECT user_id, role, member_id, trainer_id FROM `User` WHERE user_id = %s", (row.get("user_id"),))
            if not target:
                raise Invalid("Nobody to notify.")
            if role == "member" and target["role"] not in STAFF and target["user_id"] != uid:
                mine = scope.my_enrollments() or set()
                trainers = {(_enrollment(e) or {}).get("trainer_id") for e in mine}
                if target["trainer_id"] not in trainers:
                    raise Forbidden("You can only notify your own trainer or the front desk.")
            if role == "trainer" and target["role"] not in STAFF and target["user_id"] != uid:
                if target["member_id"] not in (scope.visible_members() or set()):
                    raise Forbidden("You can only notify your own clients.")
