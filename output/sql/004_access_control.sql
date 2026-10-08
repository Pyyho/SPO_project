-- Run as a database owner or administrator after 001_schema.sql.
-- Role creation is intentionally separated from the schema migration because
-- managed PostgreSQL services often create login roles outside application migrations.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trip_app') THEN
        CREATE ROLE trip_app NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'trip_auditor') THEN
        CREATE ROLE trip_auditor NOLOGIN;
    END IF;
END;
$$;

GRANT USAGE ON SCHEMA trip_mgmt TO trip_app, trip_auditor;

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA trip_mgmt
TO trip_app;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA trip_mgmt
TO trip_app;

GRANT SELECT
ON ALL TABLES IN SCHEMA trip_mgmt
TO trip_auditor;

ALTER DEFAULT PRIVILEGES IN SCHEMA trip_mgmt
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO trip_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA trip_mgmt
GRANT USAGE, SELECT ON SEQUENCES TO trip_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA trip_mgmt
GRANT SELECT ON TABLES TO trip_auditor;
