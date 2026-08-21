/**
 * Data access for the Prism pipeline tables.
 *
 * Everything is fetched once at sign-in and aggregated in the browser. The
 * whole record is about a thousand rows — smaller than a single photo — so
 * round-tripping to the server for each filter change would add latency
 * without buying anything.
 *
 * These tables are read-only to the client by policy: `authenticated` holds
 * SELECT and nothing else. There is no write path here because there is no
 * write path at all.
 */
import { supabase } from '../supabase.js';

/** Rows arrive newest-column-first; PostgREST caps at 1000 unless told otherwise. */
const PAGE = 2000;

async function all(table, columns, order) {
  let q = supabase.from(table).select(columns).limit(PAGE);
  if (order) q = q.order(order);
  const { data, error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

export async function loadPrism() {
  const [
    clients, employees, regions, services,
    timeDedication, jobBook, scopeLines, contracts,
  ] = await Promise.all([
    all('prism_clients', 'client_code, name, sector', 'name'),
    all('prism_employees', 'employee_code, name, is_placeholder', 'name'),
    all('prism_regions', 'region_code, name', 'region_code'),
    all('prism_services', 'service_code, name', 'service_code'),
    all(
      'prism_time_dedication',
      'source_row, month_start, employee_code, client_code, hours, team, title, engagement_type, is_deleted',
      'month_start',
    ),
    all(
      'prism_job_book_entries',
      'source_row, client_code, region_code, entry_type, month_start, service_code, sub_service, ' +
        'currency, recognized_amount, recognized_amount_usd, fx_rate_used, invoicing_date, is_deleted',
      'month_start',
    ),
    all(
      'prism_scope_lines',
      'client_code, employee_code, function, title, assignee_name, assumed_pct, assumed_hours, is_deleted',
      'client_code',
    ),
    all('prism_contracts', 'client_code, end_date, end_date_unknown', 'client_code'),
  ]);

  // Soft-deleted rows are still in the table by design — they are history, not
  // current record. Every view reads the live set.
  const live = (rows) => rows.filter((r) => !r.is_deleted);

  return {
    clients,
    employees,
    regions,
    services,
    timeDedication: live(timeDedication),
    jobBook: live(jobBook),
    scopeLines: live(scopeLines),
    contracts,
  };
}

export async function loadSyncStatus() {
  const { data, error } = await supabase.from('prism_sync_status_v').select('*').limit(1);
  if (error) return null;
  return data?.[0] ?? null;
}

/**
 * Everything the loader could not take at face value, from the most recent
 * run. These are the values left null rather than guessed at, and Evidence
 * Exceptions exists to make them visible instead of letting them disappear.
 */
export async function loadSyncIssues() {
  const { data, error } = await supabase
    .from('prism_sync_issues')
    .select('run_id, tab, source_row, severity, code, column_name, raw_value, message')
    .order('run_id', { ascending: false })
    .limit(2000);
  if (error) return [];
  const latest = data?.[0]?.run_id;
  return (data ?? []).filter((i) => i.run_id === latest);
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
