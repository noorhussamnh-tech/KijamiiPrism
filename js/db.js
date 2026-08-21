/**
 * Data access. Every query against clients / projects / tasks lives here, so
 * view modules stay free of query syntax and the shapes they receive are
 * predictable.
 *
 * Mutations do not touch state.js. The realtime channel reports the change
 * back and the store is updated there — one path in, no divergence between
 * what the UI shows and what the database holds.
 */
import { supabase } from './supabase.js';

const CLIENT_COLS = 'id, name, industry, status, notes, created_by, created_at, updated_at';
const PROJECT_COLS =
  'id, client_id, name, description, status, start_date, due_date, owner_id, created_at, updated_at';
const TASK_COLS =
  'id, project_id, title, notes, status, priority, assignee_id, due_date, created_at, updated_at';

/** One round trip per table, in parallel — they have no dependency on each other. */
export async function loadAll() {
  const [clients, projects, tasks] = await Promise.all([
    supabase.from('clients').select(CLIENT_COLS).order('name'),
    supabase.from('projects').select(PROJECT_COLS).order('name'),
    supabase.from('tasks').select(TASK_COLS).order('priority'),
  ]);

  const failed = [clients, projects, tasks].find((r) => r.error);
  if (failed) throw failed.error;

  return {
    clients: clients.data ?? [],
    projects: projects.data ?? [],
    tasks: tasks.data ?? [],
  };
}

function crud(table, columns) {
  return {
    async create(row) {
      const { data, error } = await supabase.from(table).insert(row).select(columns).single();
      if (error) throw error;
      return data;
    },
    async update(id, patch) {
      const { data, error } = await supabase
        .from(table)
        .update(patch)
        .eq('id', id)
        .select(columns)
        .single();
      if (error) throw error;
      return data;
    },
    async remove(id) {
      // RLS restricts DELETE to admins. A member's request is not an error —
      // it simply matches no rows — so check the count and say so plainly.
      const { data, error } = await supabase.from(table).delete().eq('id', id).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Not permitted — only an admin can delete this.');
      }
      return data[0];
    },
  };
}

export const clients = crud('clients', CLIENT_COLS);
export const projects = crud('projects', PROJECT_COLS);
export const tasks = crud('tasks', TASK_COLS);
