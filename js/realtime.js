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
 * 2. DELETE payloads carry `old` rather than `new`. The migration sets
 *    REPLICA IDENTITY FULL so `old` contains the whole row and not just the
 *    primary key.
 */
import { supabase } from './supabase.js';
import { upsertRow, removeRow } from './state.js';

const TABLES = ['clients', 'projects', 'tasks'];

let channel = null;

export function subscribeToChanges({ onStatus } = {}) {
  unsubscribeFromChanges();

  channel = supabase.channel('kijamii-prism-db-changes');

  for (const table of TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      if (payload.eventType === 'DELETE') {
        // `old` is populated because of REPLICA IDENTITY FULL.
        const id = payload.old?.id;
        if (id) removeRow(table, id);
      } else {
        upsertRow(table, payload.new);
      }
    });
  }

  channel.subscribe((status) => {
    onStatus?.(status);
  });

  return channel;
}

export function unsubscribeFromChanges() {
  if (!channel) return;
  supabase.removeChannel(channel);
  channel = null;
}
