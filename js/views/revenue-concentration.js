/**
 * Revenue Concentration.
 *
 * Measured on recognized revenue inside the selected window — not contracted
 * value, not pipeline. Rows whose currency has no rate on file are excluded
 * from the converted total and counted separately, so a concentration figure
 * is never computed over a silently incomplete base.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar, segmented } from '../ui/page.js';
import { rankedBars, stackedMonths, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let topN = 'top5';
let filters = { region: 'all', from: 'all', to: 'all' };

const CUTS = [
  { id: 'top5', label: 'TOP 5' },
  { id: 'top10', label: 'TOP 10' },
  { id: 'all', label: 'ALL' },
];

export function renderRevenueConcentration(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, clients, regions } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const sectorOf = new Map(clients.map((c) => [c.client_code, c.sector]));

  const allMonths = monthsIn(jobBook);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;
  const months = allMonths.filter((m) => m >= from && m <= to);

  const revenue = jobBook.filter(
    (r) =>
      r.entry_type === 'revenue' &&
      r.month_start >= from && r.month_start <= to &&
      (filters.region === 'all' || r.region_code === filters.region),
  );

  const converted = revenue.filter((r) => r.recognized_amount_usd !== null);
  const unconverted = revenue.filter(
    (r) => r.recognized_amount !== null && r.recognized_amount_usd === null,
  );

  const byClient = new Map();
  for (const r of converted) {
    byClient.set(r.client_code, (byClient.get(r.client_code) ?? 0) + Number(r.recognized_amount_usd));
  }
  const ranked = [...byClient.entries()]
    .map(([code, usd]) => ({ code, name: clientName(code), usd, sector: sectorOf.get(code) }))
    .sort((a, b) => b.usd - a.usd);

  const total = ranked.reduce((s, c) => s + c.usd, 0);
  const cut = topN === 'top5' ? 5 : topN === 'top10' ? 10 : ranked.length;
  const topShare = total ? ranked.slice(0, 5).reduce((s, c) => s + c.usd, 0) / total : 0;
  const largest = ranked[0];

  root.append(
    toolbar([
      segmented(CUTS, topN, (id) => { topN = id; renderRevenueConcentration(root, view); }),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [
        { name: 'region', label: 'Region', value: filters.region,
          options: [{ value: 'all', label: 'All regions' },
            ...regions.map((r) => ({ value: r.region_code, label: r.name }))] },
        { name: 'from', label: 'From', value: filters.from,
          options: [{ value: 'all', label: monthLabel(allMonths[0]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
        { name: 'to', label: 'To', value: filters.to,
          options: [{ value: 'all', label: monthLabel(allMonths[allMonths.length - 1]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
      ],
      {
        note: 'Totals never include future empty months',
        onChange: (n, v) => { filters[n] = v; renderRevenueConcentration(root, view); },
      },
    ),

    kpiRow([
      { label: 'Recognized revenue', value: fmt.money(total),
        meta: `${monthLabel(from)}–${monthLabel(to)}, converted to USD` },
      { label: 'Top 5 share', value: total ? fmt.pct(topShare) : '—',
        meta: 'Of recognized revenue', tone: topShare > 0.6 ? 'note' : undefined },
      { label: 'Clients with revenue', value: String(ranked.length),
        meta: 'Distinct clients in the job book' },
      { label: 'Largest single client', value: largest ? fmt.pct(largest.usd / total) : '—',
        meta: largest ? largest.name : 'No revenue in this window' },
    ]),
  );

  if (!ranked.length) {
    root.append(el('p', { class: 'empty', text: 'No convertible revenue in this selection.' }));
    return;
  }

  root.append(
    panel({
      eyebrow: 'Ranking',
      title: 'Recognized revenue by client',
      aside: tag('USD', 'neutral'),
      body: rankedBars({
        items: ranked.slice(0, cut).map((c, i) => ({
          label: c.name,
          value: c.usd,
          meta: `${fmt.pct(c.usd / total)} · ${c.sector ?? '—'}`,
          color: seriesColor(i < 5 ? 0 : 1),
        })),
        format: (v) => fmt.money(v),
      }),
      footnote: unconverted.length
        ? `${unconverted.length} row${unconverted.length === 1 ? '' : 's'} excluded — no exchange rate on file for that currency. They are counted in Evidence Exceptions, never as zero.`
        : 'Every revenue row in this window converted successfully.',
    }),
  );

  // Monthly mix, top 6 clients as series and the remainder grouped.
  const top6 = ranked.slice(0, 6).map((c) => c.code);
  const keys = [...top6.map(clientName), 'Other'];
  const monthly = months.map((m) => {
    const rows = converted.filter((r) => r.month_start === m);
    const segments = top6.map((code) => ({
      key: clientName(code),
      value: rows.filter((r) => r.client_code === code)
        .reduce((s, r) => s + Number(r.recognized_amount_usd), 0),
    }));
    segments.push({
      key: 'Other',
      value: rows.filter((r) => !top6.includes(r.client_code))
        .reduce((s, r) => s + Number(r.recognized_amount_usd), 0),
    });
    return { label: monthLabel(m), segments };
  });

  root.append(
    panel({
      eyebrow: 'Monthly',
      title: 'Recognized revenue by client, per month',
      aside: el('div', { class: 'legend' },
        keys.map((k, i) => el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: `background:${seriesColor(i)}` }),
          el('span', { class: 'legend__label', text: k }),
        ]))),
      body: stackedMonths({ months: monthly, keys, format: (v) => fmt.money(v) }),
      footnote: 'Top 6 clients by recognized revenue; everything else grouped as Other.',
    }),
  );
}
