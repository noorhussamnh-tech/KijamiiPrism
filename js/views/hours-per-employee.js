/**
 * Hours per Month per Employee.
 *
 * The whole view turns on one distinction: an employee with no row for a month
 * did not submit, and an employee with a row of 0 recorded no time. Those are
 * different facts. The grid hatches the first and prints "0" for the second,
 * averages skip the first and include the second, and the totals never treat a
 * gap as a zero.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, toolbar, filterBar, kpiRow, segmented, sourceLink, panel, twoUp, tag } from '../ui/page.js';
import { heatmap, rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { MONTH_LABELS, monthLabel, monthsIn, nameLookup, pivot, REFERENCE_HOURS } from '../data/prism.js';

// Module-level so a repaint from realtime or a route bounce keeps the choice.
let sort = 'cumulative';
let filters = { region: 'all', client: 'all', from: 'all', to: 'all' };

const SORTS = [
  { id: 'cumulative', label: 'CUMULATIVE' },
  { id: 'peak', label: 'PEAK MONTH' },
  { id: 'az', label: 'A–Z' },
];

export function renderHoursPerEmployee(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { timeDedication, employees, clients } = prism;
  const employeeName = nameLookup(employees, 'employee_code');
  const clientName = nameLookup(clients, 'client_code');
  const clientSector = new Map(clients.map((c) => [c.client_code, c.sector]));

  // ---- filters, applied before anything is counted
  const allMonths = monthsIn(timeDedication);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;

  const rows = timeDedication.filter((r) => {
    if (filters.client !== 'all' && r.client_code !== filters.client) return false;
    if (r.month_start < from || r.month_start > to) return false;
    return true;
  });

  const months = allMonths.filter((m) => m >= from && m <= to);

  // ---- employee × month, summed across that employee's clients
  const grid = pivot(rows, 'employee_code');

  const perEmployee = [...grid.entries()].map(([code, byMonth]) => {
    const submitted = months.filter((m) => byMonth.has(m));
    const total = submitted.reduce((s, m) => s + byMonth.get(m), 0);
    return {
      code,
      name: employeeName(code),
      byMonth,
      total,
      submissions: submitted.length,
      peak: submitted.length ? Math.max(...submitted.map((m) => byMonth.get(m))) : 0,
      overReference: submitted.filter((m) => byMonth.get(m) > REFERENCE_HOURS).length,
    };
  });

  const ordered = [...perEmployee].sort((a, b) => {
    if (sort === 'az') return a.name.localeCompare(b.name);
    if (sort === 'peak') return b.peak - a.peak;
    return b.total - a.total;
  });

  // ---- headline figures
  const totalHours = perEmployee.reduce((s, e) => s + e.total, 0);
  const populatedMonths = months.filter((m) => rows.some((r) => r.month_start === m));
  const overReference = perEmployee.reduce((s, e) => s + e.overReference, 0);
  // Averages divide by months that actually carry submissions. Dividing by all
  // twelve would quietly count silence as effort-free work.
  const avgPerEmployee = perEmployee.length ? totalHours / perEmployee.length : 0;

  root.append(
    toolbar([
      segmented(SORTS, sort, (id) => { sort = id; renderHoursPerEmployee(root, view); }),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [
        {
          name: 'client', label: 'Client', value: filters.client,
          options: [{ value: 'all', label: 'All clients' },
            ...[...new Set(timeDedication.map((r) => r.client_code))]
              .filter(Boolean)
              .map((c) => ({ value: c, label: clientName(c) }))
              .sort((a, b) => a.label.localeCompare(b.label))],
        },
        {
          name: 'from', label: 'From', value: filters.from,
          options: [{ value: 'all', label: monthLabel(allMonths[0]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))],
        },
        {
          name: 'to', label: 'To', value: filters.to,
          options: [{ value: 'all', label: monthLabel(allMonths[allMonths.length - 1]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))],
        },
      ],
      {
        note: 'Totals never include months with no submission',
        onChange: (name, value) => { filters[name] = value; renderHoursPerEmployee(root, view); },
      },
    ),

    kpiRow([
      { label: 'Employees with recorded hours', value: String(perEmployee.length),
        meta: `${monthLabel(from)}–${monthLabel(to)}` },
      { label: 'Total recorded hours', value: fmt.hours(totalHours),
        meta: 'Sum of submitted timesheet cells' },
      { label: 'Average per employee', value: fmt.hours(avgPerEmployee),
        meta: `Across ${populatedMonths.length} populated month${populatedMonths.length === 1 ? '' : 's'}` },
      { label: 'Months above reference', value: String(overReference),
        meta: `Employee-months above ${REFERENCE_HOURS}h`, tone: overReference ? 'note' : undefined },
    ]),
  );

  if (!ordered.length) {
    root.append(el('p', { class: 'empty', text: 'No submissions match this selection.' }));
    return;
  }

  // ---- the grid
  root.append(
    panel({
      eyebrow: 'Grid',
      title: 'Recorded hours per employee per month',
      aside: tag('HATCHED = NO SUBMISSION', 'note'),
      body: heatmap({
        columns: months.map(monthLabel),
        rows: ordered.map((e) => ({
          label: e.name,
          cells: months.map((m) => {
            const v = e.byMonth.get(m);
            return {
              // undefined — not 0 — when the employee filed nothing that month.
              value: v === undefined ? null : v,
              title: v === undefined
                ? `${e.name} · ${monthLabel(m)} · no submission`
                : `${e.name} · ${monthLabel(m)} · ${v}h`,
            };
          }),
        })),
        format: (v) => String(Math.round(v)),
      }),
      footnote: 'Source · Egypt & UAE Time Dedication, joined on Employee Code from Master Mapping.',
    }),
  );

  // ---- aggregate + ranking
  const monthTotals = months.map((m) => ({
    label: monthLabel(m),
    value: rows.filter((r) => r.month_start === m).reduce((s, r) => s + Number(r.hours), 0),
    submitters: new Set(rows.filter((r) => r.month_start === m).map((r) => r.employee_code)).size,
  }));

  root.append(
    twoUp(
      panel({
        eyebrow: 'Aggregate',
        title: 'Total recorded hours per month',
        body: rankedBars({
          items: monthTotals.map((m) => ({
            label: m.label, value: m.value,
            meta: `${m.submitters} submitting`, color: seriesColor(1),
          })),
          format: fmt.hours,
        }),
        footnote: 'A month with fewer submitters is a smaller sample, not a quieter month.',
      }),
      panel({
        eyebrow: 'Ranking',
        title: 'Employees by recorded hours in the window',
        body: rankedBars({
          items: ordered.slice(0, 12).map((e) => ({
            label: e.name, value: e.total,
            meta: `${e.submissions}/${months.length} submissions`,
            color: e.overReference ? 'var(--s5)' : seriesColor(0),
          })),
          format: fmt.hours,
        }),
        footnote: `Pink marks an employee with at least one month above ${REFERENCE_HOURS}h.`,
      }),
    ),
  );
}
