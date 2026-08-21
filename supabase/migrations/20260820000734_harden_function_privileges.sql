-- Kijamii Prism: address the database linter's function findings.

-- 1. admin_email had a mutable search_path.
create or replace function public.admin_email()
returns text
language sql
immutable
set search_path = ''
as $$ select 'noorhussam.nh@gmail.com'::text $$;

-- 2. Trigger functions must never be reachable as PostgREST RPC endpoints.
--    Postgres grants EXECUTE to PUBLIC by default, so revoking from anon and
--    authenticated alone would leave the grant intact through PUBLIC.
revoke all on function public.handle_new_user()  from public, anon, authenticated;
revoke all on function public.guard_role_change() from public, anon, authenticated;

-- 3. is_admin() is referenced by RLS policies, which are evaluated with the
--    privileges of the querying role -- so `authenticated` genuinely needs
--    EXECUTE and the linter's 0029 warning is expected here. The function
--    reports only on the caller's own row, so it leaks nothing. Signed-out
--    visitors have no reason to call it.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- admin_email() is a constant used by server-side code paths only.
revoke all on function public.admin_email() from public, anon, authenticated;
