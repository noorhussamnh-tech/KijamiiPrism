-- Kijamii Prism: agency ops domain — clients, projects, tasks.

create table public.clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  industry   text,
  status     text not null default 'active',
  notes      text,
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients on delete cascade,
  name        text not null,
  description text,
  status      public.project_status not null default 'planning',
  start_date  date,
  due_date    date,
  owner_id    uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects on delete cascade,
  title       text not null,
  notes       text,
  status      public.task_status not null default 'todo',
  priority    smallint not null default 2 check (priority between 1 and 3),
  assignee_id uuid references auth.users on delete set null,
  due_date    date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on column public.tasks.priority is '1 = high, 2 = normal, 3 = low.';

-- Foreign keys used in joins and filters need their own indexes; Postgres does
-- not create them automatically for the referencing side.
create index clients_created_by_idx  on public.clients  (created_by);
create index projects_client_id_idx  on public.projects (client_id);
create index projects_owner_id_idx   on public.projects (owner_id);
create index projects_status_idx     on public.projects (status);
create index tasks_project_id_idx    on public.tasks    (project_id);
create index tasks_assignee_id_idx   on public.tasks    (assignee_id);
create index tasks_status_idx        on public.tasks    (status);

create trigger clients_touch_updated_at
  before update on public.clients
  for each row execute function public.touch_updated_at();

create trigger projects_touch_updated_at
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();
