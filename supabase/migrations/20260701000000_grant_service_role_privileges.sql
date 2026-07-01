-- ============================================================
-- Grant table privileges to service_role
-- ============================================================
-- The tables were created without the standard Supabase grants,
-- so service_role (used by the server-side admin client) had no
-- SELECT/INSERT/UPDATE/DELETE. Even though service_role has
-- BYPASSRLS, that only skips RLS policies — it does NOT replace a
-- missing table-level GRANT, so PostgREST rejected every request
-- with 403 "permission denied for table ...".
--
-- We grant only to service_role. anon/authenticated are intentionally
-- left without DML because RLS is disabled on these tables; granting
-- them would expose every row to anyone holding the publishable key.
-- The app accesses the database exclusively through the service-role
-- admin client.

grant usage on schema public to service_role;

grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Ensure future objects created by the migration owner are also granted.
alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;
