/**
 * Revenue vs. Hours.
 *
 * Hours attach to clients directly in the timesheet, so nothing is attributed
 * here — unlike the per-service view. That makes this the more trustworthy of
 * the two comparisons.
 *
 * Revenue per hour is only offered where both sides exist. A client with
 * revenue and no timesheet gets no rate rather than an infinite one, and a
 * client with effort and no revenue is listed separately rather than shown as
 * earning zero per hour.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { pairedBars, rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let filters = { region: 'all', from: 'all', to: 'all' };

export function renderRevenueVsHours(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, timeDedication, clients, regions } = prism;
  const clientName = nameLookup(clients, 'client_code');

  const allMonths = monthsIn(jobBook);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;
  const inWindow = (m) => m >= from && m <= to;

  const revenue = jobBook.filter(
    (r) => r.entry_type === 'revenue' && inWindow(r.month_start) &&
      (filters.region === 'all' || r.region_code === filters.region),
  );
  const effort = timeDedication.filter((t) => inWindow(t.month_start));

  const revByClient = new Map();
  for (const r of revenue) {
    if (r.recognized_amount_usd === null) continue;
    revByClient.set(r.client_code, (revByClient.get(r.client_code) ?? 0) + Number(r.recognized_amount_usd));
  }
  const hrsByClient = new Map();
  for (const t of effort) {
    hrsByClient.set(t.client_code, (hrsByClient.get(t.client_code) ?? 0) + Number(t.hours));
  }

  const both = [...revByClient.keys()]
    .filter((c) => hrsByClient.has(c) && hrsByClient.get(c) > 0)
    .map((c) => ({
      code: c, name: clientName(c),
      usd: revByClient.get(c), hours: hrsByClient.get(c),
      rate: revByClient.get(c) / hrsByClient.get(c),
    }))
    .sort((a, b) => b.usd - a.usd);

  const revenueNoHours = [...revByClient.keys()].filter((c) => !hrsByClient.has(c) || !hrsByClient.get(c));
  const hoursNoRevenue = [...hrsByClient.keys()].filter((c) => c && !revByClient.has(c));

  const totalUsd = both.reduce((s, c) => s + c.usd, 0);
  const totalHrs = both.reduce((s, c) => s + c.hours, 0);

  root.append(
    toolbar([
      tag(`${both.length} CLIENTS COMPARABLE`, 'neutral'),
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
        note: 'Hours are recorded against clients directly — no attribution',
        onChange: (n, v) => { filters[n] = v; renderRevenueVsHours(root, view); },
      },
    ),

    kpiRow([
      { label: 'Comparable revenue', value: fmt.money(totalUsd), meta: 'Clients with both sides on file' },
      { label: 'Comparable hours', value: fmt.hours(totalHrs), meta: 'Against the same clients' },
      { label: 'Revenue per hour', value: totalHrs ? fmt.money(totalUsd / totalHrs) : '—',
        meta: 'Across comparable clients only' },
      { label: 'Clients without hours', value: String(revenueNoHours.length),
        meta: 'Revenue but no timesheet', tone: revenueNoHours.length ? 'note' : undefined },
    ]),
  );

  if (!both.length) {
    root.append(el('p', { class: 'empty', text: 'No client has both revenue and effort in this selection.' }));
    return;
  }

  root.append(
    panel({
      eyebrow: 'Share gap',
      title: 'Revenue share against effort share, by client',
      aside: el('div', { class: 'legend' }, [
        el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: 'background:var(--pair-a)' }),
          el('span', { class: 'legend__label', text: 'Recognized revenue' })]),
        el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: 'background:var(--pair-b)' }),
          el('span', { class: 'legend__label', text: 'Recorded hours' })]),
      ]),
      body: pairedBars({
        items: both.slice(0, 14).map((c) => ({
          label: c.name,
          a: totalUsd ? c.usd / totalUsd : 0,
          b: totalHrs ? c.hours / totalHrs : 0,
        })),
        formatA: (v) => fmt.pct(v),
        formatB: (v) => fmt.pct(v),
      }),
      footnote:
        'A revenue bar much longer than its effort bar is an efficient account; the reverse is one absorbing more than it earns.',
    }),

    twoUp(
      panel({
        eyebrow: 'Rate',
        title: 'Revenue per recorded hour',
        body: rankedBars({
          items: [...both].sort((a, b) => b.rate - a.rate).slice(0, 12).map((c) => ({
            label: c.name, value: c.rate,
            meta: `${fmt.money(c.usd)} · ${fmt.hours(c.hours)}`,
            color: seriesColor(0),
          })),
          format: (v) => `${Math.round(v)} USD/h`,
        }),
        footnote: 'Only meaningful where coverage is high — a partial timesheet inflates the rate.',
      }),
      panel({
        eyebrow: 'Excluded',
        title: 'Clients that cannot be compared',
        body: el('div', {}, [
          el('p', { class: 'panel__eyebrow', text: `Revenue, no hours (${revenueNoHours.length})` }),
          el('ul', { class: 'rank', style: 'margin:var(--sp-2) 0 var(--sp-4)' },
            revenueNoHours.slice(0, 8).map((c) =>
              el('li', { class: 'list__row' }, [
                el('div', { class: 'list__main' }, [
                  el('p', { class: 'list__title', text: clientName(c) }),
                  el('p', { class: 'list__meta', text: fmt.money(revByClient.get(c)) })]),
              ]))),
          el('p', { class: 'panel__eyebrow', text: `Hours, no revenue (${hoursNoRevenue.length})` }),
          el('ul', { class: 'rank', style: 'margin-top:var(--sp-2)' },
            hoursNoRevenue.slice(0, 8).map((c) =>
              el('li', { class: 'list__row' }, [
                el('div', { class: 'list__main' }, [
                  el('p', { class: 'list__title', text: clientName(c) }),
                  el('p', { class: 'list__meta', text: fmt.hours(hrsByClient.get(c)) })]),
              ]))),
        ]),
        footnote:
          'Neither group gets a rate. Dividing by a missing side would invent a number, not reveal one.',
      }),
    ),
  );
}
