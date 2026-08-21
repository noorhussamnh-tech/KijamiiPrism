/**
 * Client Intelligence.
 *
 * One row per client, aggregating exactly the same records the operations
 * views read. Nothing here is inferred — where a client is missing revenue,
 * effort or scope, the cell says so rather than showing a zero that would sum
 * into a total somewhere and quietly understate it.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let sort = 'revenue';
let filters = { region: 'all', sector: 'all' };

export function renderClientIntelligence(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { jobBook, timeDedication, scopeLines, contracts, clients, regions } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const sectorOf = new Map(clients.map((c) => [c.client_code, c.sector]));
  const contractOf = new Map(contracts.map((c) => [c.client_code, c]));

  const regionOf = new Map();
  for (const r of jobBook) if (r.client_code && r.region_code) regionOf.set(r.client_code, r.region_code);

  const codes = [...new Set([
    ...jobBook.map((r) => r.client_code),
    ...timeDedication.map((t) => t.client_code),
  ])].filter(Boolean);

  const profiles = codes.map((code) => {
    const rev = jobBook.filter((r) => r.client_code === code && r.entry_type === 'revenue');
    const cost = jobBook.filter((r) => r.client_code === code && r.entry_type === 'cost');
    const eff = timeDedication.filter((t) => t.client_code === code);
    const usd = rev.filter((r) => r.recognized_amount_usd !== null)
      .reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
    const costUsd = cost.filter((r) => r.recognized_amount_usd !== null)
      .reduce((s, r) => s + Number(r.recognized_amount_usd), 0);
    const hours = eff.reduce((s, t) => s + Number(t.hours), 0);
    const scope = scopeLines.filter((s) => s.client_code === code);
    return {
      code, name: clientName(code),
      sector: sectorOf.get(code), region: regionOf.get(code),
      hasRevenue: rev.length > 0, hasEffort: eff.length > 0, hasScope: scope.length > 0,
      usd, costUsd, hours,
      services: new Set(rev.map((r) => r.service_code).filter(Boolean)).size,
      people: new Set(eff.map((t) => t.employee_code)).size,
      months: new Set(rev.map((r) => r.month_start)).size,
      rate: hours > 0 && usd > 0 ? usd / hours : null,
      contract: contractOf.get(code),
      unconvertible: rev.filter((r) => r.recognized_amount !== null && r.recognized_amount_usd === null).length,
    };
  });

  const visible = profiles
    .filter((p) => filters.region === 'all' || p.region === filters.region)
    .filter((p) => filters.sector === 'all' || p.sector === filters.sector)
    .sort((a, b) =>
      sort === 'hours' ? b.hours - a.hours
      : sort === 'name' ? a.name.localeCompare(b.name)
      : b.usd - a.usd);

  const incomplete = visible.filter((p) => !p.hasRevenue || !p.hasEffort || !p.hasScope).length;
  const sectors = [...new Set(clients.map((c) => c.sector).filter(Boolean))].sort();

  const yesNo = (ok, label) =>
    el('span', { class: ok ? 'tag tag--accent' : 'tag tag--neutral', text: ok ? label : `no ${label.toLowerCase()}` });

  root.append(
    toolbar([
      el('div', { class: 'segmented', role: 'tablist' },
        [['revenue', 'BY REVENUE'], ['hours', 'BY HOURS'], ['name', 'A–Z']].map(([id, label]) =>
          el('button', {
            class: `segmented__opt${sort === id ? ' segmented__opt--on' : ''}`,
            type: 'button', text: label,
            onClick: () => { sort = id; renderClientIntelligence(root, view); },
          }))),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      [
        { name: 'region', label: 'Region', value: filters.region,
          options: [{ value: 'all', label: 'All regions' },
            ...regions.map((r) => ({ value: r.region_code, label: r.name }))] },
        { name: 'sector', label: 'Sector', value: filters.sector,
          options: [{ value: 'all', label: 'All sectors' },
            ...sectors.map((s) => ({ value: s, label: s }))] },
      ],
      {
        note: 'Every figure aggregates the same records the operations views read',
        onChange: (n, v) => { filters[n] = v; renderClientIntelligence(root, view); },
      },
    ),

    kpiRow([
      { label: 'Clients profiled', value: String(visible.length), meta: 'With any record on file' },
      { label: 'Revenue covered', value: fmt.money(visible.reduce((s, p) => s + p.usd, 0)),
        meta: 'Across profiled clients' },
      { label: 'Effort covered', value: fmt.hours(visible.reduce((s, p) => s + p.hours, 0)),
        meta: 'Across profiled clients' },
      { label: 'Incomplete profiles', value: String(incomplete),
        meta: 'Missing revenue, effort or scope', tone: incomplete ? 'note' : undefined },
    ]),

    panel({
      eyebrow: 'Profiles',
      title: 'One row per client',
      aside: tag('USD', 'neutral'),
      body: el('div', { class: 'table-wrap' }, [
        el('table', { class: 'table' }, [
          el('thead', {}, [el('tr', {}, [
            el('th', { text: 'Client' }), el('th', { text: 'Region' }),
            el('th', { text: 'Revenue' }), el('th', { text: 'Cost' }),
            el('th', { text: 'Hours' }), el('th', { text: 'USD / h' }),
            el('th', { text: 'Services' }), el('th', { text: 'People' }),
            el('th', { text: 'On file' })])]),
          el('tbody', {}, visible.map((p) =>
            el('tr', {}, [
              el('td', {}, [
                el('p', { class: 'table__title', text: p.name }),
                el('p', { class: 'table__sub', text: p.sector ?? '—' })]),
              el('td', { class: 'table__muted', text: p.region ?? '—' }),
              el('td', { class: 'table__muted', text: p.hasRevenue ? fmt.money(p.usd) : 'none' }),
              el('td', { class: 'table__muted', text: p.costUsd ? fmt.money(p.costUsd) : '—' }),
              el('td', { class: 'table__muted', text: p.hasEffort ? fmt.hours(p.hours) : 'not measured' }),
              // No rate where either side is missing: dividing by an absent
              // denominator would invent a number rather than reveal one.
              el('td', { class: 'table__muted', text: p.rate ? `${Math.round(p.rate)}` : '—' }),
              el('td', { class: 'table__muted', text: String(p.services || '—') }),
              el('td', { class: 'table__muted', text: String(p.people || '—') }),
              el('td', {}, [el('div', { class: 'legend' }, [
                yesNo(p.hasRevenue, 'Revenue'),
                yesNo(p.hasEffort, 'Effort'),
                yesNo(p.hasScope, 'Scope'),
              ])]),
            ]))),
        ]),
      ]),
      footnote:
        '"not measured" means no timesheet exists for that client — chiefly KSA, which files none. It is not zero effort.',
    }),
  );
}
