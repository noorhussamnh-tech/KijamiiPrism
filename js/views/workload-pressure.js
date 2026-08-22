/**
 * Workload Pressure.
 *
 * Counts employee-months above a reference threshold, and — more usefully —
 * runs of consecutive months above it, because one heavy month is a deadline
 * and three in a row is a staffing problem.
 *
 * The honest limit, stated on the page: this reads recorded hours only. Anyone
 * working late without filing a timesheet is invisible here, so every figure
 * is a floor, not a true count.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { heatmap, rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup, pivot, REFERENCE_HOURS } from '../data/prism.js';

let threshold = REFERENCE_HOURS;

/** Longest run of consecutive months above the threshold. */
function longestRun(months, byMonth, limit) {
  let best = 0;
  let run = 0;
  for (const m of months) {
    const v = byMonth.get(m);
    if (v !== undefined && v > limit) run += 1;
    else run = 0;               // a gap breaks the run: unknown is not "over"
    if (run > best) best = run;
  }
  return best;
}

export function renderWorkloadPressure(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { timeDedication, employees } = prism;
  const employeeName = nameLookup(employees, 'employee_code');
  const months = monthsIn(timeDedication);
  const grid = pivot(timeDedication, 'employee_code');

  const people = [...grid.entries()]
    .map(([code, byMonth]) => {
      const filed = months.filter((m) => byMonth.has(m));
      const over = filed.filter((m) => byMonth.get(m) > threshold);
      return {
        code,
        name: employeeName(code),
        byMonth,
        over: over.length,
        run: longestRun(months, byMonth, threshold),
        peak: filed.length ? Math.max(...filed.map((m) => byMonth.get(m))) : 0,
        peakMonth: filed.length
          ? filed.reduce((a, b) => (byMonth.get(a) > byMonth.get(b) ? a : b))
          : null,
      };
    })
    .filter((p) => p.over > 0)
    .sort((a, b) => b.run - a.run || b.over - a.over || b.peak - a.peak);

  const sustained = people.filter((p) => p.run >= 3);
  const peak = people.length ? people.reduce((a, b) => (a.peak > b.peak ? a : b)) : null;

  root.append(
    toolbar([
      el('div', { class: 'legend' }, [
        tag(`${threshold}h REFERENCE`, 'accent'),
        tag(`${people.length} EMPLOYEES OVER`, people.length ? 'note' : 'neutral'),
      ]),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [{
        name: 'threshold', label: 'Reference', value: String(threshold),
        options: [100, 120, 140, 160, 180].map((h) => ({ value: String(h), label: `${h}h / month` })),
      }],
      {
        note: 'Recorded hours only — unrecorded overtime is invisible here',
        onChange: (_n, v) => { threshold = Number(v); renderWorkloadPressure(root, view); },
      },
    ),

    kpiRow([
      { label: 'Employees above reference', value: String(people.length),
        meta: `At least one month over ${threshold}h`, tone: people.length ? 'note' : undefined },
      { label: 'Sustained pressure', value: String(sustained.length),
        meta: 'Three or more consecutive months', tone: sustained.length ? 'note' : undefined },
      { label: 'Peak employee-month', value: peak ? fmt.hours(peak.peak) : '—',
        meta: peak ? `${peak.name} · ${monthLabel(peak.peakMonth)}` : 'Nobody above reference' },
      { label: 'Reference threshold', value: `${threshold}h`, meta: 'Hours per month' },
    ]),
  );

  if (!people.length) {
    root.append(el('p', { class: 'empty', text: `Nobody recorded a month above ${threshold}h.` }));
    return;
  }

  root.append(
    panel({
      eyebrow: 'Grid',
      title: 'Months above reference, per employee',
      aside: tag('HATCHED = NO SUBMISSION', 'note'),
      body: heatmap({
        columns: months.map(monthLabel),
        rows: people.map((p) => ({
          label: p.name,
          cells: months.map((m) => {
            const v = p.byMonth.get(m);
            return {
              value: v === undefined ? null : v,
              title: v === undefined
                ? `${p.name} · ${monthLabel(m)} · no submission`
                : `${p.name} · ${monthLabel(m)} · ${v}h${v > threshold ? ' — above reference' : ''}`,
            };
          }),
        })),
        format: (v) => String(Math.round(v)),
      }),
      footnote:
        'A gap breaks a run rather than extending it — an unfiled month is not evidence of a heavy one.',
    }),

    twoUp(
      panel({
        eyebrow: 'Sustained',
        title: 'Longest consecutive run above reference',
        body: rankedBars({
          items: people.slice(0, 12).map((p) => ({
            label: p.name, value: p.run,
            meta: `${p.over} month${p.over === 1 ? '' : 's'} total`,
            color: p.run >= 3 ? 'var(--s5)' : seriesColor(3),
          })),
          format: (n) => `${n} mo`,
        }),
        footnote: 'Pink marks three or more consecutive months — the point where a spike becomes a pattern.',
      }),
      panel({
        eyebrow: 'Peak',
        title: 'Heaviest single month recorded',
        body: rankedBars({
          items: [...people].sort((a, b) => b.peak - a.peak).slice(0, 12).map((p) => ({
            label: p.name, value: p.peak,
            meta: monthLabel(p.peakMonth), color: seriesColor(0),
          })),
          format: fmt.hours,
        }),
        footnote: 'Source · Calderra & Solvina time dedication.',
      }),
    ),
  );
}
