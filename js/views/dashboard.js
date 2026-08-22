/**
 * Management Dashboard.
 *
 * A summary, not a source. Every figure here is computed the same way as on
 * the page that owns it, and each panel links through to that page rather than
 * inviting anyone to act on a headline alone.
 *
 * It leads with coverage. A revenue figure is worth reading on its own; an
 * effort figure is only worth reading once you know how much of the timesheet
 * grid was actually filled in.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, syncFootnote } from '../ui/page.js';
import { rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { navigate } from '../router.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup, pivot, REFERENCE_HOURS } from '../data/prism.js';

const jump = (route, label) =>
  el('button', { class: 'linkbtn', type: 'button', text: label, onClick: () => navigate(route) });

export function renderDashboard(root, view) {
  const { prism, syncStatus, syncIssues } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, timeDedication, scopeLines, clients, employees } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const employeeName = nameLookup(employees, 'employee_code');

  const revenue = jobBook.filter((r) => r.entry_type === 'revenue');
  const convertible = revenue.filter((r) => r.recognized_amount_usd !== null);
  const totalUsd = convertible.reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
  const unconvertible = revenue.filter(
    (r) => r.recognized_amount !== null && r.recognized_amount_usd === null).length;

  const months = monthsIn(timeDedication);
  const grid = pivot(timeDedication, 'employee_code');
  const totalHours = timeDedication.reduce((s, t) => s + Number(t.hours), 0);
  const expected = grid.size * months.length;
  const received = [...grid.values()].reduce((s, m) => s + [...m.keys()].filter((k) => months.includes(k)).length, 0);
  const coverage = expected ? received / expected : 0;

  const activeClients = new Set([
    ...revenue.map((r) => r.client_code), ...timeDedication.map((t) => t.client_code),
  ].filter(Boolean));
  const scoped = new Set(scopeLines.map((s) => s.client_code));

  const exceptions =
    (syncIssues?.length ?? 0) +
    (expected - received) +
    [...activeClients].filter((c) => !scoped.has(c)).length;

  // ---- top clients
  const byClient = new Map();
  for (const r of convertible) {
    byClient.set(r.client_code, (byClient.get(r.client_code) ?? 0) + Number(r.recognized_amount_usd));
  }
  const topClients = [...byClient.entries()]
    .map(([code, usd]) => ({ name: clientName(code), usd }))
    .sort((a, b) => b.usd - a.usd).slice(0, 6);

  // ---- busiest people
  const topPeople = [...grid.entries()]
    .map(([code, byMonth]) => ({
      name: employeeName(code),
      hours: [...byMonth.values()].reduce((s, v) => s + v, 0),
      over: [...byMonth.values()].filter((v) => v > REFERENCE_HOURS).length,
    }))
    .sort((a, b) => b.hours - a.hours).slice(0, 6);

  // ---- monthly revenue
  const revMonths = monthsIn(convertible);
  const monthly = revMonths.map((m) => ({
    label: monthLabel(m),
    value: convertible.filter((r) => r.month_start === m)
      .reduce((s, r) => s + Number(r.recognized_amount_usd), 0),
  }));

  root.append(
    toolbar([
      el('div', { class: 'legend' }, [
        tag(`${Math.round(coverage * 100)}% COVERAGE`, coverage > 0.8 ? 'accent' : 'note'),
        unconvertible ? tag(`${unconvertible} ROWS UNCONVERTED`, 'note') : el('span'),
      ]),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    kpiRow([
      { label: 'Recognized revenue', value: fmt.money(totalUsd),
        meta: `${monthLabel(revMonths[0])}–${monthLabel(revMonths[revMonths.length - 1])}, converted` },
      { label: 'Recorded hours', value: fmt.hours(totalHours),
        meta: `${Math.round(coverage * 100)}% of the timesheet grid filled` },
      { label: 'Active clients', value: String(activeClients.size),
        meta: `${scoped.size} with a documented scope` },
      { label: 'Evidence exceptions', value: String(exceptions),
        meta: 'Gaps needing attention', tone: exceptions ? 'note' : undefined },
    ]),

    panel({
      eyebrow: 'Trend',
      title: 'Recognized revenue by month',
      aside: jump('commercial-direction', 'Commercial Direction →'),
      body: rankedBars({
        items: monthly.map((m) => ({ label: m.label, value: m.value, color: seriesColor(0) })),
        format: (v) => fmt.money(v),
      }),
      footnote: unconvertible
        ? `${unconvertible} revenue rows have no exchange rate on file and are excluded — see Evidence Exceptions.`
        : 'Every revenue row converted successfully.',
    }),

    twoUp(
      panel({
        eyebrow: 'Commercial',
        title: 'Largest clients by recognized revenue',
        aside: jump('revenue-concentration', 'Concentration →'),
        body: rankedBars({
          items: topClients.map((c) => ({
            label: c.name, value: c.usd, meta: fmt.pct(totalUsd ? c.usd / totalUsd : 0),
            color: seriesColor(0),
          })),
          format: (v) => fmt.money(v),
        }),
        footnote: `Top ${topClients.length} of ${byClient.size} clients with revenue.`,
      }),
      panel({
        eyebrow: 'Effort',
        title: 'Heaviest recorded workloads',
        aside: jump('workload-pressure', 'Workload Pressure →'),
        body: rankedBars({
          items: topPeople.map((p) => ({
            label: p.name, value: p.hours,
            meta: p.over ? `${p.over} month${p.over === 1 ? '' : 's'} over ${REFERENCE_HOURS}h` : 'within reference',
            color: p.over ? 'var(--s5)' : seriesColor(1),
          })),
          format: fmt.hours,
        }),
        footnote: 'Recorded hours only — unrecorded overtime is invisible.',
      }),
    ),

    panel({
      eyebrow: 'Confidence',
      title: 'What this dashboard cannot tell you',
      body: el('dl', { class: 'deflist' }, [
        el('dt', { class: 'deflist__t', text: 'Coverage' }),
        el('dd', { class: 'deflist__d',
          text: `${expected - received} employee-months have no timesheet. Those are unknown effort, not zero, and every hours figure above is a floor.` }),
        el('dt', { class: 'deflist__t', text: 'Regions' }),
        el('dd', { class: 'deflist__d',
          text: 'Marovia is the largest region by revenue and files no timesheets, so it contributes revenue here but no effort.' }),
        el('dt', { class: 'deflist__t', text: 'Scope' }),
        el('dd', { class: 'deflist__d',
          text: `${scoped.size} of ${activeClients.size} active clients have a documented scope, so scope comparisons cover a small slice of the book.` }),
        el('dt', { class: 'deflist__t', text: 'Currency' }),
        el('dd', { class: 'deflist__d',
          text: 'Converted at each row’s own date where one exists, otherwise that month’s average. Rows in a currency with no rate carry no USD figure at all.' }),
      ]),
      footnote: null,
    }),
  );

  const stamp = syncFootnote(syncStatus);
  if (stamp) root.append(stamp);
}
