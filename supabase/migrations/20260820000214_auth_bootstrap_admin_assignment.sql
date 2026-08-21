-- Kijamii Prism: create a profile for every new auth user, and grant the
-- designated address the admin role automatically.

-- Single source of truth for who is auto-promoted. Change it here only.
create or replace function public.admin_email()
returns text
language sql
immutable
as $$ select 'noorhussam.nh@gmail.com'::text $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    case
      when lower(new.email) = lower(public.admin_email())
      then 'admin'::public.app_role
      else 'member'::public.app_role
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: keep the rule true for accounts created before this migration, and
-- for any account created outside the trigger's path. Both statements are
-- idempotent and safe to re-run.
insert into public.profiles (id, email, full_name, role)
select
  u.id,
  u.email,
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    split_part(u.email, '@', 1)
  ),
  case
    when lower(u.email) = lower(public.admin_email())
    then 'admin'::public.app_role
    else 'member'::public.app_role
  end
from auth.users u
where u.email is not null
on conflict (id) do nothing;

update public.profiles
   set role = 'admin'
 where lower(email) = lower(public.admin_email())
   and role <> 'admin';
