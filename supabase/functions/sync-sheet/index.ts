/**
 * Kijamii Prism — Google Sheet → Supabase sync.
 *
 * One-way. The Sheet is the source of truth; this function only reads it.
 * Nothing here ever writes back to Google.
 *
 * Design commitments, each of which exists because the source data demanded it:
 *
 *  - **Row position is the key.** Upserts target (source_tab, source_row).
 *    A content hash alone would be wrong: the job book legitimately holds rows
 *    identical in every column except Supplier — three Studio Freelancers at
 *    -12,000 EGP in the same month — and hashing would collapse three real
 *    costs into one. The hash is used only to decide insert vs. update.
 *
 *  - **Absent is never zero.** A blank timesheet cell produces no row at all,
 *    rather than a row with hours = 0. A recorded 0 produces a row with 0.
 *    Every downstream view depends on telling those apart.
 *
 *  - **Nothing is estimated.** A value that cannot be parsed is left null and
 *    written to prism_sync_issues with its raw text. The row still loads; the
 *    questionable field does not pretend to be known.
 *
 *  - **Deletes are soft.** Rows no longer present in the Sheet are flagged,
 *    never removed, so a bad sync cannot destroy history.
 *
 * Credentials come from Function Secrets and are never committed:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_PRIVATE_KEY            (PEM, with literal \n escapes)
 *   PRISM_SHEET_ID
 *   SUPABASE_URL                  (injected by the platform)
 *   SUPABASE_SERVICE_ROLE_KEY     (injected by the platform)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SHEET_ID = Deno.env.get('PRISM_SHEET_ID')!;
const SA_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!;
const SA_KEY = Deno.env.get('GOOGLE_PRIVATE_KEY')!;

const TAB_JOB_BOOK = 'Collective Job Books';
const TAB_TIME = 'Egypt & UAE Time Dedication';
const TAB_SCOPES = 'Scopes';
const TAB_CONTRACTS = 'Contract Durations';
const TAB_MAPPING = 'Master Mapping';

const YEAR = 2026;
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---------------------------------------------------------------- Google auth

/** Mint a Google access token from the service account, signing RS256 in-process. */
async function googleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsigned = `${b64(header)}.${b64(claim)}`;

  // Secrets store the PEM with literal \n; restore real newlines before parsing.
  const pem = SA_KEY.replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBuf = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${sig}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

/** Read a whole tab. UNFORMATTED_VALUE keeps numbers numeric and dates as serials. */
async function readTab(token: string, tab: string): Promise<unknown[][]> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/` +
    `${encodeURIComponent(tab)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Sheets read failed for "${tab}": ${res.status} ${await res.text()}`);
  return (await res.json()).values ?? [];
}

// -------------------------------------------------------------- normalisation

const issues: Array<Record<string, unknown>> = [];
function flag(
  tab: string, row: number, severity: 'info' | 'warning' | 'error',
  code: string, column: string, raw: unknown, message: string,
) {
  issues.push({
    tab, source_row: row, severity, code,
    column_name: column, raw_value: raw === null || raw === undefined ? null : String(raw), message,
  });
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const numOrNull = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function monthStart(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const i = MONTHS.indexOf(s.slice(0, 3).replace(/^./, (c) => c.toUpperCase()));
  return i === -1 ? null : `${YEAR}-${String(i + 1).padStart(2, '0')}-01`;
}

const serialToISO = (n: number) =>
  new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);

/**
 * Dates only. Invoice numbers and free text are quarantined rather than
 * coerced — per instruction, invoices in the date columns are ignored.
 */
function parseDate(v: unknown, tab: string, row: number, col: string): string | null {
  const s = str(v);
  if (!s) return null;

  if (/^\d{5}(\.\d+)?$/.test(s)) return serialToISO(Number(s));

  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCDate() === d && dt.getUTCMonth() === mo - 1) return dt.toISOString().slice(0, 10);
    flag(tab, row, 'warning', 'date_invalid', col, s, 'Day or month out of range; left null.');
    return null;
  }
  if (/^inv/i.test(s)) {
    flag(tab, row, 'info', 'invoice_in_date_column', col, s,
      'Invoice number in a date column; ignored as instructed.');
    return null;
  }
  flag(tab, row, 'warning', 'date_unparseable', col, s, 'Not a date; left null.');
  return null;
}

async function hash(parts: unknown[]): Promise<string> {
  const data = new TextEncoder().encode(parts.map((p) => p ?? '').join('|'));
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ---------------------------------------------------------------------- main

Deno.serve(async (req) => {
  const started = Date.now();
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const trigger = new URL(req.url).searchParams.get('trigger') ?? 'manual';

  const { data: run, error: runErr } = await supabase
    .from('prism_sync_runs')
    .insert({ status: 'running', trigger, sheet_id: SHEET_ID })
    .select('id').single();
  if (runErr) return new Response(JSON.stringify({ error: runErr.message }), { status: 500 });

  const runId = run.id;
  const counts = { read: 0, upserted: 0, softDeleted: 0 };

  try {
    const token = await googleAccessToken();
    issues.length = 0;

    // ---- rates, so conversion uses stored data rather than constants in code
    const { data: rates } = await supabase
      .from('prism_fx_rates').select('currency, effective_month, rate_to_usd');
    const rateFor = (cur: string | null, month: string | null): number | null => {
      if (!cur) return null;
      const dated = rates?.find((r) => r.currency === cur && r.effective_month === month);
      const standing = rates?.find((r) => r.currency === cur && r.effective_month === null);
      return dated?.rate_to_usd ?? standing?.rate_to_usd ?? null;
    };

    // ---- Master Mapping -> clients, employees, aliases
    const mapRows = await readTab(token, TAB_MAPPING);
    const clients = new Map<string, { client_code: string; name: string; sector: string | null }>();
    const employees = new Map<string, { employee_code: string; name: string; is_placeholder: boolean }>();
    const cAlias: unknown[] = [];
    const eAlias: unknown[] = [];

    for (let i = 1; i < mapRows.length; i++) {
      const r = mapRows[i];
      const [type, code, standard, variant, sector, note] = r.map(str);
      if (!type || !code) continue;
      const canonical = (note ?? '').toLowerCase().startsWith('canonical');
      if (type === 'Client') {
        if (!clients.has(code)) clients.set(code, { client_code: code, name: standard!, sector });
        if (variant) cAlias.push({ alias: variant, client_code: code, is_canonical: canonical });
      } else if (type === 'Employee') {
        if (!employees.has(code)) {
          employees.set(code, {
            employee_code: code, name: standard!,
            is_placeholder: (note ?? '').toLowerCase().startsWith('role placeholder'),
          });
        }
        if (variant) eAlias.push({ alias: variant, employee_code: code, is_canonical: canonical });
      }
    }
    await supabase.from('prism_clients').upsert([...clients.values()], { onConflict: 'client_code' });
    await supabase.from('prism_employees').upsert([...employees.values()], { onConflict: 'employee_code' });
    await supabase.from('prism_client_aliases').upsert(cAlias, { onConflict: 'alias' });
    await supabase.from('prism_employee_aliases').upsert(eAlias, { onConflict: 'alias' });

    // ---- Collective Job Books
    const jbRows = await readTab(token, TAB_JOB_BOOK);
    const jb: unknown[] = [];
    const jbSeen: number[] = [];
    const regions = new Set<string>();
    const services = new Set<string>();

    for (let i = 1; i < jbRows.length; i++) {
      const r = jbRows[i];
      const sheetRow = i + 1;
      if (!str(r[0])) continue;               // spacer / total rows carry no client
      counts.read++; jbSeen.push(sheetRow);

      const month = monthStart(r[3]);
      if (str(r[3]) && !month) flag(TAB_JOB_BOOK, sheetRow, 'warning', 'month_unparseable', 'Month', r[3], 'Month not recognised.');

      const currency = str(r[10]);
      const recognized = numOrNull(r[11]);
      const rate = rateFor(currency, month);
      if (recognized !== null && currency && rate === null) {
        flag(TAB_JOB_BOOK, sheetRow, 'warning', 'fx_rate_missing', 'Currency', currency,
          `No USD rate on file for ${currency}; USD amount left null.`);
      }
      const region = str(r[1]);
      const service = str(r[4]);
      if (region) regions.add(region);
      if (service) services.add(service);

      const logVal = str(r[2]);
      jb.push({
        source_tab: TAB_JOB_BOOK,
        source_row: sheetRow,
        client_code: str(r[24]),
        region_code: region,
        entry_type: logVal === 'Revenue' ? 'revenue' : logVal === 'Cost' ? 'cost' : null,
        month_start: month,
        service_code: service,
        sub_service: str(r[5]),
        description: str(r[6]),
        supplier: str(r[7]),
        doc_ref: str(r[8]),
        invoicing_amount: numOrNull(r[9]),
        currency,
        recognized_amount: recognized,
        recognized_amount_usd:
          recognized !== null && rate ? Math.round((recognized / rate) * 100) / 100 : null,
        fx_rate_used: rate,
        invoicing_date: parseDate(r[12], TAB_JOB_BOOK, sheetRow, 'Invoicing Date'),
        collected_date: parseDate(r[13], TAB_JOB_BOOK, sheetRow, 'Collected?'),
        notes: str(r[14]),
        content_hash: await hash(r.slice(0, 15)),
        is_deleted: false,
        last_seen_at: new Date().toISOString(),
      });
    }

    await supabase.from('prism_regions')
      .upsert([...regions].map((x) => ({ region_code: x, name: x })), { onConflict: 'region_code' });
    await supabase.from('prism_services')
      .upsert([...services].map((x) => ({ service_code: x, name: x })), { onConflict: 'service_code' });

    for (let i = 0; i < jb.length; i += 500) {
      const { error } = await supabase.from('prism_job_book_entries')
        .upsert(jb.slice(i, i + 500), { onConflict: 'source_tab,source_row' });
      if (error) throw new Error(`job book upsert: ${error.message}`);
    }
    counts.upserted += jb.length;

    // ---- Time Dedication: wide -> long
    const tdRows = await readTab(token, TAB_TIME);
    const td: unknown[] = [];
    const tdSeen: number[] = [];

    for (let i = 1; i < tdRows.length; i++) {
      const r = tdRows[i];
      const sheetRow = i + 1;
      if (!str(r[2])) continue;
      tdSeen.push(sheetRow);

      for (let m = 0; m < 12; m++) {
        const cell = r[6 + m];
        // An empty cell is a missing submission. It produces no row at all —
        // writing 0 here would turn "we do not know" into "they did nothing".
        if (cell === null || cell === undefined || String(cell).trim() === '') continue;
        const hours = numOrNull(cell);
        if (hours === null) {
          flag(TAB_TIME, sheetRow, 'warning', 'hours_unparseable', MONTHS[m], cell, 'Hours not numeric; cell skipped.');
          continue;
        }
        counts.read++;
        td.push({
          source_tab: TAB_TIME,
          source_row: sheetRow,
          month_start: `${YEAR}-${String(m + 1).padStart(2, '0')}-01`,
          employee_code: str(r[24]),
          client_code: str(r[25]),
          hours,
          team: str(r[0]),
          title: str(r[1]),
          engagement_type: str(r[4]),
          assets_count: numOrNull(r[5]),
          unnamed_metric: numOrNull(r[20]),
          content_hash: await hash([r[2], r[3], MONTHS[m], cell]),
          is_deleted: false,
          last_seen_at: new Date().toISOString(),
        });
      }
    }
    for (let i = 0; i < td.length; i += 500) {
      const { error } = await supabase.from('prism_time_dedication')
        .upsert(td.slice(i, i + 500), { onConflict: 'source_tab,source_row,month_start' });
      if (error) throw new Error(`time dedication upsert: ${error.message}`);
    }
    counts.upserted += td.length;

    // ---- Scopes
    const scRows = await readTab(token, TAB_SCOPES);
    const sc: unknown[] = [];
    const scSeen: number[] = [];
    for (let i = 1; i < scRows.length; i++) {
      const r = scRows[i];
      const sheetRow = i + 1;
      if (!str(r[13])) continue;             // free-text note rows carry no client code
      counts.read++; scSeen.push(sheetRow);
      sc.push({
        source_tab: TAB_SCOPES, source_row: sheetRow,
        client_code: str(r[13]), employee_code: str(r[14]),
        region: str(r[0]), function: str(r[2]), title: str(r[3]),
        assignee_name: str(r[6]),
        assumed_pct: numOrNull(r[4]), assumed_hours: numOrNull(r[5]),
        content_hash: await hash([r[13], r[14], r[2], r[3], r[4], r[5]]),
        is_deleted: false, last_seen_at: new Date().toISOString(),
      });
    }
    if (sc.length) {
      const { error } = await supabase.from('prism_scope_lines')
        .upsert(sc, { onConflict: 'source_tab,source_row' });
      if (error) throw new Error(`scopes upsert: ${error.message}`);
      counts.upserted += sc.length;
    }

    // ---- Contract Durations
    const cdRows = await readTab(token, TAB_CONTRACTS);
    const cd: unknown[] = [];
    for (let i = 1; i < cdRows.length; i++) {
      const r = cdRows[i];
      const sheetRow = i + 1;
      if (!str(r[2])) continue;
      counts.read++;
      const raw = str(r[1]);
      let end: string | null = null;
      let unknown = false;
      if (raw && /^\d{5}(\.\d+)?$/.test(raw)) end = serialToISO(Number(raw));
      else {
        unknown = true;
        flag(TAB_CONTRACTS, sheetRow, 'info', 'contract_end_unknown', 'Contract end', raw,
          'Recorded as unknown in the sheet.');
      }
      cd.push({
        client_code: str(r[2]), source_tab: TAB_CONTRACTS, source_row: sheetRow,
        end_date: end, end_date_unknown: unknown, raw_value: raw,
        content_hash: await hash([r[2], raw]), last_seen_at: new Date().toISOString(),
      });
    }
    if (cd.length) {
      const { error } = await supabase.from('prism_contracts')
        .upsert(cd, { onConflict: 'client_code' });
      if (error) throw new Error(`contracts upsert: ${error.message}`);
      counts.upserted += cd.length;
    }

    // ---- Reconcile: anything not seen this run is gone from the Sheet.
    // Soft-deleted, never removed, so a bad run cannot destroy history.
    for (const [table, tab, seen] of [
      ['prism_job_book_entries', TAB_JOB_BOOK, jbSeen],
      ['prism_time_dedication', TAB_TIME, tdSeen],
      ['prism_scope_lines', TAB_SCOPES, scSeen],
    ] as const) {
      if (!seen.length) continue;
      const { data, error } = await supabase.from(table)
        .update({ is_deleted: true })
        .eq('source_tab', tab).eq('is_deleted', false)
        .not('source_row', 'in', `(${seen.join(',')})`)
        .select('id');
      if (error) throw new Error(`reconcile ${table}: ${error.message}`);
      counts.softDeleted += data?.length ?? 0;
    }

    if (issues.length) {
      await supabase.from('prism_sync_issues')
        .insert(issues.map((i) => ({ ...i, run_id: runId })));
    }

    const errorIssues = issues.filter((i) => i.severity === 'error').length;
    await supabase.from('prism_sync_runs').update({
      finished_at: new Date().toISOString(),
      status: errorIssues ? 'partial' : 'success',
      rows_read: counts.read,
      rows_inserted: counts.upserted,
      rows_soft_deleted: counts.softDeleted,
      issue_count: issues.length,
      duration_ms: Date.now() - started,
    }).eq('id', runId);

    return Response.json({
      ok: true, run_id: runId, ...counts, issues: issues.length,
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase.from('prism_sync_runs').update({
      finished_at: new Date().toISOString(),
      status: 'failed',
      error_message: message,
      issue_count: issues.length,
      duration_ms: Date.now() - started,
    }).eq('id', runId);
    // A failed run is recorded, not swallowed: a broken sync and a quiet sync
    // must never look the same from the dashboard.
    return Response.json({ ok: false, run_id: runId, error: message }, { status: 500 });
  }
});
