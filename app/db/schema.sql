-- Only for a NEW, EMPTY educational database.
-- The screenshot provides field names/types and links, but does not show all
-- CHECK constraints, defaults, unique indexes or enum values.
-- Do not apply this file to your existing database.
BEGIN;
CREATE TABLE departments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name varchar(150) NOT NULL UNIQUE
);
CREATE TABLE users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email varchar(254) NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_ci ON users(lower(email));
CREATE TABLE roles (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(100) NOT NULL
);
CREATE TABLE user_roles (
  user_id bigint NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id smallint NOT NULL REFERENCES roles(id),
  PRIMARY KEY(user_id, role_id)
);
CREATE TABLE employees (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id bigint NOT NULL UNIQUE REFERENCES users(id),
  department_id bigint NOT NULL REFERENCES departments(id),
  employee_number varchar(30) NOT NULL UNIQUE,
  full_name varchar(200) NOT NULL,
  position varchar(150) NOT NULL,
  phone varchar(30),
  hire_date date NOT NULL
);
CREATE TABLE trips (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  destination_country varchar(100) NOT NULL,
  destination_city varchar(120) NOT NULL,
  purpose text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  transport_type varchar(20) NOT NULL,
  accommodation_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(end_date >= start_date)
);
CREATE TABLE travel_requests (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  number varchar(30) NOT NULL UNIQUE,
  employee_id bigint NOT NULL REFERENCES employees(id),
  trip_id bigint NOT NULL UNIQUE REFERENCES trips(id),
  status varchar(20) NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','submitted','in_approval','approved','rejected','completed')),
  estimated_total numeric(14,2) NOT NULL DEFAULT 0 CHECK(estimated_total >= 0),
  currency char(3) NOT NULL DEFAULT 'RUB' CHECK(currency ~ '^[A-Z]{3}$'),
  employee_comment text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1 CHECK(version >= 1)
);
CREATE TABLE request_status_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES travel_requests(id),
  old_status varchar(20),
  new_status varchar(20) NOT NULL,
  changed_by_employee_id bigint NOT NULL REFERENCES employees(id),
  comment text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE approval_steps (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES travel_requests(id),
  step_order smallint NOT NULL CHECK(step_order > 0),
  approver_employee_id bigint NOT NULL REFERENCES employees(id),
  status varchar(20) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  decision_comment text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id,step_order),
  CHECK(status <> 'rejected' OR (decision_comment IS NOT NULL AND length(trim(decision_comment)) >= 5))
);
CREATE TABLE expense_categories (
  id smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code varchar(30) NOT NULL UNIQUE,
  name varchar(120) NOT NULL
);
CREATE TABLE expense_estimates (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id bigint NOT NULL REFERENCES travel_requests(id),
  category_id smallint NOT NULL REFERENCES expense_categories(id),
  amount numeric(14,2) NOT NULL CHECK(amount >= 0),
  description varchar(300)
);
CREATE INDEX requests_employee_status ON travel_requests(employee_id,status);
CREATE INDEX approval_employee_status ON approval_steps(approver_employee_id,status);
CREATE INDEX history_request_time ON request_status_history(request_id,changed_at,id);
CREATE INDEX expenses_request ON expense_estimates(request_id);
COMMIT;
