/**
 * Hours & Coverage.
 *
 * The precondition for every other operations view. Before any hours figure
 * means anything, you have to know how much of the expected timesheet grid was
 * actually filled in — because a low total can mean light months or simply
 * missing paperwork, and those call for opposite responses.
 *
 * Coverage here is measured against employees who submitted *at some point* in
 * the window. Measuring against headcount would be a different, larger number,
 * and the record does not carry headcount.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { heatmap, rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup, pivot } from '../data/prism.js';

let filters = { from: 'all', to: 'all' };

export function renderHoursCoverage(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { timeDedication, employees } = prism;
  const employeeName = nameLookup(employees, 'employee_code');

  const allMonths = monthsIn(timeDedication);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;
  const months = allMonths.filter((m) => m >= from && m <= to);

  const rows = timeDedication.filter((r) => r.month_start >= from && r.month_start <= to);
  const grid = pivot(rows, 'employee_code');

  const people = [...grid.entries()]
    .map(([code, byMonth]) => {
      const filed = months.filter((m) => byMonth.has(m));
      return {
        code,
        name: employeeName(code),
        byMonth,
        filed: filed.length,
        gaps: months.length - filed.length,
      };
    })
    .sort((a, b) => b.filed - a.filed || a.name.localeCompare(b.name));

  const expected = people.length * months.length;
  const received = people.reduce((s, p) => s + p.filed, 0);
  const coverage = expected ? received / expected : 0;

  const perMonth = months.map((m) => {
    const filed = people.filter((p) => p.byMonth.has(m)).length;
    return { month: m, filed, missing: people.length - filed };
  });

  root.append(
    toolbar([
      tag(`${Math.round(coverage * 100)}% COVERAGE`, coverage > 0.8 ? 'accent' : 'note'),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [
        { name: 'from', label: 'From', value: filters.from,
          options: [{ value: 'all', label: monthLabel(allMonths[0]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
        { name: 'to', label: 'To', value: filters.to,
          options: [{ value: 'all', label: monthLabel(allMonths[allMonths.length - 1]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
      ],
      {
        note: 'Coverage is measured against employees who submitted at least once',
        onChange: (n, v) => { filters[n] = v; renderHoursCoverage(root, view); },
      },
    ),

    kpiRow([
      { label: 'Employees submitting', value: String(people.length),
        meta: `At least one month in ${monthLabel(from)}–${monthLabel(to)}` },
      { label: 'Submissions received', value: String(received),
        meta: `Of ${expected} employee-months` },
      { label: 'Coverage', value: `${(coverage * 100).toFixed(0)}%`,
        meta: 'Received over expected' },
      { label: 'Missing submissions', value: String(expected - received),
        meta: 'Never read as zero effort', tone: expected - received ? 'note' : undefined },
    ]),

    panel({
      eyebrow: 'Grid',
      title: 'Who filed, and for which months',
      aside: tag('HATCHED = NO SUBMISSION', 'note'),
      body: heatmap({
        columns: months.map(monthLabel),
        rows: people.map((p) => ({
          label: p.name,
          cells: months.map((m) => ({
            // 1 marks a submission; the value itself is irrelevant here, only
            // its presence. Hours live on the Hours per Employee page.
            value: p.byMonth.has(m) ? 1 : null,
            title: p.byMonth.has(m)
              ? `${p.name} · ${monthLabel(m)} · filed`
              : `${p.name} · ${monthLabel(m)} · no submission`,
          })),
        })),
        format: () => '✓',
      }),
      footnote: 'Source · Calderra & Solvina time dedication. A tick means a timesheet exists, whatever it records.',
    }),

    twoUp(
      panel({
        eyebrow: 'By month',
        title: 'Submissions received per month',
        body: rankedBars({
          items: perMonth.map((m) => ({
            label: monthLabel(m.month), value: m.filed,
            meta: m.missing ? `${m.missing} missing` : 'complete',
            color: m.missing ? seriesColor(3) : seriesColor(2),
          })),
          format: (n) => String(n),
        }),
        footnote: 'A month with few submissions is a small sample, not a quiet month.',
      }),
      panel({
        eyebrow: 'By person',
        title: 'Months missing per employee',
        body: people.filter((p) => p.gaps).length
          ? rankedBars({
              items: people.filter((p) => p.gaps).slice(0, 12).map((p) => ({
                label: p.name, value: p.gaps,
                meta: `${p.filed}/${months.length} filed`,
                color: seriesColor(4),
              })),
              format: (n) => String(n),
            })
          : el('p', { class: 'empty', text: 'Everyone filed every month in this window.' }),
        footnote: 'Gaps are unknown effort, not absent effort.',
      }),
    ),
  );
}
