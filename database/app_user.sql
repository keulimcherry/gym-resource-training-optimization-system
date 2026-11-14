-- the user our website logs in with. CHANGE THE PASSWORD first!!
-- run as root after schema.sql
-- it cant drop tables or make users, and cant delete payments or the audit log
DROP USER IF EXISTS 'moksha_app'@'localhost';
CREATE USER 'moksha_app'@'localhost' IDENTIFIED BY 'CHANGE_ME_to_a_long_random_password';

-- money + history tables: no delete
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.Payment                    TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT                 ON moksha_fitness.AuditLog                   TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.Member                     TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.Membership                 TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.PersonalTrainingEnrollment TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.TrainingPlan               TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.ProgressRecord             TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.TrainerChange              TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.`User`                     TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.MembershipPlan             TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE         ON moksha_fitness.Trainer                    TO 'moksha_app'@'localhost';

-- everyday tables, full access
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.Session                    TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.SessionSeries              TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.SessionChangeRequest       TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.ClassSchedule              TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.GroupClass                 TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.ClassAttendance            TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.CheckIn                    TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.Equipment                  TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.Announcement               TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.`Lead`                     TO 'moksha_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON moksha_fitness.Notification               TO 'moksha_app'@'localhost';

-- views are read only
GRANT SELECT ON moksha_fitness.v_dues          TO 'moksha_app'@'localhost';
GRANT SELECT ON moksha_fitness.v_member_dues   TO 'moksha_app'@'localhost';
GRANT SELECT ON moksha_fitness.v_member_status TO 'moksha_app'@'localhost';
GRANT SELECT ON moksha_fitness.v_training_now  TO 'moksha_app'@'localhost';
