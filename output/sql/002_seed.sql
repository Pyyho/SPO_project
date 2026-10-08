-- Development and demonstration data only.
-- Execute after 001_schema.sql on a disposable database.

BEGIN;
SET search_path TO trip_mgmt, public;

TRUNCATE TABLE
    trip_status_history,
    attachments,
    approval_steps,
    expense_estimates,
    trip_participants,
    trip_requests,
    employee_profiles,
    user_roles,
    departments,
    users,
    roles
RESTART IDENTITY CASCADE;

INSERT INTO roles (code, name) VALUES
    ('employee', 'Сотрудник'),
    ('manager', 'Руководитель'),
    ('coordinator', 'Координатор поездок'),
    ('accountant', 'Бухгалтер'),
    ('admin', 'Администратор');

INSERT INTO departments (code, name) VALUES
    ('DEV', 'Отдел разработки'),
    ('FIN', 'Финансовый отдел'),
    ('ADM', 'Административный отдел');

-- The hashes are synthetic values for schema tests. The application must create real
-- bcrypt or Argon2id hashes before authentication is implemented.
INSERT INTO users (email, password_hash, full_name) VALUES
    ('ivan.petrov@example.test', '$2b$12$schemaTestHashOnly000000000000000000000000000000000', 'Иван Петров'),
    ('elena.sokolova@example.test', '$2b$12$schemaTestHashOnly000000000000000000000000000000001', 'Елена Соколова'),
    ('maria.volkova@example.test', '$2b$12$schemaTestHashOnly000000000000000000000000000000002', 'Мария Волкова'),
    ('olga.morozova@example.test', '$2b$12$schemaTestHashOnly000000000000000000000000000000003', 'Ольга Морозова'),
    ('admin@example.test', '$2b$12$schemaTestHashOnly000000000000000000000000000000004', 'Администратор Системы');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM (VALUES
    ('ivan.petrov@example.test', 'employee'),
    ('elena.sokolova@example.test', 'employee'),
    ('elena.sokolova@example.test', 'manager'),
    ('maria.volkova@example.test', 'coordinator'),
    ('olga.morozova@example.test', 'accountant'),
    ('admin@example.test', 'admin')
) AS x(email, role_code)
JOIN users u ON u.email = x.email
JOIN roles r ON r.code = x.role_code;

INSERT INTO employee_profiles (
    user_id, department_id, personnel_no, position_title, manager_user_id
)
SELECT
    u.id,
    d.id,
    x.personnel_no,
    x.position_title,
    m.id
FROM (VALUES
    ('ivan.petrov@example.test', 'DEV', 'T-001', 'Разработчик', 'elena.sokolova@example.test'),
    ('elena.sokolova@example.test', 'DEV', 'T-002', 'Руководитель отдела', NULL),
    ('maria.volkova@example.test', 'ADM', 'T-003', 'Координатор поездок', NULL),
    ('olga.morozova@example.test', 'FIN', 'T-004', 'Бухгалтер', NULL)
) AS x(email, department_code, personnel_no, position_title, manager_email)
JOIN users u ON u.email = x.email
JOIN departments d ON d.code = x.department_code
LEFT JOIN users m ON m.email = x.manager_email;

WITH created AS (
    INSERT INTO trip_requests (
        created_by_user_id, department_id, destination, starts_on, ends_on,
        purpose, transport_type, funding_source, status, submitted_at
    )
    SELECT
        u.id, d.id, 'Санкт-Петербург', DATE '2026-10-12', DATE '2026-10-15',
        'Участие в рабочей встрече с заказчиком по проекту',
        'rail', 'Бюджет проекта CPO-26', 'in_approval',
        TIMESTAMPTZ '2026-09-23 09:30:00+03'
    FROM users u
    JOIN employee_profiles ep ON ep.user_id = u.id
    JOIN departments d ON d.id = ep.department_id
    WHERE u.email = 'ivan.petrov@example.test'
    RETURNING id, created_by_user_id
)
INSERT INTO trip_participants (request_id, user_id, is_primary)
SELECT id, created_by_user_id, true FROM created;

INSERT INTO expense_estimates (request_id, category, description, amount, currency)
SELECT tr.id, x.category, x.description, x.amount, 'RUB'
FROM trip_requests tr
CROSS JOIN (VALUES
    ('transport', 'Железнодорожные билеты туда и обратно', 18000.00::numeric),
    ('hotel', 'Проживание 3 ночи', 24000.00::numeric),
    ('per_diem', 'Суточные за 4 дня', 4000.00::numeric)
) AS x(category, description, amount)
WHERE tr.destination = 'Санкт-Петербург';

INSERT INTO approval_steps (request_id, step_no, approver_user_id)
SELECT tr.id, 1, u.id
FROM trip_requests tr
JOIN users u ON u.email = 'elena.sokolova@example.test'
WHERE tr.destination = 'Санкт-Петербург';

INSERT INTO approval_steps (request_id, step_no, approver_user_id)
SELECT tr.id, 2, u.id
FROM trip_requests tr
JOIN users u ON u.email = 'olga.morozova@example.test'
WHERE tr.destination = 'Санкт-Петербург';

INSERT INTO trip_status_history (
    request_id, from_status, to_status, changed_by_user_id, changed_at, comment
)
SELECT tr.id, NULL, 'draft', tr.created_by_user_id,
       TIMESTAMPTZ '2026-09-23 09:00:00+03', 'Создан черновик'
FROM trip_requests tr
WHERE tr.destination = 'Санкт-Петербург';

INSERT INTO trip_status_history (
    request_id, from_status, to_status, changed_by_user_id, changed_at, comment
)
SELECT tr.id, 'draft', 'submitted', tr.created_by_user_id,
       TIMESTAMPTZ '2026-09-23 09:30:00+03', 'Заявка отправлена'
FROM trip_requests tr
WHERE tr.destination = 'Санкт-Петербург';

INSERT INTO trip_status_history (
    request_id, from_status, to_status, changed_by_user_id, changed_at, comment
)
SELECT tr.id, 'submitted', 'in_approval', tr.created_by_user_id,
       TIMESTAMPTZ '2026-09-23 09:31:00+03', 'Сформирован маршрут согласования'
FROM trip_requests tr
WHERE tr.destination = 'Санкт-Петербург';

COMMIT;
