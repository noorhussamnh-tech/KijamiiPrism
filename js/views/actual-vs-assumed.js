/**
 * Actual vs. Assumed Dedication.
 *
 * Deviation is actual minus assumed, computed per month rather than once
 * across the window, because a client that runs 40 hours over in March and 40
 * under in April is not "on scope" — it is volatile, and averaging hides that.
 *
 * Limited to the three clients with a documented breakdown. A positive bar is
 * a prompt to check whether the scope is current, not proof of an overrun.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, tag, sourceLink, toolbar, segmented } from '../ui/page.js';
import { deviationBars, heatmap, fmt } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup, REFERENCE_HOURS } from '../data/prism.js';

let mode = 'deviation';

const MODES = [
  { id: 'deviation', label: 'DEVIATION' },
  { id: 'monthly', label: 'MONTHLY' },
  { id: 'variance', label: 'VARIANCE' },
];

export function renderActualVsAssumed(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { scopeLines, timeDedication, clients } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const months = monthsIn(timeDedication);

  const assumedMonthly = new Map();
  for (const s of scopeLines) {
    assumedMonthly.set(
      s.client_code,
      (assumedMonthly.get(s.client_code) ?? 0) + Number(s.assumed_hours ?? 0),
    );
  }
  const scoped = [...assumedMonthly.keys()].filter((c) => assumedMonthly.get(c) > 0);

  // actual per client per month
  const actual = new Map();
  for (const t of timeDedication) {
    if (!actual.has(t.client_code)) actual.set(t.client_code, new Map());
    const m = actual.get(t.client_code);
    m.set(t.month_start, (m.get(t.month_start) ?? 0) + Number(t.hours));
  }

  const rows = scoped.map((code) => {
    const expect = assumedMonthly.get(code);
    const byMonth = actual.get(code) ?? new Map();
    const perMonth = months.map((m) => {
      const a = byMonth.get(m);
      // No submission means no comparison. Treating it as 0 would manufacture
      // a deviation of exactly minus-the-whole-scope, every time.
      return a === undefined ? null : a - expect;
    });
    const observed = perMonth.filter((d) => d !== null);
    return {
      code, name: clientName(code), expect, byMonth, perMonth,
      total: observed.reduce((s, d) => s + d, 0),
      observedMonths: observed.length,
      over: observed.filter((d) => d > 0).length,
      under: observed.filter((d) => d < 0).length,
      swing: observed.length ? Math.max(...observed.map(Math.abs)) : 0,
    };
  }).sort((a, b) => Math.abs(b.total) - Math.abs(a.total));

  const totalDeviation = rows.reduce((s, r) => s + r.total, 0);

  root.append(
    toolbar([
      segmented(MODES, mode, (id) => { mode = id; renderActualVsAssumed(root, view); }),
      el('div', { class: 'legend' }, [tag(`${rows.length} SCOPED CLIENTS`, 'accent'), sourceLink(SOURCE_WORKBOOK_URL)]),
    ]),

    kpiRow([
      { label: 'Clients compared', value: String(rows.length), meta: 'With both scope and effort on file' },
      { label: 'Net deviation', value: `${totalDeviation >= 0 ? '+' : ''}${fmt.hours(totalDeviation)}`,
        meta: 'Actual minus assumed, observed months only',
        tone: Math.abs(totalDeviation) > 100 ? 'note' : undefined },
      { label: 'Client-months over', value: String(rows.reduce((s, r) => s + r.over, 0)),
        meta: 'Effort beyond documented scope' },
      { label: 'Client-months under', value: String(rows.reduce((s, r) => s + r.under, 0)),
        meta: 'Effort below documented scope' },
    ]),
  );

  if (!rows.length) {
    root.append(el('p', { class: 'empty', text: 'No client has both a documented scope and recorded effort.' }));
    return;
  }

  if (mode === 'monthly') {
    root.append(
      panel({
        eyebrow: 'Monthly',
        title: 'Deviation from assumed dedication, per month',
        aside: tag('HATCHED = NO SUBMISSION', 'note'),
        body: heatmap({
          columns: months.map(monthLabel),
          rows: rows.map((r) => ({
            label: r.name,
            cells: r.perMonth.map((d, i) => ({
              value: d === null ? null : d,
              title: d === null
                ? `${r.name} · ${monthLabel(months[i])} · no submission, no comparison`
                : `${r.name} · ${monthLabel(months[i])} · ${d >= 0 ? '+' : ''}${Math.round(d)}h vs ${r.expect}h assumed`,
            })),
          })),
          format: (v) => `${v >= 0 ? '+' : ''}${Math.round(v)}`,
        }),
        footnote:
          'A month with no timesheet is left hatched rather than counted as the full scope missed.',
      }),
    );
  } else if (mode === 'variance') {
    root.append(
      panel({
        eyebrow: 'Variance',
        title: 'How far each client swings from its scope',
        body: el('div', { class: 'table-wrap' }, [
          el('table', { class: 'table' }, [
            el('thead', {}, [el('tr', {}, [
              el('th', { text: 'Client' }), el('th', { text: 'Assumed / mo' }),
              el('th', { text: 'Months observed' }), el('th', { text: 'Over' }),
              el('th', { text: 'Under' }), el('th', { text: 'Largest swing' }),
              el('th', { text: 'Net' })])]),
            el('tbody', {}, rows.map((r) =>
              el('tr', {}, [
                el('td', {}, [el('p', { class: 'table__title', text: r.name })]),
                el('td', { class: 'table__muted', text: fmt.hours(r.expect) }),
                el('td', { class: 'table__muted', text: String(r.observedMonths) }),
                el('td', { class: 'table__muted', text: String(r.over) }),
                el('td', { class: 'table__muted', text: String(r.under) }),
                el('td', { class: 'table__muted', text: fmt.hours(r.swing) }),
                el('td', { class: r.total >= 0 ? 'table__muted is-late' : 'table__muted',
                  text: `${r.total >= 0 ? '+' : ''}${fmt.hours(r.total)}` }),
              ]))),
          ]),
        ]),
        footnote:
          'A client with equal months over and under is volatile, not on-scope. Net alone would hide that.',
      }),
    );
  } else {
    root.append(
      panel({
        eyebrow: 'Deviation',
        title: 'Net hours beyond or below documented dedication',
        body: deviationBars({
          items: rows.map((r) => ({ label: r.name, value: r.total })),
          format: (v) => fmt.hours(Math.abs(v)),
        }),
        footnote:
          `Assumed is ${REFERENCE_HOURS}h x the documented percentage, per month. Pink is over scope, teal under.`,
      }),
      panel({
        eyebrow: 'Per month',
        title: 'Where the deviation came from',
        body: deviationBars({
          items: rows.flatMap((r) =>
            r.perMonth
              .map((d, i) => ({ d, m: months[i] }))
              .filter((x) => x.d !== null && Math.abs(x.d) > 1)
              .map((x) => ({ label: `${r.name} · ${monthLabel(x.m)}`, value: x.d }))),
          format: (v) => fmt.hours(Math.abs(v)),
        }),
        footnote: 'Client-months within an hour of scope are omitted as noise.',
      }),
    );
  }
}
