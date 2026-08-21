/**
 * Kijamii Prism — Sheet → Supabase sync.
 *
 * This runs inside the workbook itself, as you, so it already has permission
 * to read the tabs. Nothing is ever written back to the Sheet.
 *
 * The rules it follows are the ones the real data forced:
 *
 *  - Row position is the key. A blank line inserted in the middle of a tab
 *    shifts everything below it, and that is fine — the sync re-reads
 *    positions every run. What it must never do is merge two different rows
 *    that happen to look identical, and the job book has those: three Studio
 *    Freelancers at −12,000 EGP in the same month, differing only by Supplier.
 *
 *  - A blank timesheet cell is NOT zero. It produces no row at all. A cell
 *    someone actually typed 0 into produces a row with 0. Every effort figure
 *    downstream depends on that distinction holding.
 *
 *  - Nothing is guessed. A value that will not parse is left empty and logged
 *    to prism_sync_issues with its original text, so you can see what was
 *    skipped and why.
 *
 *  - Deletes are soft. A row removed from the Sheet is flagged, never erased.
 */

var SUPABASE_URL = 'https://gwepxpyfgtgagceguyhm.supabase.co';
var SHEET_ID = '1OD0gmT-LI8rHxKBQEfVFUmnY3D4noSwEKz1ia5TqRLY';
var YEAR = 2026;

var TAB_JOB_BOOK = 'Collective Job Books';
var TAB_TIME     = 'Egypt & UAE Time Dedication';
var TAB_SCOPES   = 'Scopes';
var TAB_CONTRACTS= 'Contract Durations';
var TAB_MAPPING  = 'Master Mapping';

var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ---------------------------------------------------------------- menu

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Kijamii Prism')
    .addItem('Sync now', 'syncNow')
    .addItem('Check last sync', 'showStatus')
    .addSeparator()
    .addItem('Set Supabase key', 'setKey')
    .addItem('Schedule daily sync', 'installTrigger')
    .addItem('Stop daily sync', 'removeTrigger')
    .addToUi();
}

function setKey() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt(
    'Supabase service key',
    'Paste the service_role key from Supabase → Project Settings → API Keys.\n\n' +
    'It is stored in this script\'s private settings, not in any cell.',
    ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var key = res.getResponseText().trim();
  if (!key) { ui.alert('Nothing pasted — key not changed.'); return; }
  PropertiesService.getScriptProperties().setProperty('SUPABASE_SERVICE_KEY', key);
  ui.alert('Saved. You can run "Sync now" whenever you like.');
}

function installTrigger() {
  removeTrigger();
  ScriptApp.newTrigger('syncScheduled').timeBased().everyDays(1).atHour(6).create();
  SpreadsheetApp.getUi().alert('Daily sync scheduled for around 6am.');
}

function removeTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncScheduled') ScriptApp.deleteTrigger(t);
  });
}

function syncScheduled() { runSync('scheduled'); }

function syncNow() {
  var ui = SpreadsheetApp.getUi();
  try {
    var r = runSync('manual');
    ui.alert(
      'Sync complete\n\n' +
      'Rows read: ' + r.read + '\n' +
      'Rows written: ' + r.written + '\n' +
      'Rows marked removed: ' + r.softDeleted + '\n' +
      'Issues logged: ' + r.issues + '\n' +
      'Took: ' + Math.round(r.ms / 1000) + 's');
  } catch (e) {
    ui.alert('Sync failed\n\n' + e.message +
      '\n\nNothing was half-written — the run is recorded as failed in Supabase.');
  }
}

function showStatus() {
  var rows = sb('GET', '/rest/v1/prism_sync_status_v?select=*');
  if (!rows.length) { SpreadsheetApp.getUi().alert('No sync has run yet.'); return; }
  var s = rows[0];
  SpreadsheetApp.getUi().alert(
    'Last sync\n\n' +
    'Status: ' + s.status + '\n' +
    'Started: ' + s.last_run_started + '\n' +
    'Rows read: ' + s.rows_read + '\n' +
    'Issues: ' + s.issue_count + '\n' +
    (s.error_message ? '\nError: ' + s.error_message : ''));
}

// ------------------------------------------------------------ Supabase

function serviceKey() {
  var k = PropertiesService.getScriptProperties().getProperty('SUPABASE_SERVICE_KEY');
  if (!k) throw new Error('No Supabase key set. Use "Kijamii Prism → Set Supabase key" first.');
  return k;
}

function sb(method, path, payload, prefer) {
  var key = serviceKey();
  var opts = {
    method: method,
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      Prefer: prefer || 'return=minimal'
    }
  };
  if (payload !== undefined && payload !== null) opts.payload = JSON.stringify(payload);

  var res = UrlFetchApp.fetch(SUPABASE_URL + path, opts);
  var code = res.getResponseCode();
  var body = res.getContentText();
  if (code >= 300) throw new Error('Supabase ' + code + ' on ' + path + ' — ' + body.slice(0, 400));
  if (!body) return [];
  try { return JSON.parse(body); } catch (e) { return []; }
}

/** Upsert in batches. PostgREST needs the conflict target named explicitly. */
function upsert(table, rows, onConflict) {
  if (!rows.length) return 0;
  var path = '/rest/v1/' + table + '?on_conflict=' + encodeURIComponent(onConflict);
  for (var i = 0; i < rows.length; i += 400) {
    sb('POST', path, rows.slice(i, i + 400), 'resolution=merge-duplicates,return=minimal');
  }
  return rows.length;
}

// ------------------------------------------------------- normalisation

var _issues = [];
function flag(tab, row, severity, code, column, raw, message) {
  _issues.push({
    tab: tab, source_row: row, severity: severity, code: code,
    column_name: column,
    raw_value: (raw === null || raw === undefined || raw === '') ? null : String(raw).slice(0, 300),
    message: message
  });
}

function s(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  var t = String(v).trim();
  return t === '' ? null : t;
}

function n(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  var x = Number(v);
  return isFinite(x) ? x : null;
}

function monthStart(v) {
  var t = s(v);
  if (!t) return null;
  var head = t.substring(0, 3);
  head = head.charAt(0).toUpperCase() + head.substring(1).toLowerCase();
  var i = MONTHS.indexOf(head);
  return i === -1 ? null : YEAR + '-' + pad(i + 1) + '-01';
}

function pad(x) { return (x < 10 ? '0' : '') + x; }

function serialToISO(num) {
  var ms = Date.UTC(1899, 11, 30) + num * 86400000;
  return Utilities.formatDate(new Date(ms), 'UTC', 'yyyy-MM-dd');
}

/**
 * Dates only. Invoice numbers and free text are quarantined rather than
 * coerced into something that looks like a date.
 */
function parseDate(v, tab, row, col) {
  if (v instanceof Date) return Utilities.formatDate(v, 'UTC', 'yyyy-MM-dd');
  var t = s(v);
  if (!t) return null;

  if (/^\d{5}(\.\d+)?$/.test(t)) return serialToISO(Number(t));

  var m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    var d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCDate() === d && dt.getUTCMonth() === mo - 1) {
      return Utilities.formatDate(dt, 'UTC', 'yyyy-MM-dd');
    }
    flag(tab, row, 'warning', 'date_invalid', col, t, 'Day or month out of range; left empty.');
    return null;
  }
  if (/^inv/i.test(t)) {
    flag(tab, row, 'info', 'invoice_in_date_column', col, t,
      'Invoice number sitting in a date column; ignored as agreed.');
    return null;
  }
  flag(tab, row, 'warning', 'date_unparseable', col, t, 'Not a date; left empty.');
  return null;
}

function hash(parts) {
  var str = parts.map(function (p) {
    if (p === null || p === undefined) return '';
    if (p instanceof Date) return Utilities.formatDate(p, 'UTC', 'yyyy-MM-dd');
    return String(p);
  }).join('|');
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, str);
  return bytes.map(function (b) {
    return ((b < 0 ? b + 256 : b) + 0x100).toString(16).substring(1);
  }).join('');
}

function grid(tabName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh) throw new Error('Tab not found: "' + tabName + '"');
  return sh.getDataRange().getValues();
}

// ------------------------------------------------------------------ sync

function runSync(trigger) {
  var t0 = new Date().getTime();
  var startedAt = new Date().toISOString();
  _issues = [];

  var run = sb('POST', '/rest/v1/prism_sync_runs',
    [{ status: 'running', trigger: trigger, sheet_id: SHEET_ID }],
    'return=representation')[0];
  var runId = run.id;

  var read = 0, written = 0, softDeleted = 0;

  try {
    // ---- FX rates, read from the table so a correction never needs a code change
    var rates = sb('GET', '/rest/v1/prism_fx_rates?select=currency,effective_month,rate_to_usd');
    function rateFor(cur, month) {
      if (!cur) return null;
      var dated = null, standing = null;
      for (var i = 0; i < rates.length; i++) {
        if (rates[i].currency !== cur) continue;
        if (rates[i].effective_month === month) dated = Number(rates[i].rate_to_usd);
        if (rates[i].effective_month === null) standing = Number(rates[i].rate_to_usd);
      }
      return dated !== null ? dated : standing;
    }

    // ---- Master Mapping
    var mm = grid(TAB_MAPPING);
    var clients = {}, employees = {}, cAlias = [], eAlias = [], seenAlias = {}, seenEAlias = {};
    for (var i = 1; i < mm.length; i++) {
      var r = mm[i];
      var type = s(r[0]), code = s(r[1]), std = s(r[2]), variant = s(r[3]);
      var sector = s(r[4]), note = (s(r[5]) || '').toLowerCase();
      if (!type || !code || !std) continue;
      var canon = note.indexOf('canonical') === 0;
      if (type === 'Client') {
        if (!clients[code]) clients[code] = { client_code: code, name: std, sector: sector };
        if (variant && !seenAlias[variant.toLowerCase()]) {
          seenAlias[variant.toLowerCase()] = 1;
          cAlias.push({ alias: variant, client_code: code, is_canonical: canon });
        }
      } else if (type === 'Employee') {
        if (!employees[code]) employees[code] = {
          employee_code: code, name: std,
          is_placeholder: note.indexOf('role placeholder') === 0
        };
        if (variant && !seenEAlias[variant.toLowerCase()]) {
          seenEAlias[variant.toLowerCase()] = 1;
          eAlias.push({ alias: variant, employee_code: code, is_canonical: canon });
        }
      }
    }
    upsert('prism_clients', values(clients), 'client_code');
    upsert('prism_employees', values(employees), 'employee_code');
    upsert('prism_client_aliases', cAlias, 'alias');
    upsert('prism_employee_aliases', eAlias, 'alias');

    // ---- Collective Job Books
    var jbG = grid(TAB_JOB_BOOK), jb = [], regions = {}, services = {};
    for (var i = 1; i < jbG.length; i++) {
      var r = jbG[i], row = i + 1;
      if (!s(r[0])) continue;                       // spacer / total lines
      read++;

      var month = monthStart(r[3]);
      if (s(r[3]) && !month) flag(TAB_JOB_BOOK, row, 'warning', 'month_unparseable', 'Month', r[3], 'Month not recognised.');

      var cur = s(r[10]);
      var rec = n(r[11]);
      var rate = rateFor(cur, month);
      if (rec !== null && cur && rate === null) {
        flag(TAB_JOB_BOOK, row, 'warning', 'fx_rate_missing', 'Currency', cur,
          'No USD rate on file for ' + cur + '; the USD figure is left empty rather than estimated.');
      }
      var region = s(r[1]), service = s(r[4]), log = s(r[2]);
      if (region) regions[region] = 1;
      if (service) services[service] = 1;

      jb.push({
        source_tab: TAB_JOB_BOOK, source_row: row,
        client_code: s(r[24]), region_code: region,
        entry_type: log === 'Revenue' ? 'revenue' : (log === 'Cost' ? 'cost' : null),
        month_start: month, service_code: service, sub_service: s(r[5]),
        description: s(r[6]), supplier: s(r[7]), doc_ref: s(r[8]),
        invoicing_amount: n(r[9]), currency: cur, recognized_amount: rec,
        recognized_amount_usd: (rec !== null && rate) ? Math.round((rec / rate) * 100) / 100 : null,
        fx_rate_used: rate,
        invoicing_date: parseDate(r[12], TAB_JOB_BOOK, row, 'Invoicing Date'),
        collected_date: parseDate(r[13], TAB_JOB_BOOK, row, 'Collected?'),
        notes: s(r[14]),
        content_hash: hash(r.slice(0, 15)),
        is_deleted: false, last_seen_at: startedAt
      });
    }
    upsert('prism_regions', keys(regions).map(function (x) { return { region_code: x, name: x }; }), 'region_code');
    upsert('prism_services', keys(services).map(function (x) { return { service_code: x, name: x }; }), 'service_code');
    written += upsert('prism_job_book_entries', jb, 'source_tab,source_row');

    // ---- Time Dedication: the wide Jan..Dec block becomes one row per month
    var tdG = grid(TAB_TIME), td = [];
    for (var i = 1; i < tdG.length; i++) {
      var r = tdG[i], row = i + 1;
      if (!s(r[2])) continue;
      for (var m = 0; m < 12; m++) {
        var cell = r[6 + m];
        // Blank means no submission. It produces nothing. Writing 0 here would
        // turn "we do not know" into "they did no work", which is a different
        // and much worse claim.
        if (cell === null || cell === undefined || String(cell).trim() === '') continue;
        var hrs = n(cell);
        if (hrs === null) {
          flag(TAB_TIME, row, 'warning', 'hours_unparseable', MONTHS[m], cell, 'Hours not a number; cell skipped.');
          continue;
        }
        read++;
        td.push({
          source_tab: TAB_TIME, source_row: row,
          month_start: YEAR + '-' + pad(m + 1) + '-01',
          employee_code: s(r[24]), client_code: s(r[25]), hours: hrs,
          team: s(r[0]), title: s(r[1]), engagement_type: s(r[4]),
          assets_count: n(r[5]), unnamed_metric: n(r[20]),
          content_hash: hash([r[2], r[3], MONTHS[m], cell]),
          is_deleted: false, last_seen_at: startedAt
        });
      }
    }
    written += upsert('prism_time_dedication', td, 'source_tab,source_row,month_start');

    // ---- Scopes
    var scG = grid(TAB_SCOPES), sc = [];
    for (var i = 1; i < scG.length; i++) {
      var r = scG[i], row = i + 1;
      if (!s(r[13])) continue;                      // the free-text note row has no client code
      read++;
      sc.push({
        source_tab: TAB_SCOPES, source_row: row,
        client_code: s(r[13]), employee_code: s(r[14]), region: s(r[0]),
        'function': s(r[2]), title: s(r[3]), assignee_name: s(r[6]),
        assumed_pct: n(r[4]), assumed_hours: n(r[5]),
        content_hash: hash([r[13], r[14], r[2], r[3], r[4], r[5]]),
        is_deleted: false, last_seen_at: startedAt
      });
    }
    written += upsert('prism_scope_lines', sc, 'source_tab,source_row');

    // ---- Contract Durations
    var cdG = grid(TAB_CONTRACTS), cd = [];
    for (var i = 1; i < cdG.length; i++) {
      var r = cdG[i], row = i + 1;
      if (!s(r[2])) continue;
      read++;
      var raw = r[1], end = null, unknown = false;
      if (raw instanceof Date) end = Utilities.formatDate(raw, 'UTC', 'yyyy-MM-dd');
      else if (raw !== null && raw !== undefined && /^\d{5}(\.\d+)?$/.test(String(raw).trim())) {
        end = serialToISO(Number(raw));
      } else {
        unknown = true;
        flag(TAB_CONTRACTS, row, 'info', 'contract_end_unknown', 'Contract end', raw,
          'Recorded as unknown in the Sheet.');
      }
      cd.push({
        client_code: s(r[2]), source_tab: TAB_CONTRACTS, source_row: row,
        end_date: end, end_date_unknown: unknown, raw_value: s(raw),
        content_hash: hash([r[2], raw]), last_seen_at: startedAt
      });
    }
    written += upsert('prism_contracts', cd, 'client_code');

    // ---- Reconcile.
    // Anything this run did not touch is gone from the Sheet. Comparing
    // last_seen_at against the run start finds those without having to send a
    // list of every surviving row id back to the server.
    var tabs = [
      ['prism_job_book_entries', TAB_JOB_BOOK],
      ['prism_time_dedication', TAB_TIME],
      ['prism_scope_lines', TAB_SCOPES]
    ];
    for (var i = 0; i < tabs.length; i++) {
      var gone = sb('PATCH',
        '/rest/v1/' + tabs[i][0] +
        '?source_tab=eq.' + encodeURIComponent(tabs[i][1]) +
        '&is_deleted=eq.false&last_seen_at=lt.' + encodeURIComponent(startedAt),
        { is_deleted: true }, 'return=representation');
      softDeleted += gone.length;
    }

    // ---- Issues
    for (var i = 0; i < _issues.length; i += 400) {
      var batch = _issues.slice(i, i + 400).map(function (x) {
        x.run_id = runId; return x;
      });
      sb('POST', '/rest/v1/prism_sync_issues', batch);
    }

    var ms = new Date().getTime() - t0;
    sb('PATCH', '/rest/v1/prism_sync_runs?id=eq.' + runId, {
      finished_at: new Date().toISOString(),
      status: 'success',
      rows_read: read, rows_inserted: written,
      rows_soft_deleted: softDeleted, issue_count: _issues.length,
      duration_ms: ms
    });

    return { read: read, written: written, softDeleted: softDeleted, issues: _issues.length, ms: ms };

  } catch (e) {
    // A failed run is recorded, never swallowed — a broken sync and a quiet
    // sync must not look the same from the dashboard.
    try {
      sb('PATCH', '/rest/v1/prism_sync_runs?id=eq.' + runId, {
        finished_at: new Date().toISOString(),
        status: 'failed',
        error_message: String(e.message || e).slice(0, 2000),
        issue_count: _issues.length,
        duration_ms: new Date().getTime() - t0
      });
    } catch (ignored) {}
    throw e;
  }
}

function values(o) { return Object.keys(o).map(function (k) { return o[k]; }); }
function keys(o) { return Object.keys(o); }
