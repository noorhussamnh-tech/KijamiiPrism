/**
 * Regional Actuals.
 *
 * Egypt, UAE, KSA and Non-UAE side by side on recorded revenue and recorded
 * effort.
 *
 * One asymmetry runs through this page and is stated rather than hidden: the
 * timesheet workbook covers Egypt and UAE only. KSA is the largest region by
 * revenue and files no timesheets at all, so its effort column is not zero —
 * it is unmeasured. Every effort figure here is labelled accordingly.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { rankedBars, stackedMonths, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

// Regions the timesheet workbook actually covers. Anything else has revenue
// but no measurable effort, which is a different statement from "no effort".
const TIMESHEET_REGIONS = new Set(['Egypt', 'UAE']);

let filters = { from: 'all', to: 'all' };

export function renderRegionalActuals(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, timeDedication, clients, regions } = prism;
  const clientRegion = new Map();
  for (const r of jobBook) if (r.client_code && r.region_code) clientRegion.set(r.client_code, r.region_code);

  const allMonths = monthsIn(jobBook);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;
  const months = allMonths.filter((m) => m >= from && m <= to);

  const inWindow = (m) => m >= from && m <= to;

  const revenue = jobBook.filter((r) => r.entry_type === 'revenue' && inWindow(r.month_start));
  const cost = jobBook.filter((r) => r.entry_type === 'cost' && inWindow(r.month_start));

  const regionCodes = [...new Set(jobBook.map((r) => r.region_code).filter(Boolean))].sort();

  const summary = regionCodes.map((code) => {
    const rev = revenue.filter((r) => r.region_code === code && r.recognized_amount_usd !== null)
      .reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
    const cst = cost.filter((r) => r.region_code === code && r.recognized_amount_usd !== null)
      .reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
    // Effort attaches to clients, and a client's region comes from the job book.
    const hours = timeDedication
      .filter((t) => inWindow(t.month_start) && clientRegion.get(t.client_code) === code)
      .reduce((s, t) => s + Number(t.hours), 0);
    return {
      code, rev, cst, hours,
      measurable: TIMESHEET_REGIONS.has(code),
      clients: new Set(revenue.filter((r) => r.region_code === code).map((r) => r.client_code)).size,
    };
  }).sort((a, b) => b.rev - a.rev);

  const totalRev = summary.reduce((s, r) => s + r.rev, 0);
  const measurableHours = summary.filter((r) => r.measurable).reduce((s, r) => s + r.hours, 0);
  const unmeasuredRev = summary.filter((r) => !r.measurable).reduce((s, r) => s + r.rev, 0);

  root.append(
    toolbar([
      tag(`${regionCodes.length} REGIONS`, 'neutral'),
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
        note: 'Converted to USD at the rate for each row’s date',
        onChange: (n, v) => { filters[n] = v; renderRegionalActuals(root, view); },
      },
    ),

    kpiRow([
      { label: 'Recognized revenue', value: fmt.money(totalRev), meta: 'All regions, converted' },
      { label: 'Measured effort', value: fmt.hours(measurableHours), meta: 'Egypt and UAE only' },
      { label: 'Revenue without effort data', value: fmt.money(unmeasuredRev),
        meta: 'Regions filing no timesheets', tone: unmeasuredRev ? 'note' : undefined },
      { label: 'Regions', value: String(regionCodes.length), meta: 'Present in the job book' },
    ]),

    twoUp(
      panel({
        eyebrow: 'Commercial',
        title: 'Recognized revenue by region',
        body: rankedBars({
          items: summary.map((r, i) => ({
            label: r.code, value: r.rev,
            meta: `${fmt.pct(totalRev ? r.rev / totalRev : 0)} · ${r.clients} clients`,
            color: seriesColor(i),
          })),
          format: (v) => fmt.money(v),
        }),
        footnote: 'Costs are recorded separately and are not netted off here.',
      }),
      panel({
        eyebrow: 'Effort',
        title: 'Recorded hours by region',
        aside: tag('EGYPT & UAE ONLY', 'note'),
        body: el('ul', { class: 'rank' },
          summary.map((r, i) =>
            el('li', { class: 'rank__row' }, [
              el('span', { class: 'rank__label', text: r.code, title: r.code }),
              el('span', { class: 'rank__track' }, [
                el('span', {
                  class: 'rank__fill',
                  style: `width:${measurableHours && r.measurable ? (r.hours / measurableHours) * 100 : 0}%;` +
                    `background:${seriesColor(i)}`,
                }),
              ]),
              el('span', { class: 'rank__nums' }, [
                el('span', { class: 'rank__value', text: r.measurable ? fmt.hours(r.hours) : 'not measured' }),
                el('span', { class: 'rank__meta', text: r.measurable ? 'recorded' : 'no timesheets filed' }),
              ]),
            ]))),
        footnote:
          'KSA and Non-UAE file no timesheets. Their effort is unmeasured, which is not the same as zero — no revenue-per-hour figure is offered for them.',
      }),
    ),
  );

  // Monthly revenue split by region
  const keys = summary.map((r) => r.code);
  const monthly = months.map((m) => ({
    label: monthLabel(m),
    segments: keys.map((code) => ({
      key: code,
      value: revenue
        .filter((r) => r.month_start === m && r.region_code === code && r.recognized_amount_usd !== null)
        .reduce((s, r) => s + Number(r.recognized_amount_usd), 0),
    })),
  }));

  root.append(
    panel({
      eyebrow: 'Monthly',
      title: 'Recognized revenue by region, per month',
      aside: el('div', { class: 'legend' },
        keys.map((k, i) => el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: `background:${seriesColor(i)}` }),
          el('span', { class: 'legend__label', text: k }),
        ]))),
      body: stackedMonths({ months: monthly, keys, format: (v) => fmt.money(v) }),
      footnote: 'Source · Collective Job Books. Region is taken from the job-book row, not inferred from the client.',
    }),
  );
}
