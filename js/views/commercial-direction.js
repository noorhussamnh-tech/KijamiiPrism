/**
 * Commercial Direction.
 *
 * Trend across recorded months only. The current month is almost always
 * partial, so including it would show a fall that is really just the calendar.
 * It is detected, excluded from every trend line, and named on the page.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, segmented } from '../ui/page.js';
import { rankedBars, stackedMonths, pairedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let lens = 'revenue';

const LENSES = [
  { id: 'revenue', label: 'REVENUE' },
  { id: 'mix', label: 'MIX' },
  { id: 'concentration', label: 'CONCENTRATION' },
];

export function renderCommercialDirection(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, clients } = prism;
  const clientName = nameLookup(clients, 'client_code');

  const revenue = jobBook.filter((r) => r.entry_type === 'revenue' && r.recognized_amount_usd !== null);
  const months = monthsIn(revenue);

  const totalFor = (m) =>
    revenue.filter((r) => r.month_start === m).reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
  const rowsFor = (m) => revenue.filter((r) => r.month_start === m).length;

  // A trailing month with far fewer rows than the ones before it is partial,
  // not a collapse. Excluded from trend rather than smoothed or annualised.
  const counts = months.map(rowsFor);
  const median = [...counts].sort((a, b) => a - b)[Math.floor(counts.length / 2)] || 0;
  const lastIsPartial = counts.length > 1 && counts[counts.length - 1] < median * 0.4;
  const complete = lastIsPartial ? months.slice(0, -1) : months;
  const partialMonth = lastIsPartial ? months[months.length - 1] : null;

  const series = complete.map((m) => ({ month: m, usd: totalFor(m) }));
  const first = series[0]?.usd ?? 0;
  const last = series[series.length - 1]?.usd ?? 0;
  const trend = first ? (last - first) / first : 0;

  // top-5 share per month
  const concentration = complete.map((m) => {
    const rows = revenue.filter((r) => r.month_start === m);
    const byClient = new Map();
    for (const r of rows) byClient.set(r.client_code, (byClient.get(r.client_code) ?? 0) + Number(r.recognized_amount_usd));
    const tot = [...byClient.values()].reduce((s, v) => s + v, 0);
    const top5 = [...byClient.values()].sort((a, b) => b - a).slice(0, 5).reduce((s, v) => s + v, 0);
    return { month: m, share: tot ? top5 / tot : 0, clients: byClient.size };
  });

  // service mix, first complete month vs last
  const mixFor = (m) => {
    const rows = revenue.filter((r) => r.month_start === m);
    const tot = rows.reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
    const by = new Map();
    for (const r of rows) {
      const k = r.service_code ?? '—';
      by.set(k, (by.get(k) ?? 0) + Number(r.recognized_amount_usd));
    }
    return { tot, by };
  };
  const mixA = complete.length ? mixFor(complete[0]) : { tot: 0, by: new Map() };
  const mixB = complete.length ? mixFor(complete[complete.length - 1]) : { tot: 0, by: new Map() };
  const allServices = [...new Set([...mixA.by.keys(), ...mixB.by.keys()])];
  const mixShift = allServices.map((s) => ({
    service: s,
    a: mixA.tot ? (mixA.by.get(s) ?? 0) / mixA.tot : 0,
    b: mixB.tot ? (mixB.by.get(s) ?? 0) / mixB.tot : 0,
  })).sort((x, y) => Math.abs(y.b - y.a) - Math.abs(x.b - x.a));
  const biggestShift = mixShift[0];

  root.append(
    toolbar([
      segmented(LENSES, lens, (id) => { lens = id; renderCommercialDirection(root, view); }),
      el('div', { class: 'legend' }, [
        partialMonth ? tag(`${monthLabel(partialMonth)} PARTIAL — EXCLUDED`, 'note') : el('span'),
        sourceLink(SOURCE_WORKBOOK_URL),
      ]),
    ]),

    kpiRow([
      { label: 'Complete months', value: String(complete.length),
        meta: partialMonth ? `${monthLabel(partialMonth)} excluded as partial` : 'None excluded' },
      { label: 'Revenue trend', value: `${trend >= 0 ? '+' : ''}${fmt.pct(trend)}`,
        meta: complete.length > 1 ? `${monthLabel(complete[0])} to ${monthLabel(complete[complete.length - 1])}` : '—',
        tone: trend < 0 ? 'note' : undefined },
      { label: 'Largest mix shift', value: biggestShift ? `${(biggestShift.b - biggestShift.a) >= 0 ? '+' : ''}${fmt.pct(biggestShift.b - biggestShift.a)}` : '—',
        meta: biggestShift ? biggestShift.service : '—' },
      { label: 'Top 5 share now', value: concentration.length ? fmt.pct(concentration[concentration.length - 1].share) : '—',
        meta: concentration.length > 1
          ? `${fmt.pct(concentration[0].share)} at the start of the window` : '—' },
    ]),
  );

  if (!complete.length) {
    root.append(el('p', { class: 'empty', text: 'No complete month of revenue on file.' }));
    return;
  }

  if (lens === 'mix') {
    root.append(
      panel({
        eyebrow: 'Mix shift',
        title: `Service mix, ${monthLabel(complete[0])} against ${monthLabel(complete[complete.length - 1])}`,
        aside: el('div', { class: 'legend' }, [
          el('span', { class: 'legend__item' }, [
            el('span', { class: 'legend__swatch', style: 'background:var(--pair-a)' }),
            el('span', { class: 'legend__label', text: monthLabel(complete[0]) })]),
          el('span', { class: 'legend__item' }, [
            el('span', { class: 'legend__swatch', style: 'background:var(--pair-b)' }),
            el('span', { class: 'legend__label', text: monthLabel(complete[complete.length - 1]) })]),
        ]),
        body: pairedBars({
          items: mixShift.map((s) => ({ label: s.service, a: s.a, b: s.b })),
          formatA: (v) => fmt.pct(v), formatB: (v) => fmt.pct(v),
        }),
        footnote: 'Two months are two points, not a trend. Read this as a direction, not a rate.',
      }),
    );
  } else if (lens === 'concentration') {
    root.append(
      panel({
        eyebrow: 'Concentration',
        title: 'Top 5 share of recognized revenue, by month',
        body: rankedBars({
          items: concentration.map((c) => ({
            label: monthLabel(c.month), value: c.share,
            meta: `${c.clients} clients billing`,
            color: c.share > 0.7 ? 'var(--s5)' : seriesColor(0),
          })),
          format: (v) => fmt.pct(v),
        }),
        footnote:
          'Pink above 70%. A rising share with a falling client count is dependency building, not growth.',
      }),
    );
  } else {
    const keys = [...new Set(revenue.map((r) => r.service_code ?? '—'))].slice(0, 6);
    root.append(
      panel({
        eyebrow: 'Trend',
        title: 'Recognized revenue by complete month',
        body: rankedBars({
          items: series.map((s) => ({
            label: monthLabel(s.month), value: s.usd,
            meta: `${rowsFor(s.month)} rows`, color: seriesColor(0),
          })),
          format: (v) => fmt.money(v),
        }),
        footnote: partialMonth
          ? `${monthLabel(partialMonth)} has ${rowsFor(partialMonth)} rows against a typical ${median} and is excluded as incomplete.`
          : 'Every month in the window looks complete.',
      }),
      panel({
        eyebrow: 'Composition',
        title: 'What the revenue was made of',
        aside: el('div', { class: 'legend' },
          keys.map((k, i) => el('span', { class: 'legend__item' }, [
            el('span', { class: 'legend__swatch', style: `background:${seriesColor(i)}` }),
            el('span', { class: 'legend__label', text: k }),
          ]))),
        body: stackedMonths({
          months: complete.map((m) => ({
            label: monthLabel(m),
            segments: keys.map((k) => ({
              key: k,
              value: revenue.filter((r) => r.month_start === m && (r.service_code ?? '—') === k)
                .reduce((s, r) => s + Number(r.recognized_amount_usd), 0),
            })),
          })),
          keys, format: (v) => fmt.money(v),
        }),
        footnote: 'Source · Collective Job Books, converted at each row’s date.',
      }),
    );
  }
}
