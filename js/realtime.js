/**
 * Realtime synchronisation.
 *
 * Two things matter here and both are easy to get wrong:
 *
 * 1. Subscribe only *after* a session exists. Realtime applies the same RLS
 *    policies to postgres_changes as it does to a SELECT, using the token on
 *    the socket. Subscribing while signed out attaches the anon token and the
 *    channel then delivers nothing, silently.
 *
 * 2. The views aggregate — a heatmap cell is a sum across several rows — so
 *    patching one row into local state would mean re-deriving every total by
 *    hand. Instead a change triggers a reload of the whole record. It is about
 *    a thousand rows, so a refetch is cheap, and it cannot drift out of step
 *    with the database the way incremental patching can.
 */
import { supabase } from './supabase.js';
import { setState } from './state.js';
import { loadPrism, loadSyncStatus } from './data/prism.js';

const TABLES = [
  'prism_job_book_entries',
  'prism_time_dedication',
  'prism_scope_lines',
  'prism_sync_runs',
];

let channel = null;
let pending = null;

/** A sync writes hundreds of rows in seconds; reload once when it settles. */
function scheduleReload() {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      const [prism, syncStatus] = await Promise.all([loadPrism(), loadSyncStatus()]);
      setState({ prism, syncStatus });
    } catch (error) {
      console.error('Reload after realtime change failed:', error);
    }
  }, 1500);
}

export function subscribeToChanges({ onStatus } = {}) {
  unsubscribeFromChanges();
  channel = supabase.channel('prism-db-changes');

  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload);
  }

  channel.subscribe((status) => onStatus?.(status));
  return channel;
}

export function unsubscribeFromChanges() {
  clearTimeout(pending);
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
}
