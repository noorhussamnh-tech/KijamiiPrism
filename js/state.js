/**
 * In-memory store.
 *
 * Views read from here and never query Supabase themselves. Writes go through
 * db.js, and the resulting row change comes back via realtime.js, which calls
 * upsertRow/removeRow below. That means the local copy is only ever updated
 * from one direction, so a failed write cannot leave the UI showing something
 * the database does not contain.
 */

const state = {
  session: null,
  profile: null,
  clients: [],
  projects: [],
  tasks: [],
  team: [],
  loading: true,
};

const listeners = new Set();

export function getState() {
  return state;
}

export function isAdmin() {
  return state.profile?.role === 'admin';
}

/** Subscribe to every state change. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

export function setState(patch) {
  Object.assign(state, patch);
  notify();
}

/** Sort helpers keep list order stable as realtime events arrive out of order. */
const SORTERS = {
  clients: (a, b) => a.name.localeCompare(b.name),
  projects: (a, b) => a.name.localeCompare(b.name),
  tasks: (a, b) =>
    a.priority - b.priority ||
    (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'),
  team: (a, b) => (a.full_name ?? a.email).localeCompare(b.full_name ?? b.email),
};

export function replaceCollection(key, rows) {
  state[key] = [...rows].sort(SORTERS[key]);
  notify();
}

/** Insert or update a single row, used by the realtime handlers. */
export function upsertRow(key, row) {
  const list = state[key];
  const i = list.findIndex((r) => r.id === row.id);
  if (i === -1) list.push(row);
  else list[i] = { ...list[i], ...row };
  state[key] = [...list].sort(SORTERS[key]);
  notify();
}

export function removeRow(key, id) {
  state[key] = state[key].filter((r) => r.id !== id);
  notify();
}

/** Wipe everything but keep listeners attached — used on sign-out. */
export function clearData() {
  Object.assign(state, {
    session: null,
    profile: null,
    clients: [],
    projects: [],
    tasks: [],
    team: [],
    loading: false,
  });
  notify();
}
