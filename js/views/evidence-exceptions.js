/**
 * Evidence Exceptions.
 *
 * The honest counterpart to every clean number elsewhere. Two kinds of problem
 * land here:
 *
 *  - what the loader could not take at face value (quarantined values), and
 *  - what the record itself cannot answer (effort with no revenue, revenue
 *    with no effort, clients with no scope on file).
 *
 * None of these are errors in the pipeline. They are gaps in the evidence, and
 * the only dishonest thing to do with them is to let them disappear into a
 * total somewhere.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar } from '../ui/page.js';
import { rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { nameLookup, monthLabel } from '../data/prism.js';

const CODE_LABEL = {
  fx_rate_missing: 'No exchange rate on file',
  date_unparseable: 'Value in a date column is not a date',
  date_invalid: 'Date out of range',
  month_unparseable: 'Month not recognised',
  hours_unparseable: 'Hours value not numeric',
  contract_end_unknown: 'Contract end recorded as unknown',
};

const CODE_MEANING = {
  fx_rate_missing:
    'The amount is stored exactly as recorded, but has no USD equivalent, so it is excluded from any converted total rather than counted as zero.',
  date_unparseable:
    'The cell holds something that is not a date. The field is empty rather than filled with a guess.',
  date_invalid: 'The day or month is out of range — most often a typo in the year.',
  month_unparseable: 'The row could not be placed in a month, so it is absent from every monthly total.',
  hours_unparseable: 'The cell was skipped entirely; it produces no effort row.',
  contract_end_unknown: 'The source records "?" rather than a date. Kept as unknown, not as null.',
};

export function renderEvidenceExceptions(root, view) {
  const { prism, syncIssues, syncStatus } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, timeDedication, scopeLines, clients, employees } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const issues = syncIssues ?? [];

  // ---- structural gaps, derived rather than logged
  const revenueClients = new Set(jobBook.filter((r) => r.entry_type === 'revenue').map((r) => r.client_code));
  const effortClients = new Set(timeDedication.map((r) => r.client_code));
  const scopedClients = new Set(scopeLines.map((r) => r.client_code));

  const effortNoRevenue = [...effortClients].filter((c) => c && !revenueClients.has(c));
  const revenueNoEffort = [...revenueClients].filter((c) => c && !effortClients.has(c));
  const unscoped = [...new Set([...revenueClients, ...effortClients])].filter((c) => c && !scopedClients.has(c));

  // ---- coverage gaps: an employee-month with no submission
  const months = [...new Set(timeDedication.map((r) => r.month_start))].sort();
  const submitted = new Set(timeDedication.map((r) => `${r.employee_code}|${r.month_start}`));
  const activeEmployees = [...new Set(timeDedication.map((r) => r.employee_code))];
  const missingSubmissions = activeEmployees.length * months.length - submitted.size;

  const byCode = new Map();
  for (const i of issues) byCode.set(i.code, (byCode.get(i.code) ?? 0) + 1);

  const unconvertible = jobBook.filter(
    (r) => r.recognized_amount !== null && r.recognized_amount_usd === null,
  );

  root.append(
    toolbar([
      el('div', { class: 'legend' }, [
        tag(`${issues.length} quarantined`, 'note'),
        tag(`${effortNoRevenue.length + revenueNoEffort.length + unscoped.length} structural`, 'neutral'),
      ]),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    kpiRow([
      { label: 'Quarantined values', value: String(issues.length),
        meta: 'Left empty rather than guessed', tone: issues.length ? 'note' : undefined },
      { label: 'Amounts without USD', value: String(unconvertible.length),
        meta: 'Excluded from converted totals' },
      { label: 'Missing submissions', value: String(Math.max(0, missingSubmissions)),
        meta: 'Employee-months with no timesheet' },
      { label: 'Unscoped clients', value: String(unscoped.length),
        meta: 'Effort or revenue, no scope on file' },
    ]),
  );

  // ---- quarantined, grouped by cause
  const codeRows = [...byCode.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([code, n], i) => ({
      label: CODE_LABEL[code] ?? code,
      value: n,
      meta: code,
      color: seriesColor(i),
    }));

  root.append(
    panel({
      eyebrow: 'Quarantined',
      title: 'What the loader would have had to guess at',
      body: codeRows.length
        ? el('div', {}, [
            rankedBars({ items: codeRows, format: (n) => String(n) }),
            el('dl', { class: 'deflist', style: 'margin-top:var(--sp-5)' },
              [...byCode.keys()].flatMap((code) => [
                el('dt', { class: 'deflist__t', text: CODE_LABEL[code] ?? code }),
                el('dd', { class: 'deflist__d', text: CODE_MEANING[code] ?? 'No description on file.' }),
              ])),
          ])
        : el('p', { class: 'empty', text: 'Nothing was quarantined in the last run.' }),
      footnote: syncStatus
        ? `From load #${syncStatus.last_run_id} · ${syncStatus.status}. Every row still loaded; only the questionable field was left empty.`
        : 'Every row still loaded; only the questionable field was left empty.',
    }),
  );

  // ---- structural gaps
  const listPanel = (eyebrow, title, codes, note) =>
    panel({
      eyebrow,
      title,
      body: codes.length
        ? el('ul', { class: 'rank' },
            codes.slice(0, 14).sort((a, b) => clientName(a).localeCompare(clientName(b))).map((c) =>
              el('li', { class: 'list__row' }, [
                el('div', { class: 'list__main' }, [
                  el('p', { class: 'list__title', text: clientName(c) }),
                  el('p', { class: 'list__meta', text: c }),
                ]),
              ])))
        : el('p', { class: 'empty', text: 'None.' }),
      footnote: codes.length > 14 ? `${note} Showing 14 of ${codes.length}.` : note,
    });

  root.append(
    twoUp(
      listPanel('Coverage', 'Effort recorded, no revenue', effortNoRevenue,
        'These clients absorb time that no revenue row accounts for.'),
      listPanel('Coverage', 'Revenue recorded, no effort', revenueNoEffort,
        'Revenue with no matching timesheet — expected for Marovia, which files none.'),
    ),
    panel({
      eyebrow: 'Scope',
      title: 'Clients with no documented scope',
      body: unscoped.length
        ? el('ul', { class: 'rank' },
            unscoped.sort((a, b) => clientName(a).localeCompare(clientName(b))).map((c) =>
              el('li', { class: 'list__row' }, [
                el('div', { class: 'list__main' }, [
                  el('p', { class: 'list__title', text: clientName(c) }),
                  el('p', { class: 'list__meta', text: c }),
                ]),
              ])))
        : el('p', { class: 'empty', text: 'Every active client has a scope on file.' }),
      footnote:
        'Scope vs. Effort and Actual vs. Assumed can only cover clients with a documented breakdown. These are reported as unscoped, never as zero-scope.',
    }),
  );
}
