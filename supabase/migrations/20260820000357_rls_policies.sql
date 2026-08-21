-- Kijamii Prism: Row Level Security. This is the only thing standing between
-- the publishable key (which ships in client JS) and the data.

-- Reading profiles from inside a profiles policy would recurse. A SECURITY
-- DEFINER function is owned by postgres and bypasses RLS on its own read,
-- which breaks the cycle.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  );
$$;

-- Attribute new rows to their creator without trusting the client to send it.
alter table public.clients  alter column created_by set default auth.uid();
alter table public.projects alter column owner_id   set default auth.uid();

alter table public.profiles enable row level security;
alter table public.clients  enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

-- ---------------------------------------------------------------- profiles --
-- No INSERT policy: handle_new_user() is SECURITY DEFINER and bypasses RLS,
-- so profile creation stays entirely server-side.

create policy "profiles_select_own_or_admin"
  on public.profiles for select to authenticated
  using ( id = (select auth.uid()) or public.is_admin() );

create policy "profiles_update_own_or_admin"
  on public.profiles for update to authenticated
  using      ( id = (select auth.uid()) or public.is_admin() )
  with check ( id = (select auth.uid()) or public.is_admin() );

create policy "profiles_delete_admin"
  on public.profiles for delete to authenticated
  using ( public.is_admin() );

-- The update policy above lets a member edit their own row, which would
-- otherwise let them set role = 'admin'. Guard the column itself.
create or replace function public.guard_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not public.is_admin() then
    raise exception 'Only an admin may change a role'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

-- ------------------------------------------- clients / projects / tasks ----
-- Single-tenant: Kijamii staff collaborate on every row. Admin alone deletes.

create policy "clients_select_authenticated"
  on public.clients for select to authenticated using ( true );
create policy "clients_insert_authenticated"
  on public.clients for insert to authenticated with check ( true );
create policy "clients_update_authenticated"
  on public.clients for update to authenticated using ( true ) with check ( true );
create policy "clients_delete_admin"
  on public.clients for delete to authenticated using ( public.is_admin() );

create policy "projects_select_authenticated"
  on public.projects for select to authenticated using ( true );
create policy "projects_insert_authenticated"
  on public.projects for insert to authenticated with check ( true );
create policy "projects_update_authenticated"
  on public.projects for update to authenticated using ( true ) with check ( true );
create policy "projects_delete_admin"
  on public.projects for delete to authenticated using ( public.is_admin() );

create policy "tasks_select_authenticated"
  on public.tasks for select to authenticated using ( true );
create policy "tasks_insert_authenticated"
  on public.tasks for insert to authenticated with check ( true );
create policy "tasks_update_authenticated"
  on public.tasks for update to authenticated using ( true ) with check ( true );
create policy "tasks_delete_admin"
  on public.tasks for delete to authenticated using ( public.is_admin() );

-- Signed-out visitors have no business reaching PostgREST at all; sign-up and
-- sign-in go through GoTrue, not these tables.
revoke all on public.profiles, public.clients, public.projects, public.tasks from anon;
