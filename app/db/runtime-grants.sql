-- Optional. Execute only as the database owner after inspecting the actual schema.
-- Create a runtime login separately with your own password.
-- Replace schema "public" if your application tables use another schema.
-- Grant group trip_runtime to the runtime login, not to the migration owner.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='trip_runtime') THEN
    CREATE ROLE trip_runtime NOLOGIN;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO trip_runtime;
GRANT SELECT ON public.users,public.roles,public.user_roles,public.departments,
  public.employees,public.expense_categories TO trip_runtime;
GRANT SELECT,INSERT,UPDATE ON public.trips,public.travel_requests,
  public.approval_steps,public.expense_estimates TO trip_runtime;
GRANT DELETE ON public.expense_estimates TO trip_runtime;
GRANT SELECT,INSERT ON public.request_status_history TO trip_runtime;
-- Narrow these to sequences of the writable tables in a shared schema.
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO trip_runtime;
