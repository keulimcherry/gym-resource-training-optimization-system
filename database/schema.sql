-- moksha fitness database - group 21
-- run this first, then sample_data.sql (app_user.sql after that if u want)
-- careful: this drops the old db and makes it again
DROP DATABASE IF EXISTS moksha_fitness;
CREATE DATABASE moksha_fitness CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE moksha_fitness;

-- people tables first
-- medical history cant be empty now, even 'no known medical conditions' is fine
CREATE TABLE Member (
  member_id        INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  contact_number   VARCHAR(20)  NOT NULL,
  email            VARCHAR(120) NOT NULL UNIQUE,
  medical_history  TEXT         NOT NULL,
  joined_date      DATE         NULL,
  CONSTRAINT chk_medical_filled CHECK (CHAR_LENGTH(TRIM(medical_history)) > 0)
) ENGINE=InnoDB;

CREATE TABLE Trainer (
  trainer_id       INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  specialization   VARCHAR(100) NOT NULL,
  contact_number   VARCHAR(20)  NOT NULL
) ENGINE=InnoDB;

-- login accounts, we never delete them just make them inactive
-- member account -> 1 member, trainer account -> 1 trainer, staff -> none
CREATE TABLE `User` (
  user_id          INT AUTO_INCREMENT PRIMARY KEY,
  username         VARCHAR(60)  NOT NULL UNIQUE,
  password_hash    VARCHAR(255) NOT NULL,
  display_name     VARCHAR(100) NOT NULL,
  role             ENUM('owner','accountant','front_desk','trainer','member') NOT NULL,
  member_id        INT NULL UNIQUE,
  trainer_id       INT NULL UNIQUE,
  is_active        BOOLEAN  NOT NULL DEFAULT TRUE,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login       DATETIME NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (member_id)  REFERENCES Member(member_id)   ON DELETE RESTRICT,
  FOREIGN KEY (trainer_id) REFERENCES Trainer(trainer_id) ON DELETE RESTRICT,
  CONSTRAINT chk_user_links CHECK (
       (role = 'member'  AND member_id IS NOT NULL AND trainer_id IS NULL)
    OR (role = 'trainer' AND trainer_id IS NOT NULL AND member_id IS NULL)
    OR (role IN ('owner','accountant','front_desk') AND member_id IS NULL AND trainer_id IS NULL))
) ENGINE=InnoDB;

-- memberships + PT stuff
CREATE TABLE MembershipPlan (
  plan_id          INT AUTO_INCREMENT PRIMARY KEY,
  plan_type        VARCHAR(50)   NOT NULL UNIQUE,
  duration_months  INT           NOT NULL CHECK (duration_months > 0),
  price            DECIMAL(10,2) NOT NULL CHECK (price >= 0)
) ENGINE=InnoDB;

-- agreed_price = what they actually agreed to pay (dues r calculated in a view)
CREATE TABLE Membership (
  membership_id    INT AUTO_INCREMENT PRIMARY KEY,
  member_id        INT NOT NULL,
  plan_id          INT NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  agreed_price     DECIMAL(10,2) NOT NULL CHECK (agreed_price >= 0),
  FOREIGN KEY (member_id) REFERENCES Member(member_id)       ON DELETE RESTRICT,
  FOREIGN KEY (plan_id)   REFERENCES MembershipPlan(plan_id) ON DELETE RESTRICT,
  CONSTRAINT chk_membership_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

-- PT enrollment, basically the M:N between member and trainer
CREATE TABLE PersonalTrainingEnrollment (
  pt_enrollment_id INT AUTO_INCREMENT PRIMARY KEY,
  member_id        INT NOT NULL,
  trainer_id       INT NOT NULL,
  goal             VARCHAR(255)  NOT NULL,
  start_date       DATE          NOT NULL,
  end_date         DATE          NULL,
  fee              DECIMAL(10,2) NOT NULL CHECK (fee >= 0),
  FOREIGN KEY (member_id)  REFERENCES Member(member_id)   ON DELETE RESTRICT,
  FOREIGN KEY (trainer_id) REFERENCES Trainer(trainer_id) ON DELETE RESTRICT,
  CONSTRAINT chk_pt_dates CHECK (end_date IS NULL OR end_date >= start_date)
) ENGINE=InnoDB;

-- weak entity (version_number), old plans stay saved
-- current_key trick so only ONE plan can be current
-- had to use RESTRICT here, mysql wont allow cascade with generated col
CREATE TABLE TrainingPlan (
  plan_version_id  INT AUTO_INCREMENT PRIMARY KEY,
  pt_enrollment_id INT NOT NULL,
  version_number   INT NOT NULL CHECK (version_number > 0),
  is_current       BOOLEAN NOT NULL DEFAULT TRUE,
  created_date     DATE NOT NULL,
  details          TEXT NOT NULL,
  current_key      INT AS (IF(is_current, pt_enrollment_id, NULL)) STORED,
  FOREIGN KEY (pt_enrollment_id) REFERENCES PersonalTrainingEnrollment(pt_enrollment_id) ON DELETE RESTRICT,
  UNIQUE KEY uq_plan_version (pt_enrollment_id, version_number),
  UNIQUE KEY uq_one_current_plan (current_key)
) ENGINE=InnoDB;

-- repeating sessions like Mon,Wed,Fri 6:30
CREATE TABLE SessionSeries (
  series_id        INT AUTO_INCREMENT PRIMARY KEY,
  pt_enrollment_id INT NOT NULL,
  trainer_id       INT NOT NULL,
  days_of_week     VARCHAR(27) NOT NULL,
  time_slot        TIME NOT NULL,
  start_date       DATE NOT NULL,
  end_date         DATE NOT NULL,
  status           ENUM('Active','Ended') NOT NULL DEFAULT 'Active',
  created_by       INT NOT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pt_enrollment_id) REFERENCES PersonalTrainingEnrollment(pt_enrollment_id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id)       REFERENCES Trainer(trainer_id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by)       REFERENCES `User`(user_id)     ON DELETE RESTRICT,
  CONSTRAINT chk_series_dates CHECK (end_date >= start_date)
) ENGINE=InnoDB;

-- one PT session (weak entity of enrollment)
-- live_slot goes NULL when cancelled so same slot can be booked again
CREATE TABLE Session (
  session_id       INT AUTO_INCREMENT PRIMARY KEY,
  pt_enrollment_id INT NOT NULL,
  trainer_id       INT NOT NULL,
  plan_version_id  INT NOT NULL,
  series_id        INT NULL,
  is_exception     BOOLEAN NOT NULL DEFAULT FALSE,
  session_date     DATE NOT NULL,
  time_slot        TIME NOT NULL,
  status           ENUM('Requested','Scheduled','Completed','No-show','Cancelled') NOT NULL DEFAULT 'Scheduled',
  live_slot        TINYINT AS (IF(status = 'Cancelled', NULL, 1)) STORED,
  FOREIGN KEY (pt_enrollment_id) REFERENCES PersonalTrainingEnrollment(pt_enrollment_id) ON DELETE CASCADE,
  FOREIGN KEY (trainer_id)       REFERENCES Trainer(trainer_id)            ON DELETE RESTRICT,
  FOREIGN KEY (plan_version_id)  REFERENCES TrainingPlan(plan_version_id)  ON DELETE RESTRICT,
  FOREIGN KEY (series_id)        REFERENCES SessionSeries(series_id)       ON DELETE SET NULL,
  UNIQUE KEY uq_session (pt_enrollment_id, session_date, time_slot, live_slot),
  KEY ix_trainer_day (trainer_id, session_date)
) ENGINE=InnoDB;

-- member asks to move/cancel a session, only 1 pending at a time
CREATE TABLE SessionChangeRequest (
  request_id       INT AUTO_INCREMENT PRIMARY KEY,
  session_id       INT NOT NULL,
  requested_by     INT NOT NULL,
  kind             ENUM('move','cancel') NOT NULL,
  new_date         DATE NULL,
  new_time         TIME NULL,
  note             VARCHAR(500) NULL,
  status           ENUM('Pending','Accepted','Declined','Answered') NOT NULL DEFAULT 'Pending',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by       INT NULL,
  decided_at       DATETIME NULL,
  staff_note       VARCHAR(500) NULL,
  pending_key      INT AS (IF(status = 'Pending', session_id, NULL)) STORED,
  FOREIGN KEY (session_id)   REFERENCES Session(session_id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by) REFERENCES `User`(user_id)     ON DELETE RESTRICT,
  FOREIGN KEY (decided_by)   REFERENCES `User`(user_id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_one_pending_request (pending_key),
  CONSTRAINT chk_move_has_time CHECK (kind = 'cancel' OR (new_date IS NOT NULL AND new_time IS NOT NULL))
) ENGINE=InnoDB;

-- switch trainer requests, staff decide
CREATE TABLE TrainerChange (
  change_id        INT AUTO_INCREMENT PRIMARY KEY,
  pt_enrollment_id INT NOT NULL,
  member_id        INT NOT NULL,
  from_trainer_id  INT NOT NULL,
  to_trainer_id    INT NULL,
  reason_type      VARCHAR(60)  NOT NULL,
  reason           TEXT NULL,
  status           ENUM('Pending','Approved','Declined','Withdrawn') NOT NULL DEFAULT 'Pending',
  requested_by     INT NOT NULL,
  requested_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_by       INT NULL,
  decided_at       DATETIME NULL,
  staff_note       TEXT NULL,
  pending_key      INT AS (IF(status = 'Pending', pt_enrollment_id, NULL)) STORED,
  FOREIGN KEY (pt_enrollment_id) REFERENCES PersonalTrainingEnrollment(pt_enrollment_id) ON DELETE RESTRICT,
  FOREIGN KEY (member_id)        REFERENCES Member(member_id)   ON DELETE RESTRICT,
  FOREIGN KEY (from_trainer_id)  REFERENCES Trainer(trainer_id) ON DELETE RESTRICT,
  FOREIGN KEY (to_trainer_id)    REFERENCES Trainer(trainer_id) ON DELETE RESTRICT,
  FOREIGN KEY (requested_by)     REFERENCES `User`(user_id)     ON DELETE RESTRICT,
  FOREIGN KEY (decided_by)       REFERENCES `User`(user_id)     ON DELETE RESTRICT,
  UNIQUE KEY uq_one_pending_change (pending_key),
  CONSTRAINT chk_change_differs CHECK (to_trainer_id IS NULL OR to_trainer_id <> from_trainer_id)
) ENGINE=InnoDB;

-- trainer logs AND members own journal both go here
CREATE TABLE ProgressRecord (
  record_id        INT AUTO_INCREMENT PRIMARY KEY,
  member_id        INT NOT NULL,
  source           ENUM('trainer','member') NOT NULL,
  trainer_id       INT NULL,
  entered_by       INT NULL,
  plan_version_id  INT NULL,
  record_date      DATE NOT NULL,
  weight           DECIMAL(5,1) NULL CHECK (weight IS NULL OR weight BETWEEN 20 AND 350),
  strength_metric  VARCHAR(100) NULL,
  notes            TEXT NULL,
  FOREIGN KEY (member_id)       REFERENCES Member(member_id)              ON DELETE CASCADE,
  FOREIGN KEY (trainer_id)      REFERENCES Trainer(trainer_id)            ON DELETE RESTRICT,
  FOREIGN KEY (entered_by)      REFERENCES `User`(user_id)                ON DELETE RESTRICT,
  FOREIGN KEY (plan_version_id) REFERENCES TrainingPlan(plan_version_id)  ON DELETE RESTRICT,
  UNIQUE KEY uq_progress (member_id, record_date, source),
  CONSTRAINT chk_member_entry_no_trainer CHECK (source = 'trainer' OR trainer_id IS NULL)
) ENGINE=InnoDB;

-- group classes: ClassSchedule = weekly class, GroupClass = the actual date
CREATE TABLE ClassSchedule (
  class_id         INT AUTO_INCREMENT PRIMARY KEY,
  trainer_id       INT NOT NULL,
  class_name       VARCHAR(100) NOT NULL,
  day_of_week      ENUM('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') NOT NULL,
  usual_start_time TIME NOT NULL,
  duration_minutes INT  NOT NULL CHECK (duration_minutes BETWEEN 15 AND 180),
  FOREIGN KEY (trainer_id) REFERENCES Trainer(trainer_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE GroupClass (
  occurrence_id    INT AUTO_INCREMENT PRIMARY KEY,
  class_id         INT  NOT NULL,
  occurrence_date  DATE NOT NULL,
  start_time       TIME NOT NULL,
  FOREIGN KEY (class_id) REFERENCES ClassSchedule(class_id) ON DELETE CASCADE,
  UNIQUE KEY uq_occurrence (class_id, occurrence_date)
) ENGINE=InnoDB;

-- who came to which class
CREATE TABLE ClassAttendance (
  attendance_id    INT AUTO_INCREMENT PRIMARY KEY,
  occurrence_id    INT NOT NULL,
  member_id        INT NOT NULL,
  status           ENUM('Attended','No-show','Cancelled') NOT NULL,
  FOREIGN KEY (occurrence_id) REFERENCES GroupClass(occurrence_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id)     REFERENCES Member(member_id)         ON DELETE CASCADE,
  UNIQUE KEY uq_attendance (occurrence_id, member_id)
) ENGINE=InnoDB;

-- money!! amount owed is NOT stored anywhere, see v_dues
-- payment is for membership OR pt, not both
CREATE TABLE Payment (
  payment_id       INT AUTO_INCREMENT PRIMARY KEY,
  member_id        INT NOT NULL,
  membership_id    INT NULL,
  pt_enrollment_id INT NULL,
  amount           DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  payment_date     DATE NOT NULL,
  method           ENUM('Cash','Card','Mobile Banking','Bank Transfer') NOT NULL,
  status           ENUM('valid','void') NOT NULL DEFAULT 'valid',
  void_reason      VARCHAR(255) NULL,
  voided_by        INT NULL,
  recorded_by      INT NOT NULL,
  FOREIGN KEY (member_id)        REFERENCES Member(member_id)                              ON DELETE RESTRICT,
  FOREIGN KEY (membership_id)    REFERENCES Membership(membership_id)                      ON DELETE RESTRICT,
  FOREIGN KEY (pt_enrollment_id) REFERENCES PersonalTrainingEnrollment(pt_enrollment_id)   ON DELETE RESTRICT,
  FOREIGN KEY (voided_by)        REFERENCES `User`(user_id)                                ON DELETE RESTRICT,
  FOREIGN KEY (recorded_by)      REFERENCES `User`(user_id)                                ON DELETE RESTRICT,
  CONSTRAINT chk_payment_one_purpose CHECK (membership_id IS NULL OR pt_enrollment_id IS NULL),
  CONSTRAINT chk_payment_void CHECK (
       (status = 'valid' AND void_reason IS NULL AND voided_by IS NULL)
    OR (status = 'void'  AND void_reason IS NOT NULL AND voided_by IS NOT NULL))
) ENGINE=InnoDB;

-- who is in the gym rn
CREATE TABLE CheckIn (
  checkin_id       INT AUTO_INCREMENT PRIMARY KEY,
  member_id        INT NOT NULL,
  check_in_time    DATETIME NOT NULL,
  check_out_time   DATETIME NULL,
  FOREIGN KEY (member_id) REFERENCES Member(member_id) ON DELETE CASCADE,
  KEY ix_checkin_time (check_in_time),
  CONSTRAINT chk_checkout_after CHECK (check_out_time IS NULL OR check_out_time >= check_in_time)
) ENGINE=InnoDB;

-- machines + when they need servicing (every 90 days)
CREATE TABLE Equipment (
  equipment_id      INT AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  category          ENUM('Cardio','Strength','Free Weights','Accessories') NOT NULL,
  quantity          INT  NOT NULL CHECK (quantity >= 0),
  last_service_date DATE NOT NULL,
  next_service_due  DATE NULL,
  CONSTRAINT chk_service_order CHECK (next_service_due IS NULL OR next_service_due >= last_service_date)
) ENGINE=InnoDB;

-- homepage posts, only the image path is saved
CREATE TABLE Announcement (
  announcement_id  INT AUTO_INCREMENT PRIMARY KEY,
  title            VARCHAR(150) NOT NULL,
  body             TEXT NOT NULL,
  image_path       VARCHAR(255) NULL,
  tag              ENUM('Announcement','Class','Offer','Event') NOT NULL DEFAULT 'Announcement',
  posted_date      DATE NOT NULL,
  posted_by        INT NOT NULL,
  is_published     BOOLEAN NOT NULL DEFAULT TRUE,
  FOREIGN KEY (posted_by) REFERENCES `User`(user_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- enquiries from homepage form
-- needed backticks bc LEAD is a keyword in mysql 8
CREATE TABLE `Lead` (
  lead_id          INT AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(100) NOT NULL,
  contact          VARCHAR(120) NOT NULL,
  interest         VARCHAR(60)  NOT NULL,
  message          TEXT NULL,
  submitted_date   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status           ENUM('New','Contacted','Converted') NOT NULL DEFAULT 'New'
) ENGINE=InnoDB;

-- log of changes to money/member stuff, can only add to it
CREATE TABLE AuditLog (
  audit_id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  action           ENUM('create','update','void','delete') NOT NULL,
  table_name       VARCHAR(40) NOT NULL,
  record_id        INT NOT NULL,
  old_values       JSON NULL,
  new_values       JSON NULL,
  reason           VARCHAR(255) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_address       VARCHAR(45) NULL,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE RESTRICT,
  KEY ix_audit_record (table_name, record_id)
) ENGINE=InnoDB;

-- the bell notifications
CREATE TABLE Notification (
  notification_id  INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  title            VARCHAR(150) NOT NULL,
  body             VARCHAR(500) NOT NULL,
  link             VARCHAR(200) NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at          DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES `User`(user_id) ON DELETE CASCADE,
  KEY ix_unread (user_id, read_at)
) ENGINE=InnoDB;

-- triggers for rules that CHECK cant do (they need other rows)
DELIMITER $$

-- no deleting payments, void them instead
CREATE TRIGGER trg_payment_no_delete BEFORE DELETE ON Payment FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Payments cannot be deleted. Void the payment with a reason instead.';
END$$

-- once voided it stays voided
CREATE TRIGGER trg_payment_no_unvoid BEFORE UPDATE ON Payment FOR EACH ROW
BEGIN
  IF OLD.status = 'void' AND NEW.status = 'valid' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A voided payment cannot be made valid again. Record a new payment.';
  END IF;
END$$

-- audit log cant be edited or deleted
CREATE TRIGGER trg_audit_no_update BEFORE UPDATE ON AuditLog FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The audit log cannot be changed.';
END$$

CREATE TRIGGER trg_audit_no_delete BEFORE DELETE ON AuditLog FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'The audit log cannot be changed.';
END$$

-- stop double booking: trainer cant have 2 sessions < 60 min apart
-- or a session on top of a class they teach
CREATE PROCEDURE check_trainer_clash(IN p_session_id INT, IN p_trainer_id INT, IN p_date DATE, IN p_time TIME)
BEGIN
  IF EXISTS (
      SELECT 1 FROM Session s
       WHERE s.trainer_id = p_trainer_id
         AND s.session_date = p_date
         AND s.session_id <> p_session_id
         AND s.status <> 'Cancelled'
         AND ABS(TIME_TO_SEC(TIMEDIFF(s.time_slot, p_time))) < 60 * 60) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Clash: this trainer already has a PT session within 60 minutes of this time.';
  END IF;
  IF EXISTS (
      SELECT 1 FROM GroupClass g
        JOIN ClassSchedule c ON c.class_id = g.class_id
       WHERE c.trainer_id = p_trainer_id
         AND g.occurrence_date = p_date
         AND p_time < ADDTIME(g.start_time, SEC_TO_TIME(c.duration_minutes * 60))
         AND g.start_time < ADDTIME(p_time, '01:00:00')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Clash: this trainer is teaching a group class at this time.';
  END IF;
END$$

CREATE TRIGGER trg_session_clash_ins BEFORE INSERT ON Session FOR EACH ROW
BEGIN
  IF NEW.status <> 'Cancelled' THEN
    CALL check_trainer_clash(0, NEW.trainer_id, NEW.session_date, NEW.time_slot);
  END IF;
END$$

CREATE TRIGGER trg_session_clash_upd BEFORE UPDATE ON Session FOR EACH ROW
BEGIN
  IF NEW.status <> 'Cancelled'
     AND (NEW.trainer_id <> OLD.trainer_id OR NEW.session_date <> OLD.session_date
          OR NEW.time_slot <> OLD.time_slot OR OLD.status = 'Cancelled') THEN
    CALL check_trainer_clash(OLD.session_id, NEW.trainer_id, NEW.session_date, NEW.time_slot);
  END IF;
END$$

-- marking present in class / finishing PT also checks them in
-- skips if they already checked in in the last 3 hrs
CREATE PROCEDURE auto_check_in(IN p_member_id INT)
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM CheckIn
       WHERE member_id = p_member_id
         AND check_out_time IS NULL
         AND check_in_time >= NOW() - INTERVAL 3 HOUR) THEN
    INSERT INTO CheckIn (member_id, check_in_time) VALUES (p_member_id, NOW());
  END IF;
END$$

CREATE TRIGGER trg_attendance_checkin_ins AFTER INSERT ON ClassAttendance FOR EACH ROW
BEGIN
  IF NEW.status = 'Attended'
     AND (SELECT occurrence_date FROM GroupClass WHERE occurrence_id = NEW.occurrence_id) = CURDATE() THEN
    CALL auto_check_in(NEW.member_id);
  END IF;
END$$

CREATE TRIGGER trg_attendance_checkin_upd AFTER UPDATE ON ClassAttendance FOR EACH ROW
BEGIN
  IF NEW.status = 'Attended' AND OLD.status <> 'Attended'
     AND (SELECT occurrence_date FROM GroupClass WHERE occurrence_id = NEW.occurrence_id) = CURDATE() THEN
    CALL auto_check_in(NEW.member_id);
  END IF;
END$$

CREATE TRIGGER trg_session_checkin AFTER UPDATE ON Session FOR EACH ROW
BEGIN
  IF NEW.status = 'Completed' AND OLD.status <> 'Completed' AND NEW.session_date = CURDATE() THEN
    CALL auto_check_in((SELECT member_id FROM PersonalTrainingEnrollment WHERE pt_enrollment_id = NEW.pt_enrollment_id));
  END IF;
END$$

DELIMITER ;

-- views (calculated every time, not stored)
-- how much each membership / PT still owes, void payments dont count
CREATE VIEW v_dues AS
SELECT 'Membership' AS kind, ms.membership_id AS item_id, ms.member_id,
       mp.plan_type AS item, ms.agreed_price AS price,
       COALESCE(SUM(CASE WHEN p.status = 'valid' THEN p.amount END), 0) AS paid,
       ms.agreed_price - COALESCE(SUM(CASE WHEN p.status = 'valid' THEN p.amount END), 0) AS owed
  FROM Membership ms
  JOIN MembershipPlan mp ON mp.plan_id = ms.plan_id
  LEFT JOIN Payment p ON p.membership_id = ms.membership_id
 GROUP BY ms.membership_id, ms.member_id, mp.plan_type, ms.agreed_price
UNION ALL
SELECT 'Personal training', pt.pt_enrollment_id, pt.member_id,
       CONCAT('PT with ', t.name), pt.fee,
       COALESCE(SUM(CASE WHEN p.status = 'valid' THEN p.amount END), 0),
       pt.fee - COALESCE(SUM(CASE WHEN p.status = 'valid' THEN p.amount END), 0)
  FROM PersonalTrainingEnrollment pt
  JOIN Trainer t ON t.trainer_id = pt.trainer_id
  LEFT JOIN Payment p ON p.pt_enrollment_id = pt.pt_enrollment_id
 GROUP BY pt.pt_enrollment_id, pt.member_id, t.name, pt.fee;

-- total owed per member
CREATE VIEW v_member_dues AS
SELECT m.member_id, m.name, COALESCE(SUM(d.owed), 0) AS total_owed
  FROM Member m
  LEFT JOIN v_dues d ON d.member_id = m.member_id
 GROUP BY m.member_id, m.name;

-- latest membership + is it still active
CREATE VIEW v_member_status AS
SELECT m.member_id, m.name, ms.end_date,
       CASE WHEN ms.end_date IS NULL THEN 'No membership'
            WHEN ms.end_date < CURDATE() THEN 'Expired'
            WHEN ms.end_date <= CURDATE() + INTERVAL 7 DAY THEN 'Ending soon'
            ELSE 'Active' END AS status
  FROM Member m
  LEFT JOIN Membership ms ON ms.membership_id = (
        SELECT ms2.membership_id FROM Membership ms2
         WHERE ms2.member_id = m.member_id
         ORDER BY ms2.end_date DESC LIMIT 1);

-- live number on homepage (checked in, not out, last 3 hrs)
CREATE VIEW v_training_now AS
SELECT c.checkin_id, c.member_id, m.name, c.check_in_time
  FROM CheckIn c JOIN Member m ON m.member_id = c.member_id
 WHERE c.check_out_time IS NULL
   AND c.check_in_time >= NOW() - INTERVAL 3 HOUR;
