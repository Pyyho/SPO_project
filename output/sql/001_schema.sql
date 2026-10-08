-- PostgreSQL 15+
-- Project: Service trip management system
-- Creates the physical schema developed in practical work 4.

BEGIN;

CREATE SCHEMA IF NOT EXISTS trip_mgmt;
SET search_path TO trip_mgmt, public;

CREATE TABLE roles (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            varchar(32) NOT NULL UNIQUE,
    name            varchar(100) NOT NULL UNIQUE,
    CONSTRAINT ck_roles_code CHECK (code ~ '^[a-z][a-z0-9_]{2,31}$')
);

CREATE TABLE users (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email           varchar(254) NOT NULL,
    password_hash   varchar(255) NOT NULL,
    full_name       varchar(200) NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    created_at      timestamptz NOT NULL DEFAULT current_timestamp,
    updated_at      timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_users_email CHECK (position('@' IN email) > 1),
    CONSTRAINT ck_users_full_name CHECK (length(btrim(full_name)) >= 3)
);

CREATE UNIQUE INDEX ux_users_email_ci ON users (lower(email));

CREATE TABLE departments (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            varchar(20) NOT NULL UNIQUE,
    name            varchar(160) NOT NULL UNIQUE,
    is_active       boolean NOT NULL DEFAULT true
);

CREATE TABLE user_roles (
    user_id         bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id         bigint NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    assigned_at     timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE employee_profiles (
    user_id         bigint PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    department_id   bigint NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    personnel_no    varchar(30) NOT NULL UNIQUE,
    position_title  varchar(160) NOT NULL,
    manager_user_id bigint NULL REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT ck_employee_manager CHECK (manager_user_id IS NULL OR manager_user_id <> user_id)
);

CREATE TABLE trip_requests (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_by_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    department_id       bigint NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    destination         varchar(200) NOT NULL,
    starts_on           date NOT NULL,
    ends_on             date NOT NULL,
    purpose             text NOT NULL,
    transport_type      varchar(20) NOT NULL,
    funding_source      varchar(160) NOT NULL,
    status              varchar(24) NOT NULL DEFAULT 'draft',
    created_at          timestamptz NOT NULL DEFAULT current_timestamp,
    submitted_at        timestamptz NULL,
    updated_at          timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_trip_dates CHECK (ends_on >= starts_on),
    CONSTRAINT ck_trip_duration CHECK (ends_on <= starts_on + 180),
    CONSTRAINT ck_trip_destination CHECK (length(btrim(destination)) >= 2),
    CONSTRAINT ck_trip_purpose CHECK (length(btrim(purpose)) >= 10),
    CONSTRAINT ck_trip_transport CHECK (transport_type IN ('air', 'rail', 'car', 'bus', 'other')),
    CONSTRAINT ck_trip_status CHECK (status IN (
        'draft', 'submitted', 'in_approval', 'approved',
        'rejected', 'cancelled', 'completed'
    )),
    CONSTRAINT ck_trip_submission CHECK (
        (status = 'draft' AND submitted_at IS NULL)
        OR (status <> 'draft' AND submitted_at IS NOT NULL)
    )
);

CREATE TABLE trip_participants (
    request_id      bigint NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    user_id         bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    is_primary      boolean NOT NULL DEFAULT false,
    added_at        timestamptz NOT NULL DEFAULT current_timestamp,
    PRIMARY KEY (request_id, user_id)
);

CREATE UNIQUE INDEX ux_trip_one_primary_participant
    ON trip_participants (request_id)
    WHERE is_primary;

CREATE TABLE expense_estimates (
    id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id      bigint NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    category        varchar(24) NOT NULL,
    description     varchar(300) NULL,
    amount          numeric(12,2) NOT NULL,
    currency        char(3) NOT NULL DEFAULT 'RUB',
    CONSTRAINT ck_expense_category CHECK (category IN (
        'transport', 'hotel', 'per_diem', 'visa', 'other'
    )),
    CONSTRAINT ck_expense_amount CHECK (amount >= 0),
    CONSTRAINT ck_expense_currency CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TABLE approval_steps (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id          bigint NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    step_no             smallint NOT NULL,
    approver_user_id    bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision            varchar(16) NOT NULL DEFAULT 'pending',
    decision_comment    varchar(1000) NULL,
    decided_at          timestamptz NULL,
    created_at          timestamptz NOT NULL DEFAULT current_timestamp,
    UNIQUE (request_id, step_no),
    CONSTRAINT ck_approval_step_no CHECK (step_no > 0),
    CONSTRAINT ck_approval_decision CHECK (decision IN ('pending', 'approved', 'rejected')),
    CONSTRAINT ck_approval_state CHECK (
        (decision = 'pending' AND decided_at IS NULL)
        OR (decision <> 'pending' AND decided_at IS NOT NULL)
    ),
    CONSTRAINT ck_approval_comment CHECK (
        decision <> 'rejected' OR length(btrim(decision_comment)) >= 5
    )
);

CREATE TABLE attachments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id          bigint NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    uploaded_by_user_id bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name           varchar(255) NOT NULL,
    storage_key         varchar(500) NOT NULL UNIQUE,
    mime_type           varchar(120) NOT NULL,
    size_bytes          bigint NOT NULL,
    uploaded_at         timestamptz NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_attachment_size CHECK (size_bytes > 0 AND size_bytes <= 10485760)
);

CREATE TABLE trip_status_history (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id          bigint NOT NULL REFERENCES trip_requests(id) ON DELETE CASCADE,
    from_status         varchar(24) NULL,
    to_status           varchar(24) NOT NULL,
    changed_by_user_id  bigint NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    changed_at          timestamptz NOT NULL DEFAULT current_timestamp,
    comment             varchar(1000) NULL,
    CONSTRAINT ck_history_from_status CHECK (
        from_status IS NULL OR from_status IN (
            'draft', 'submitted', 'in_approval', 'approved',
            'rejected', 'cancelled', 'completed'
        )
    ),
    CONSTRAINT ck_history_to_status CHECK (to_status IN (
        'draft', 'submitted', 'in_approval', 'approved',
        'rejected', 'cancelled', 'completed'
    )),
    CONSTRAINT ck_history_change CHECK (from_status IS NULL OR from_status <> to_status)
);

CREATE INDEX ix_employee_profiles_department ON employee_profiles (department_id);
CREATE INDEX ix_employee_profiles_manager ON employee_profiles (manager_user_id);
CREATE INDEX ix_trip_requests_creator ON trip_requests (created_by_user_id);
CREATE INDEX ix_trip_requests_department_status ON trip_requests (department_id, status);
CREATE INDEX ix_trip_requests_dates ON trip_requests (starts_on, ends_on);
CREATE INDEX ix_trip_participants_user ON trip_participants (user_id);
CREATE INDEX ix_expense_estimates_request ON expense_estimates (request_id);
CREATE INDEX ix_approval_pending_by_user
    ON approval_steps (approver_user_id, request_id)
    WHERE decision = 'pending';
CREATE INDEX ix_attachments_request ON attachments (request_id);
CREATE INDEX ix_status_history_request_time
    ON trip_status_history (request_id, changed_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := current_timestamp;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_trip_requests_updated_at
BEFORE UPDATE ON trip_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE VIEW v_trip_request_totals AS
SELECT
    tr.id AS request_id,
    tr.status,
    tr.destination,
    tr.starts_on,
    tr.ends_on,
    COALESCE(sum(ee.amount) FILTER (WHERE ee.currency = 'RUB'), 0)::numeric(12,2)
        AS estimated_total_rub
FROM trip_requests tr
LEFT JOIN expense_estimates ee ON ee.request_id = tr.id
GROUP BY tr.id, tr.status, tr.destination, tr.starts_on, tr.ends_on;

COMMIT;
