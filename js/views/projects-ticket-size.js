/**
 * Projects & Ticket Size.
 *
 * Ticket size is revenue per job-book row, per recognized month. A twelve-month
 * retainer therefore counts once per month rather than once at signature —
 * comparing an un-adjusted retainer against a one-off project fee would make
 * the retainer look enormous and tell you nothing.
 *
 * Median leads rather than mean, because a handful of very large rows drag the
 * mean somewhere no actual engagement sits.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar, segmented } from '../ui/page.js';
import { rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let cut = 'median';
let filters = { region: 'all', service: 'all', from: 'all', to: 'all' };

const CUTS = [
  { id: 'median', label: 'MEDIAN' },
  { id: 'mean', label: 'MEAN' },
  { id: 'spread', label: 'SPREAD' },
];

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Order-of-magnitude buckets — engagement values span four of them. */
const BANDS = [
  { label: 'Under 1K', min: 0, max: 1_000 },
  { label: '1K – 5K', min: 1_000, max: 5_000 },
  { label: '5K – 25K', min: 5_000, max: 25_000 },
  { label: '25K – 100K', min: 25_000, max: 100_000 },
  { label: '100K+', min: 100_000, max: Infinity },
];

export function renderProjectsTicketSize(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, clients, regions, services } = prism;
  const clientName = nameLookup(clients, 'client_code');

  const allMonths = monthsIn(jobBook);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;

  const rows = jobBook.filter(
    (r) =>
      r.entry_type === 'revenue' &&
      r.month_start >= from && r.month_start <= to &&
      r.recognized_amount_usd !== null && Number(r.recognized_amount_usd) > 0 &&
      (filters.region === 'all' || r.region_code === filters.region) &&
      (filters.service === 'all' || r.service_code === filters.service),
  );

  const values = rows.map((r) => Number(r.recognized_amount_usd));
  const med = median(values);
  const mean = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
  const largest = rows.length
    ? rows.reduce((a, b) => (Number(a.recognized_amount_usd) > Number(b.recognized_amount_usd) ? a : b))
    : null;
  const belowMedian = values.filter((v) => v < med).length;

  const banded = BANDS.map((b, i) => ({
    label: b.label,
    value: values.filter((v) => v >= b.min && v < b.max).length,
    sum: values.filter((v) => v >= b.min && v < b.max).reduce((s, v) => s + v, 0),
    color: seriesColor(i),
  }));

  const byClient = new Map();
  for (const r of rows) {
    if (!byClient.has(r.client_code)) byClient.set(r.client_code, []);
    byClient.get(r.client_code).push(Number(r.recognized_amount_usd));
  }
  const clientTickets = [...byClient.entries()]
    .map(([code, vs]) => ({
      code, name: clientName(code),
      n: vs.length,
      median: median(vs),
      mean: vs.reduce((s, v) => s + v, 0) / vs.length,
      max: Math.max(...vs),
    }))
    .sort((a, b) => (cut === 'mean' ? b.mean - a.mean : cut === 'spread' ? b.max - a.max : b.median - a.median));

  root.append(
    toolbar([
      segmented(CUTS, cut, (id) => { cut = id; renderProjectsTicketSize(root, view); }),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [
        { name: 'region', label: 'Region', value: filters.region,
          options: [{ value: 'all', label: 'All regions' },
            ...regions.map((r) => ({ value: r.region_code, label: r.name }))] },
        { name: 'service', label: 'Service', value: filters.service,
          options: [{ value: 'all', label: 'All services' },
            ...services.map((s) => ({ value: s.service_code, label: s.name }))] },
        { name: 'from', label: 'From', value: filters.from,
          options: [{ value: 'all', label: monthLabel(allMonths[0]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
        { name: 'to', label: 'To', value: filters.to,
          options: [{ value: 'all', label: monthLabel(allMonths[allMonths.length - 1]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
      ],
      {
        note: 'One row per recognized month — retainers are not counted once at signature',
        onChange: (n, v) => { filters[n] = v; renderProjectsTicketSize(root, view); },
      },
    ),

    kpiRow([
      { label: 'Revenue rows', value: String(rows.length), meta: 'Recognized, positive, convertible' },
      { label: 'Median ticket', value: fmt.money(med), meta: 'Per recognized month' },
      { label: 'Largest single row', value: largest ? fmt.money(Number(largest.recognized_amount_usd)) : '—',
        meta: largest ? clientName(largest.client_code) : '—' },
      { label: 'Mean ticket', value: fmt.money(mean),
        meta: mean > med * 1.5 ? 'Pulled well above the median by outliers' : 'Close to the median',
        tone: mean > med * 1.5 ? 'note' : undefined },
    ]),
  );

  if (!rows.length) {
    root.append(el('p', { class: 'empty', text: 'No revenue rows match this selection.' }));
    return;
  }

  root.append(
    twoUp(
      panel({
        eyebrow: 'Distribution',
        title: 'Engagement value, by band',
        body: rankedBars({
          items: banded,
          format: (n) => `${n} rows`,
        }),
        footnote: `${belowMedian} of ${values.length} rows sit below the median of ${fmt.money(med)}.`,
      }),
      panel({
        eyebrow: 'Concentration',
        title: 'Where the value sits',
        body: rankedBars({
          items: banded.map((b) => ({ label: b.label, value: b.sum, color: b.color,
            meta: `${b.value} row${b.value === 1 ? '' : 's'}` })),
          format: (v) => fmt.money(v),
        }),
        footnote: 'The band holding the most rows is rarely the band holding the most money.',
      }),
    ),

    panel({
      eyebrow: 'By client',
      title: cut === 'mean' ? 'Mean ticket per client'
        : cut === 'spread' ? 'Largest single row per client'
        : 'Median ticket per client',
      aside: tag('USD', 'neutral'),
      body: rankedBars({
        items: clientTickets.slice(0, 14).map((c, i) => ({
          label: c.name,
          value: cut === 'mean' ? c.mean : cut === 'spread' ? c.max : c.median,
          meta: `${c.n} row${c.n === 1 ? '' : 's'}`,
          color: seriesColor(0),
        })),
        format: (v) => fmt.money(v),
      }),
      footnote: 'Source · Collective Job Books. Costs and non-convertible rows are excluded.',
    }),
  );
}
