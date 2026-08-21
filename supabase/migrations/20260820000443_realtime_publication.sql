-- Kijamii Prism: stream row changes to signed-in clients.
-- Realtime applies the same RLS policies to postgres_changes, so subscribers
-- only receive rows they could have SELECTed.

alter publication supabase_realtime add table public.clients;
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;

-- Without FULL, UPDATE and DELETE payloads carry only the primary key, and a
-- subscriber cannot reconcile the removed row against its local state.
alter table public.clients  replica identity full;
alter table public.projects replica identity full;
alter table public.tasks    replica identity full;
