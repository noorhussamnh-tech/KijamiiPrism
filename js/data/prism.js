/**
 * Data access — demonstration build.
 *
 * In production these three functions issue SELECTs against the Prism pipeline
 * tables. Here they resolve a fixed, generated dataset that ships with the
 * page. Nothing else changed: the shape they return is identical, and every
 * helper below the loaders — pivot, monthsIn, nameLookup, monthLabel, the
 * reference threshold — is the production code untouched, so every figure in
 * the app is computed by exactly the same arithmetic as it is in production.
 *
 * The functions stay `async`. Making them synchronous would work, but it would
 * change the call sites in main.js and realtime.js, and the point of this build
 * is that the surrounding code is the production code.
 */
import {
  CLIENTS,
  EMPLOYEES,
  REGIONS,
  SERVICES,
  CONTRACTS,
  SCOPE_LINES,
  TIME_DEDICATION,
  JOB_BOOK,
  SYNC_STATUS,
  SYNC_ISSUES,
} from '../demo/dataset.js';

/**
 * The dataset is frozen on the way out. Views should not be able to mutate the
 * record they are reading, and in a build with no server to refetch from, a
 * stray write would persist for the whole session with nothing to correct it.
 */
const frozen = (rows) => Object.freeze(rows.map((r) => Object.freeze({ ...r })));

export async function loadPrism() {
  // Soft-deleted rows are still in the record by design — they are history, not
  // current record. Every view reads the live set.
  const live = (rows) => rows.filter((r) => !r.is_deleted);

  return {
    clients: frozen(CLIENTS),
    employees: frozen(EMPLOYEES),
    regions: frozen(REGIONS),
    services: frozen(SERVICES),
    timeDedication: frozen(live(TIME_DEDICATION)),
    jobBook: frozen(live(JOB_BOOK)),
    scopeLines: frozen(live(SCOPE_LINES)),
    contracts: frozen(CONTRACTS),
  };
}

export async function loadSyncStatus() {
  return Object.freeze({ ...SYNC_STATUS });
}

/**
 * Everything the loader could not take at face value, from the most recent
 * run. These are the values left null rather than guessed at, and Evidence
 * Exceptions exists to make them visible instead of letting them disappear.
 */
export async function loadSyncIssues() {
  return frozen(SYNC_ISSUES);
}

// ------------------------------------------------------------------ helpers

export const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function monthLabel(iso) {
  if (!iso) return '—';
  return MONTH_LABELS[Number(String(iso).slice(5, 7)) - 1] ?? '—';
}

/** Distinct month_start values present in a set of rows, in calendar order. */
export function monthsIn(rows) {
  return [...new Set(rows.map((r) => r.month_start).filter(Boolean))].sort();
}

export function nameLookup(rows, codeKey, nameKey = 'name') {
  const m = new Map(rows.map((r) => [r[codeKey], r[nameKey]]));
  return (code) => m.get(code) ?? code ?? '—';
}

/**
 * Collapse rows to one value per (rowKey, month).
 *
 * Returns a Map of rowKey → Map of month → number. A key is absent when no
 * row existed, which is not the same as a value of 0 — callers must render
 * those differently, and every view here does.
 */
export function pivot(rows, rowKey, valueKey = 'hours') {
  const out = new Map();
  for (const r of rows) {
    if (!r.month_start) continue;
    const k = r[rowKey];
    if (!out.has(k)) out.set(k, new Map());
    const byMonth = out.get(k);
    const v = Number(r[valueKey]) || 0;
    byMonth.set(r.month_start, (byMonth.get(r.month_start) ?? 0) + v);
  }
  return out;
}

/** The monthly hours threshold above which a workload is flagged. */
export const REFERENCE_HOURS = 140;
