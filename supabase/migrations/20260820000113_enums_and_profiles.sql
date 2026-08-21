-- Kijamii Prism: enum types and the profiles table that mirrors auth.users.

create type public.app_role as enum ('admin', 'member');
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed');
create type public.task_status as enum ('todo', 'in_progress', 'review', 'done');

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  full_name  text,
  role       public.app_role not null default 'member',
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Application profile for each auth user. Rows are created by the on_auth_user_created trigger, never by clients.';

-- Shared updated_at trigger function, used by clients/projects/tasks.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
