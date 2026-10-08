-- Read-only business queries and executable checks for key constraints.
-- Execute after 001_schema.sql and 002_seed.sql.

SET search_path TO trip_mgmt, public;

-- Q1. Requests waiting for a specific approver.
SELECT
    tr.id,
    tr.destination,
    tr.starts_on,
    tr.ends_on,
    creator.full_name AS created_by,
    a.step_no
FROM approval_steps a
JOIN trip_requests tr ON tr.id = a.request_id
JOIN users creator ON creator.id = tr.created_by_user_id
JOIN users approver ON approver.id = a.approver_user_id
WHERE a.decision = 'pending'
  AND approver.email = 'elena.sokolova@example.test'
ORDER BY tr.starts_on;

-- Expected: one request to Saint Petersburg, step 1.

-- Q2. Participants and estimated total for every request.
SELECT
    tr.id,
    tr.destination,
    string_agg(u.full_name, ', ' ORDER BY u.full_name) AS participants,
    totals.estimated_total_rub
FROM trip_requests tr
JOIN trip_participants tp ON tp.request_id = tr.id
JOIN users u ON u.id = tp.user_id
JOIN v_trip_request_totals totals ON totals.request_id = tr.id
GROUP BY tr.id, tr.destination, totals.estimated_total_rub
ORDER BY tr.id;

-- Expected: one participant and total 46000.00 RUB.

-- Q3. Full status history of a request.
SELECT
    h.request_id,
    h.from_status,
    h.to_status,
    actor.full_name AS changed_by,
    h.changed_at,
    h.comment
FROM trip_status_history h
JOIN users actor ON actor.id = h.changed_by_user_id
ORDER BY h.request_id, h.changed_at;

-- Expected: draft -> submitted -> in_approval in chronological order.

-- C1. An end date before the start date must be rejected.
DO $$
DECLARE
    v_user_id bigint;
    v_department_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM users WHERE email = 'ivan.petrov@example.test';
    SELECT department_id INTO v_department_id
      FROM employee_profiles WHERE user_id = v_user_id;

    BEGIN
        INSERT INTO trip_requests (
            created_by_user_id, department_id, destination,
            starts_on, ends_on, purpose, transport_type,
            funding_source, status
        ) VALUES (
            v_user_id, v_department_id, 'Тест',
            DATE '2026-10-10', DATE '2026-10-09',
            'Проверка ограничения на даты', 'rail',
            'Тест', 'draft'
        );
        RAISE EXCEPTION 'C1 FAILED: invalid dates were accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'C1 PASS: invalid dates rejected';
    END;
END;
$$;

-- C2. A second primary participant for one request must be rejected.
DO $$
DECLARE
    v_request_id bigint;
    v_second_user_id bigint;
BEGIN
    SELECT id INTO v_request_id
      FROM trip_requests WHERE destination = 'Санкт-Петербург';
    SELECT id INTO v_second_user_id
      FROM users WHERE email = 'elena.sokolova@example.test';

    BEGIN
        INSERT INTO trip_participants (request_id, user_id, is_primary)
        VALUES (v_request_id, v_second_user_id, true);
        RAISE EXCEPTION 'C2 FAILED: second primary participant was accepted';
    EXCEPTION
        WHEN unique_violation THEN
            RAISE NOTICE 'C2 PASS: second primary participant rejected';
    END;
END;
$$;

-- C3. A rejected approval without a meaningful comment must be rejected.
DO $$
DECLARE
    v_request_id bigint;
    v_approver_id bigint;
BEGIN
    SELECT id INTO v_request_id
      FROM trip_requests WHERE destination = 'Санкт-Петербург';
    SELECT id INTO v_approver_id
      FROM users WHERE email = 'maria.volkova@example.test';

    BEGIN
        INSERT INTO approval_steps (
            request_id, step_no, approver_user_id,
            decision, decision_comment, decided_at
        ) VALUES (
            v_request_id, 99, v_approver_id,
            'rejected', 'нет', current_timestamp
        );
        RAISE EXCEPTION 'C3 FAILED: short rejection comment was accepted';
    EXCEPTION
        WHEN check_violation THEN
            RAISE NOTICE 'C3 PASS: short rejection comment rejected';
    END;
END;
$$;

-- C4. Verify the number of seeded records needed by the demo scenario.
DO $$
DECLARE
    v_requests integer;
    v_participants integer;
    v_estimates integer;
    v_approvals integer;
BEGIN
    SELECT count(*) INTO v_requests FROM trip_requests;
    SELECT count(*) INTO v_participants FROM trip_participants;
    SELECT count(*) INTO v_estimates FROM expense_estimates;
    SELECT count(*) INTO v_approvals FROM approval_steps;

    IF (v_requests, v_participants, v_estimates, v_approvals) <> (1, 1, 3, 2) THEN
        RAISE EXCEPTION
            'C4 FAILED: unexpected counts (%, %, %, %)',
            v_requests, v_participants, v_estimates, v_approvals;
    END IF;

    RAISE NOTICE 'C4 PASS: seeded record counts are correct';
END;
$$;
