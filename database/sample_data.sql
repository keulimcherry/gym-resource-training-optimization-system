-- sample data so we can test everything
-- password for every account is moksha123 (only the hash is saved)
-- dates are based on CURDATE() so it always looks recent
USE moksha_fitness;
SET @today = CURDATE();

START TRANSACTION;

-- plans (prices are sample for now), trainers, members
INSERT INTO MembershipPlan (plan_id, plan_type, duration_months, price) VALUES
 (1, 'Monthly Basic',      1,  3000.00),
 (2, 'Quarterly Standard', 3,  8000.00),
 (3, 'Annual Premium',    12, 28000.00);

INSERT INTO Trainer (trainer_id, name, specialization, contact_number) VALUES
 (1, 'Rohan Tamang', 'Strength & conditioning', '9841234501'),
 (2, 'Mira Gurung',  'Yoga & mobility',         '9841234502'),
 (3, 'Suman Thapa',  'HIIT & fat loss',         '9841234503'),
 (4, 'Asha Rai',     'Functional training',     '9841234504'),
 (5, 'Bijay Lama',   'Bodybuilding',            '9841234505');

INSERT INTO Member (member_id, name, contact_number, email, medical_history, joined_date) VALUES
 (1,  'Aarav Shrestha',   '9851000001', 'aarav.shrestha@example.com',   'Mild asthma (carries inhaler)',            @today - INTERVAL 70 DAY),
 (2,  'Prakriti Karki',   '9851000002', 'prakriti.karki@example.com',   'Lower-back pain, avoid heavy deadlifts',   @today - INTERVAL 200 DAY),
 (3,  'Bikash Rai',       '9851000003', 'bikash.rai@example.com',       'No known medical conditions',              @today - INTERVAL 25 DAY),
 (4,  'Rojina Magar',     '9851000004', 'rojina.magar@example.com',     'None reported',                            @today - INTERVAL 85 DAY),
 (5,  'Sujan Thapa',      '9851000005', 'sujan.thapa@example.com',      'No known medical conditions',              @today - INTERVAL 40 DAY),
 (6,  'Anjali Gurung',    '9851000006', 'anjali.gurung@example.com',    'Old left-knee injury, avoid deep lunges',  @today - INTERVAL 30 DAY),
 (7,  'Nabin Lama',       '9851000007', 'nabin.lama@example.com',       'No known medical conditions',              @today - INTERVAL 10 DAY),
 (8,  'Kiran Joshi',      '9851000008', 'kiran.joshi@example.com',      'High blood pressure (on medication)',      @today - INTERVAL 5 DAY),
 (9,  'Srijana Adhikari', '9851000009', 'srijana.adhikari@example.com', 'No known medical conditions',              @today - INTERVAL 60 DAY),
 (10, 'Manish KC',        '9851000010', 'manish.kc@example.com',        'No known medical conditions',              @today - INTERVAL 20 DAY),
 (11, 'Sabina Tamang',    '9851000011', 'sabina.tamang@example.com',    'None reported',                            @today - INTERVAL 300 DAY),
 (12, 'Dipesh Shah',      '9851000012', 'dipesh.shah@example.com',      'No known medical conditions',              @today - INTERVAL 15 DAY);

-- login accounts
INSERT INTO `User` (user_id, username, password_hash, display_name, role, member_id, trainer_id) VALUES
 (1,  'owner',            'pbkdf2:sha256:600000$Pi2YwKH3hk7RQ2rJ$361e094b32437b26c057d80ed55f9daa7f496b1c8ec8ac3f2e78a2cc92ed0f1f',            'Nirmal KC',        'owner',      NULL, NULL),
 (2,  'accounts',         'pbkdf2:sha256:600000$ybDeC3l4nlWtOta1$4e702a9d5e08f649624f72fc055031d4df996dde37bf704b478fc088c356c08f',         'Sunita Pandey',    'accountant', NULL, NULL),
 (3,  'frontdesk',        'pbkdf2:sha256:600000$1YZQD0Kh6GPF9bp8$766799a3858805008e22c35e3531c315d474cfc427d7c6a54309f22e54650f73',        'Sita Karki',       'front_desk', NULL, NULL),
 (4,  'coach.rohan',      'pbkdf2:sha256:600000$8cSdltUJwSu7gnZB$5ea9e61bd1afa3368011a51000b61959e06009ebc5268660d991a7336cf09e00',      'Rohan Tamang',     'trainer',    NULL, 1),
 (5,  'coach.mira',       'pbkdf2:sha256:600000$CviRIipIrGV2LXSj$90a181e42c326fd5f97cca26a5be4728e95c5b3bbd1397a1a2d043656ecfb156',       'Mira Gurung',      'trainer',    NULL, 2),
 (6,  'coach.suman',      'pbkdf2:sha256:600000$idCcor8mXJ1WdJt2$11fee46928748cf6a046ca63f734513d891899d2a4a03115f19dd8ca72b891f9',      'Suman Thapa',      'trainer',    NULL, 3),
 (7,  'coach.asha',       'pbkdf2:sha256:600000$AJh4fP8OE7dpm9FT$d17a7d9f2a75dddb62d9e133655b3dfb8452fef59593d62274a3703d80dc96b6',       'Asha Rai',         'trainer',    NULL, 4),
 (8,  'coach.bijay',      'pbkdf2:sha256:600000$Q6e76uIasjLB2YRJ$4f7bbc21971bb220d7f5d2815354bf9538b71cd64a5d0f7e59aed870bcdff4ec',      'Bijay Lama',       'trainer',    NULL, 5),
 (9,  'aarav.shrestha',   'pbkdf2:sha256:600000$pqAsF7RRsq1VUzbn$52d1a609997f260275ad71388f608c3ba083e8331c3fe276812e4507e249aeea',   'Aarav Shrestha',   'member',     1,    NULL),
 (10, 'prakriti.karki',   'pbkdf2:sha256:600000$Q3FBdssc5KPNlx2p$e4925d5d586622a0a9af4c54ece4698801f3e43ef32c45c30805cd77fb6bb6a4',   'Prakriti Karki',   'member',     2,    NULL),
 (11, 'bikash.rai',       'pbkdf2:sha256:600000$ZsBhiI6AavYH9zhe$f9515bc95b645ca26fee441ce660e15b67598603a917aa3b3ecddca18b278813',       'Bikash Rai',       'member',     3,    NULL),
 (12, 'rojina.magar',     'pbkdf2:sha256:600000$0l6ISmmSd6RqS7B3$bfe4c62ff0a98734a614494d6d2db8705d2b093b58d63530915a5e56a35964a6',     'Rojina Magar',     'member',     4,    NULL),
 (13, 'sujan.thapa',      'pbkdf2:sha256:600000$Yeo269aDnHcvJTIO$c2dbf6f37e7b5a6f9b5a7d51a445ed0174cdabac9ca4c2f9d64c771700a05ced',      'Sujan Thapa',      'member',     5,    NULL),
 (14, 'anjali.gurung',    'pbkdf2:sha256:600000$Ze5d7DngEOSd1URs$a02428ac24a99c6fa374addf5343adc2ec66427761ea5107ae955d935d3ebad4',    'Anjali Gurung',    'member',     6,    NULL),
 (15, 'nabin.lama',       'pbkdf2:sha256:600000$Rj4HNEBSdoOw9MZx$36405d9ba87d09a0e041cd688fffac013c9ed9981c08545c791879f3cf439b66',       'Nabin Lama',       'member',     7,    NULL),
 (16, 'kiran.joshi',      'pbkdf2:sha256:600000$tvSXlDizTI907XZn$a212b5ae08a62fc5dcd831ea9bac8f245145062b15e8202dbc1178fe95f09ae9',      'Kiran Joshi',      'member',     8,    NULL),
 (17, 'srijana.adhikari', 'pbkdf2:sha256:600000$pcti1GDsd70ACEkR$f66b6784d34b714e6efc19571e253c91957d53758f004b4c9a17e9e77e3eca56', 'Srijana Adhikari', 'member',     9,    NULL),
 (18, 'manish.kc',        'pbkdf2:sha256:600000$Kk04Y0Th99MVmxv8$0aacc18cd72a2706d9333e44cc96e6c9fde35924d87a6553f0cbfdc5ed3e1acc',        'Manish KC',        'member',     10,   NULL);

-- end date = start + plan length
INSERT INTO Membership (membership_id, member_id, plan_id, start_date, end_date, agreed_price)
SELECT v.id, v.member_id, v.plan_id, @today - INTERVAL v.ago DAY,
       (@today - INTERVAL v.ago DAY) + INTERVAL p.duration_months MONTH, p.price
  FROM (SELECT 1 id, 1 member_id, 2 plan_id, 70 ago UNION ALL SELECT 2, 2, 3, 200 UNION ALL
        SELECT 3, 3, 1, 25 UNION ALL SELECT 4, 4, 2, 85 UNION ALL SELECT 5, 5, 1, 40 UNION ALL
        SELECT 6, 6, 2, 30 UNION ALL SELECT 7, 7, 3, 10 UNION ALL SELECT 8, 8, 1, 5 UNION ALL
        SELECT 9, 9, 2, 60 UNION ALL SELECT 10, 10, 1, 20 UNION ALL SELECT 11, 11, 3, 300 UNION ALL
        SELECT 12, 12, 2, 15) v
  JOIN MembershipPlan p ON p.plan_id = v.plan_id;

-- PT
INSERT INTO PersonalTrainingEnrollment (pt_enrollment_id, member_id, trainer_id, goal, start_date, end_date, fee) VALUES
 (1, 1, 1, 'Lose 8 kg and build strength',     @today - INTERVAL 70 DAY, NULL, 15000.00),
 (2, 6, 3, 'Fat loss before a wedding',        @today - INTERVAL 30 DAY, NULL, 12000.00),
 (3, 3, 4, 'Functional strength for football', @today - INTERVAL 25 DAY, NULL, 12000.00),
 (4, 2, 2, 'Mobility and back-pain relief',    @today - INTERVAL 45 DAY, NULL, 10000.00);

-- aarav has 3 plan versions, v3 is current
INSERT INTO TrainingPlan (plan_version_id, pt_enrollment_id, version_number, is_current, created_date, details) VALUES
 (1, 1, 1, FALSE, @today - INTERVAL 70 DAY, 'Full body 3x/week, light weights, 20 min cardio. Learn squat and hinge.'),
 (2, 1, 2, FALSE, @today - INTERVAL 40 DAY, 'Upper/lower split. Add progressive overload. Cardio intervals 2x/week.'),
 (3, 1, 3, TRUE,  @today - INTERVAL 23 DAY, 'Push/pull/legs. Heavier compound lifts. Calorie deficit of ~400 kcal.'),
 (4, 2, 1, TRUE,  @today - INTERVAL 30 DAY, 'HIIT circuits 2x/week, low-impact (knee-safe). Daily step goal 9,000.'),
 (5, 3, 1, FALSE, @today - INTERVAL 25 DAY, 'Assessment week: agility ladder, single-leg balance, core.'),
 (6, 3, 2, TRUE,  @today - INTERVAL 5 DAY,  'Plyometrics and sprint drills. Single-leg strength. Core anti-rotation.'),
 (7, 4, 1, TRUE,  @today - INTERVAL 45 DAY, 'Gentle mobility flow, glute and core activation. No loaded spinal flexion.');

-- classes go before PT sessions or the clash trigger wont see them
INSERT INTO ClassSchedule (class_id, trainer_id, class_name, day_of_week, usual_start_time, duration_minutes) VALUES
 (1, 3, 'HIIT Express',    'Tuesday',   '18:00', 20),
 (2, 3, 'HIIT Express',    'Thursday',  '18:00', 20),
 (3, 2, 'Yoga Flow',       'Wednesday', '17:00', 60),
 (4, 1, 'Strength Basics', 'Saturday',  '08:00', 45);

-- class dates for last 2 weeks + next week
INSERT INTO GroupClass (class_id, occurrence_date, start_time)
WITH RECURSIVE days AS (
  SELECT @today - INTERVAL 14 DAY AS d
  UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < @today + INTERVAL 7 DAY)
SELECT c.class_id, days.d, c.usual_start_time
  FROM days JOIN ClassSchedule c ON c.day_of_week = DAYNAME(days.d);

-- attendance for the ones already done
INSERT INTO ClassAttendance (occurrence_id, member_id, status)
SELECT g.occurrence_id, m.member_id,
       CASE WHEN MOD(g.occurrence_id + m.member_id, 9) = 0 THEN 'No-show'
            WHEN MOD(g.occurrence_id + m.member_id, 13) = 0 THEN 'Cancelled'
            ELSE 'Attended' END
  FROM GroupClass g
  JOIN Member m ON m.member_id IN (3, 5, 7, 9, 10, 12)
 WHERE g.occurrence_date < @today
   AND MOD(g.occurrence_id * 7 + m.member_id, 3) <> 0;

-- repeating PT schedules
INSERT INTO SessionSeries (series_id, pt_enrollment_id, trainer_id, days_of_week, time_slot, start_date, end_date, status, created_by, created_at) VALUES
 (1, 1, 1, 'Mon,Wed,Fri', '06:30', @today - INTERVAL 70 DAY, @today + INTERVAL 26 DAY, 'Active', 3, NOW() - INTERVAL 70 DAY),
 (2, 2, 3, 'Tue,Thu',     '07:00', @today - INTERVAL 30 DAY, @today + INTERVAL 60 DAY, 'Active', 3, NOW() - INTERVAL 30 DAY),
 (3, 3, 4, 'Mon,Wed,Fri', '07:30', @today - INTERVAL 25 DAY, @today + INTERVAL 35 DAY, 'Active', 3, NOW() - INTERVAL 25 DAY),
 (4, 4, 2, 'Tue,Thu',     '17:30', @today - INTERVAL 45 DAY, @today + INTERVAL 45 DAY, 'Active', 3, NOW() - INTERVAL 45 DAY);

INSERT INTO Session (pt_enrollment_id, trainer_id, plan_version_id, series_id, is_exception, session_date, time_slot, status)
WITH RECURSIVE days AS (
  SELECT @today - INTERVAL 70 DAY AS d
  UNION ALL SELECT d + INTERVAL 1 DAY FROM days WHERE d < @today + INTERVAL 60 DAY)
SELECT s.pt_enrollment_id, s.trainer_id,
       (SELECT tp.plan_version_id FROM TrainingPlan tp
         WHERE tp.pt_enrollment_id = s.pt_enrollment_id AND tp.created_date <= days.d
         ORDER BY tp.version_number DESC LIMIT 1),
       s.series_id, FALSE, days.d, s.time_slot,
       IF(days.d < @today, 'Completed', 'Scheduled')
  FROM SessionSeries s
  JOIN days ON days.d BETWEEN s.start_date AND s.end_date
 WHERE FIND_IN_SET(DATE_FORMAT(days.d, '%a'), s.days_of_week) > 0
 ORDER BY days.d, s.series_id;

-- aarav missed one last week lol
UPDATE Session SET status = 'No-show'
 WHERE pt_enrollment_id = 1 AND session_date = (
       SELECT d FROM (SELECT MAX(session_date) d FROM Session
                       WHERE pt_enrollment_id = 1 AND session_date < @today - INTERVAL 5 DAY) x);

INSERT INTO Session (pt_enrollment_id, trainer_id, plan_version_id, series_id, is_exception, session_date, time_slot, status)
VALUES (1, 1, 3, NULL, FALSE, @today + INTERVAL 2 DAY, '17:00', 'Requested');

-- change requests (one pending + some old ones)
INSERT INTO SessionChangeRequest (session_id, requested_by, kind, new_date, new_time, note, status, created_at)
SELECT session_id, 9, 'move', session_date, '07:30', 'Office meeting early that day, can we start at 7:30?', 'Pending', NOW() - INTERVAL 3 HOUR
  FROM Session WHERE pt_enrollment_id = 1 AND status = 'Scheduled' AND session_date > @today
 ORDER BY session_date LIMIT 1;

INSERT INTO SessionChangeRequest (session_id, requested_by, kind, new_date, new_time, note, status, created_at, decided_by, decided_at, staff_note)
SELECT session_id, 11, 'move', session_date, '18:00', 'Football practice ran late, could we do the evening instead?', 'Declined',
       TIMESTAMP(session_date) - INTERVAL 1 DAY, 3, TIMESTAMP(session_date) - INTERVAL 20 HOUR, 'Coach Asha is fully booked in the evening that day.'
  FROM Session WHERE pt_enrollment_id = 3 AND status = 'Completed' ORDER BY session_date DESC LIMIT 1;
INSERT INTO SessionChangeRequest (session_id, requested_by, kind, new_date, new_time, note, status, created_at, decided_by, decided_at, staff_note)
SELECT session_id, 10, 'cancel', NULL, NULL, 'Is it okay to train with a mild back spasm today?', 'Answered',
       TIMESTAMP(session_date) - INTERVAL 5 HOUR, 3, TIMESTAMP(session_date) - INTERVAL 4 HOUR, 'Coach Mira will keep it to light mobility work; please come.'
  FROM Session WHERE pt_enrollment_id = 4 AND status = 'Completed' ORDER BY session_date DESC LIMIT 1;

-- trainer switch requests
INSERT INTO TrainerChange (pt_enrollment_id, member_id, from_trainer_id, to_trainer_id, reason_type, reason, status, requested_by, requested_at) VALUES
 (2, 6, 3, 2, 'Schedule doesn''t fit', 'I can only come after 5 PM now because of my new job. Coach Mira has evening slots.', 'Pending', 14, NOW() - INTERVAL 20 HOUR);

INSERT INTO TrainerChange (pt_enrollment_id, member_id, from_trainer_id, to_trainer_id, reason_type, reason, status, requested_by, requested_at, decided_by, decided_at, staff_note) VALUES
 (3, 3, 4, 1, 'Different training style', 'Wanted heavier barbell work for football strength.', 'Declined', 11, NOW() - INTERVAL 12 DAY, 3, NOW() - INTERVAL 11 DAY, 'Coach Rohan has no free morning slots; Asha will add barbell work to the plan.'),
 (4, 2, 2, NULL, 'Schedule doesn''t fit', 'Thought my office hours were changing.', 'Withdrawn', 10, NOW() - INTERVAL 30 DAY, NULL, NULL, NULL);

-- progress: coach logs + aarav's own journal
INSERT INTO ProgressRecord (member_id, source, trainer_id, entered_by, plan_version_id, record_date, weight, strength_metric, notes) VALUES
 (1, 'trainer', 1, 4, 1, @today - INTERVAL 68 DAY, 82.0, 'Squat 40 kg x 8',  'Baseline. Good attitude, form needs work on the squat.'),
 (1, 'trainer', 1, 4, 1, @today - INTERVAL 54 DAY, 81.1, 'Squat 45 kg x 8',  'Knees caving slightly; cue "knees out".'),
 (1, 'member',  NULL, 9, 1, @today - INTERVAL 50 DAY, 80.8, NULL,            'Sleeping better. Cut sugary tea to once a day.'),
 (1, 'trainer', 1, 4, 2, @today - INTERVAL 39 DAY, 80.2, 'Squat 50 kg x 8',  'Started v2 split. Energy good.'),
 (1, 'member',  NULL, 9, 2, @today - INTERVAL 32 DAY, 79.6, NULL,            'Ate out twice this week but stayed on track.'),
 (1, 'trainer', 1, 4, 2, @today - INTERVAL 26 DAY, 79.0, 'Squat 55 kg x 8',  'New best on squat. Very happy with progress.'),
 (1, 'trainer', 1, 4, 3, @today - INTERVAL 19 DAY, 78.3, 'Squat 60 kg x 6',  'Moved to v3 (push/pull/legs).'),
 (1, 'member',  NULL, 9, 3, @today - INTERVAL 12 DAY, 77.8, NULL,            'Meal-prepped lunches for the whole week.'),
 (1, 'trainer', 1, 4, 3, @today - INTERVAL 5 DAY,  77.2, 'Squat 65 kg x 6',  'Consistent. Keep the deficit, add one more cardio day.'),
 (1, 'member',  NULL, 9, 3, @today - INTERVAL 1 DAY,  76.9, NULL,            'Down 5 kg since I joined!'),
 (6, 'trainer', 3, 6, 4, @today - INTERVAL 28 DAY, 68.5, 'Plank 45 s',       'Baseline. Knee-safe variations only.'),
 (6, 'trainer', 3, 6, 4, @today - INTERVAL 14 DAY, 67.4, 'Plank 70 s',       'Good effort; finishing circuits now.'),
 (3, 'trainer', 4, 7, 5, @today - INTERVAL 24 DAY, 72.0, 'Vertical jump 48 cm', 'Assessment done.'),
 (3, 'trainer', 4, 7, 6, @today - INTERVAL 4 DAY,  72.4, 'Vertical jump 52 cm', 'Explosiveness improving.'),
 (2, 'trainer', 2, 5, 7, @today - INTERVAL 40 DAY, 61.0, 'Toe touch: 10 cm short', 'Back pain 6/10 at start.'),
 (2, 'trainer', 2, 5, 7, @today - INTERVAL 10 DAY, 60.4, 'Toe touch: reached',     'Back pain down to 2/10.');

-- payments (owed is worked out in v_dues, not here)
INSERT INTO Payment (payment_id, member_id, membership_id, pt_enrollment_id, amount, payment_date, method, status, void_reason, voided_by, recorded_by) VALUES
 (1,  1,  1,    NULL, 2500.00,  @today - INTERVAL 70 DAY,  'Cash',           'valid', NULL, NULL, 3),
 (2,  1,  NULL, 1,    7500.00,  @today - INTERVAL 70 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3),
 (3,  1,  NULL, 1,    7500.00,  @today - INTERVAL 40 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3),
 (4,  2,  2,    NULL, 28000.00, @today - INTERVAL 200 DAY, 'Bank Transfer',  'valid', NULL, NULL, 2),
 (5,  2,  NULL, 4,    10000.00, @today - INTERVAL 45 DAY,  'Card',           'valid', NULL, NULL, 3),
 (6,  3,  3,    NULL, 3000.00,  @today - INTERVAL 25 DAY,  'Cash',           'valid', NULL, NULL, 3),
 (7,  3,  NULL, 3,    12000.00, @today - INTERVAL 25 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3),
 (8,  4,  4,    NULL, 8000.00,  @today - INTERVAL 85 DAY,  'Cash',           'valid', NULL, NULL, 3),
 (9,  5,  5,    NULL, 3000.00,  @today - INTERVAL 40 DAY,  'Cash',           'valid', NULL, NULL, 3),
 (10, 6,  6,    NULL, 4000.00,  @today - INTERVAL 30 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3),
 (11, 6,  NULL, 2,    6000.00,  @today - INTERVAL 30 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3),
 (12, 7,  7,    NULL, 14000.00, @today - INTERVAL 10 DAY,  'Card',           'valid', NULL, NULL, 3),
 (13, 8,  8,    NULL, 1500.00,  @today - INTERVAL 5 DAY,   'Cash',           'valid', NULL, NULL, 3),
 (14, 9,  9,    NULL, 8000.00,  @today - INTERVAL 60 DAY,  'Bank Transfer',  'valid', NULL, NULL, 2),
 (15, 10, 10,   NULL, 3000.00,  @today - INTERVAL 20 DAY,  'Cash',           'valid', NULL, NULL, 3),
 (16, 10, 10,   NULL, 3000.00,  @today - INTERVAL 20 DAY,  'Cash',           'void',  'Entered twice by mistake: only one receipt was issued.', 2, 3),
 (17, 11, 11,   NULL, 28000.00, @today - INTERVAL 300 DAY, 'Bank Transfer',  'valid', NULL, NULL, 2),
 (18, 12, 12,   NULL, 5000.00,  @today - INTERVAL 15 DAY,  'Mobile Banking', 'valid', NULL, NULL, 3);

-- people training right now
INSERT INTO CheckIn (member_id, check_in_time, check_out_time) VALUES
 (1,  NOW() - INTERVAL 50 MINUTE,  NULL),
 (3,  NOW() - INTERVAL 35 MINUTE,  NULL),
 (7,  NOW() - INTERVAL 80 MINUTE,  NULL),
 (9,  NOW() - INTERVAL 20 MINUTE,  NULL),
 (12, NOW() - INTERVAL 10 MINUTE,  NULL),
 (4,  NOW() - INTERVAL 150 MINUTE, NOW() - INTERVAL 70 MINUTE),
 (2,  NOW() - INTERVAL 1 DAY - INTERVAL 2 HOUR, NOW() - INTERVAL 1 DAY - INTERVAL 1 HOUR),
 (5,  NOW() - INTERVAL 1 DAY - INTERVAL 3 HOUR, NOW() - INTERVAL 1 DAY - INTERVAL 2 HOUR),
 (10, NOW() - INTERVAL 2 DAY - INTERVAL 1 HOUR, NOW() - INTERVAL 2 DAY);

-- one overdue, one due soon for testing
INSERT INTO Equipment (name, category, quantity, last_service_date, next_service_due) VALUES
 ('Treadmill',           'Cardio',       6,  @today - INTERVAL 60 DAY,  @today + INTERVAL 30 DAY),
 ('Spin bike',           'Cardio',       8,  @today - INTERVAL 95 DAY,  @today - INTERVAL 5 DAY),
 ('Rowing machine',      'Cardio',       3,  @today - INTERVAL 80 DAY,  @today + INTERVAL 10 DAY),
 ('Squat rack',          'Strength',     4,  @today - INTERVAL 40 DAY,  @today + INTERVAL 50 DAY),
 ('Cable crossover',     'Strength',     2,  @today - INTERVAL 30 DAY,  @today + INTERVAL 60 DAY),
 ('Dumbbell set 2-40kg', 'Free Weights', 1,  @today - INTERVAL 20 DAY,  @today + INTERVAL 70 DAY),
 ('Olympic barbell',     'Free Weights', 10, @today - INTERVAL 50 DAY,  @today + INTERVAL 40 DAY),
 ('Kettlebells',         'Accessories',  20, @today - INTERVAL 10 DAY,  @today + INTERVAL 80 DAY);

INSERT INTO Announcement (title, body, image_path, tag, posted_date, posted_by, is_published) VALUES
 ('New HIIT Express class', 'Twenty minutes, twice a week: Tuesday and Thursday at 6 PM with Coach Suman.', 'uploads/hiit.jpg', 'Class', @today - INTERVAL 2 DAY, 3, TRUE),
 ('Dashain offer',          '10% off any quarterly or annual plan until the end of the month.',            'uploads/offer.jpg', 'Offer', @today - INTERVAL 5 DAY, 1, TRUE),
 ('Spin bikes in service',  'Spin bikes are being serviced this week. Treadmills and rowers are free.',    NULL,                'Announcement', @today, 3, TRUE);

-- homepage enquiries
INSERT INTO `Lead` (name, contact, interest, message, submitted_date, status) VALUES
 ('Reena Thapa',  '9803000055', 'Gym membership', NULL,                              NOW() - INTERVAL 65 MINUTE, 'New'),
 ('Amit Karki',   '9860000010', 'A free tour',    'Can I come on Saturday morning?', NOW() - INTERVAL 26 HOUR,   'Contacted'),
 ('Puja Rai',     '9818000077', 'Group classes',  'Interested in yoga only.',        NOW() - INTERVAL 50 HOUR,   'New'),
 ('Suresh Malla', '9849000002', 'Gym membership', 'Price for 6 months?',             NOW() - INTERVAL 6 DAY,     'Contacted');

-- some log + notification rows
INSERT INTO AuditLog (user_id, action, table_name, record_id, old_values, new_values, reason, created_at) VALUES
 (3, 'create', 'Member',  12, NULL, JSON_OBJECT('name', 'Dipesh Shah'), NULL, NOW() - INTERVAL 15 DAY),
 (2, 'update', 'Payment', 8,  JSON_OBJECT('amount', 8500), JSON_OBJECT('amount', 8000), 'Typo at the desk: the paper receipt shows the lower amount.', NOW() - INTERVAL 5 DAY),
 (2, 'void',   'Payment', 16, JSON_OBJECT('status', 'valid'), JSON_OBJECT('status', 'void'), 'Entered twice by mistake: only one receipt was issued.', NOW() - INTERVAL 19 DAY);

INSERT INTO Notification (user_id, title, body, link, created_at, read_at) VALUES
 (9,  'Your training schedule is set', 'Mon, Wed, Fri at 6:30 AM with Rohan Tamang.', '#/me/sessions', NOW() - INTERVAL 3 DAY, NULL),
 (14, 'Trainer change request received', 'The front desk will reply within a day.', '#/me/profile', NOW() - INTERVAL 20 HOUR, NOW() - INTERVAL 19 HOUR),
 (4,  'Session change request', 'Aarav Shrestha asked to move his next session to 7:30 AM.', '#/clients', NOW() - INTERVAL 3 HOUR, NULL);

COMMIT;
