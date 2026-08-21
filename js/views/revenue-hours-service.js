/**
 * Revenue & Hours per Service.
 *
 * The one view on this platform whose effort figures are derived rather than
 * measured, and it says so everywhere.
 *
 * Timesheets carry no service column. So a client's recorded hours are split
 * across that client's services in proportion to that client's recognized
 * revenue in the same window. That is an attribution, and it is wrong in a
 * specific, knowable way: a client whose revenue sits in one service while the
 * work happened in another will be misattributed by construction. It is still
 * the best available reading, which is why it ships — labelled.
 *
 * Hours belonging to clients with no revenue rows cannot be attributed at all.
 * They are reported as a separate figure rather than being spread across
 * services they may have nothing to do with.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar, segmented } from '../ui/page.js';
import { pairedBars, rankedBars, stackedMonths, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup } from '../data/prism.js';

let measure = 'revenue';
let filters = { region: 'all', client: 'all', from: 'all', to: 'all' };

const MEASURES = [
  { id: 'revenue', label: 'REVENUE' },
  { id: 'hours', label: 'HOURS' },
];

export function renderRevenueHoursService(root, view) {
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
  const months = allMonths.filter((m) => m >= from && m <= to);
  const inWindow = (m) => m >= from && m <= to;

  const match = (r) =>
    (filters.region === 'all' || r.region_code === filters.region) &&
    (filters.client === 'all' || r.client_code === filters.client);

  const revenue = jobBook.filter(
    (r) => r.entry_type === 'revenue' && inWindow(r.month_start) && match(r) && r.recognized_amount_usd !== null,
  );
  const effort = timeDedication.filter(
    (t) => inWindow(t.month_start) && (filters.client === 'all' || t.client_code === filters.client),
  );

  // ---- revenue per service, measured
  const revByService = new Map();
  const clientsByService = new Map();
  for (const r of revenue) {
    const k = r.service_code ?? '—';
    revByService.set(k, (revByService.get(k) ?? 0) + Number(r.recognized_amount_usd));
    if (!clientsByService.has(k)) clientsByService.set(k, new Set());
    clientsByService.get(k).add(r.client_code);
  }

  // ---- the attribution
  const revByClient = new Map();
  const revByClientService = new Map();          // client -> service -> usd
  for (const r of revenue) {
    revByClient.set(r.client_code, (revByClient.get(r.client_code) ?? 0) + Number(r.recognized_amount_usd));
    if (!revByClientService.has(r.client_code)) revByClientService.set(r.client_code, new Map());
    const m = revByClientService.get(r.client_code);
    const k = r.service_code ?? '—';
    m.set(k, (m.get(k) ?? 0) + Number(r.recognized_amount_usd));
  }

  const hrsByClient = new Map();
  for (const t of effort) {
    hrsByClient.set(t.client_code, (hrsByClient.get(t.client_code) ?? 0) + Number(t.hours));
  }

  const attributed = new Map();
  let unattributable = 0;
  for (const [client, hours] of hrsByClient) {
    const clientRevenue = revByClient.get(client);
    const mix = revByClientService.get(client);
    // No revenue for this client in the window means no basis for a split.
    // Spreading the hours anyway would attach them to services chosen at random.
    if (!clientRevenue || !mix) { unattributable += hours; continue; }
    for (const [service, usd] of mix) {
      attributed.set(service, (attributed.get(service) ?? 0) + hours * (usd / clientRevenue));
    }
  }

  const services = [...new Set([...revByService.keys(), ...attributed.keys()])]
    .map((s) => ({
      service: s,
      usd: revByService.get(s) ?? 0,
      hours: attributed.get(s) ?? 0,
      clients: clientsByService.get(s)?.size ?? 0,
    }))
    .sort((a, b) => b.usd - a.usd);

  const totalUsd = services.reduce((s, x) => s + x.usd, 0);
  const totalAttributed = services.reduce((s, x) => s + x.hours, 0);
  const recordedHours = [...hrsByClient.values()].reduce((s, h) => s + h, 0);

  root.append(
    toolbar([
      segmented(MEASURES, measure, (id) => { measure = id; renderRevenueHoursService(root, view); }),
      el('div', { class: 'legend' }, [tag('USD', 'neutral'), sourceLink(SOURCE_WORKBOOK_URL)]),
    ]),

    filterBar(
      [
        { name: 'region', label: 'Region', value: filters.region,
          options: [{ value: 'all', label: 'All regions' },
            ...regions.map((r) => ({ value: r.region_code, label: r.name }))] },
        { name: 'client', label: 'Client', value: filters.client,
          options: [{ value: 'all', label: 'All clients' },
            ...[...revByClient.keys()].map((c) => ({ value: c, label: clientName(c) }))
              .sort((a, b) => a.label.localeCompare(b.label))] },
        { name: 'from', label: 'From', value: filters.from,
          options: [{ value: 'all', label: monthLabel(allMonths[0]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
        { name: 'to', label: 'To', value: filters.to,
          options: [{ value: 'all', label: monthLabel(allMonths[allMonths.length - 1]) },
            ...allMonths.map((m) => ({ value: m, label: monthLabel(m) }))] },
      ],
      {
        note: 'Totals never include future empty months',
        onChange: (n, v) => { filters[n] = v; renderRevenueHoursService(root, view); },
      },
    ),

    kpiRow([
      { label: 'Service lines with revenue', value: String(revByService.size),
        meta: 'Distinct Service values in the job book' },
      { label: 'Recognized revenue', value: fmt.money(totalUsd), meta: 'All services in this selection' },
      { label: 'Recorded hours', value: fmt.hours(recordedHours), meta: 'Before service attribution' },
      { label: 'Hours not attributable', value: fmt.hours(unattributable),
        meta: 'Clients with hours but no revenue rows',
        tone: unattributable ? 'note' : undefined },
    ]),
  );

  if (!services.length) {
    root.append(el('p', { class: 'empty', text: 'No service revenue in this selection.' }));
    return;
  }

  // ---- monthly, by the chosen measure
  const keys = services.slice(0, 6).map((s) => s.service);
  const monthly = months.map((m) => ({
    label: monthLabel(m),
    segments: keys.map((service) => ({
      key: service,
      value: measure === 'revenue'
        ? revenue.filter((r) => r.month_start === m && (r.service_code ?? '—') === service)
            .reduce((s, r) => s + Number(r.recognized_amount_usd), 0)
        // Attribution repeated per month, using that month's own revenue mix.
        : attributeForMonth(m, service),
    })),
  }));

  function attributeForMonth(month, service) {
    let out = 0;
    const monthRevenue = revenue.filter((r) => r.month_start === month);
    const monthEffort = effort.filter((t) => t.month_start === month);
    const byClient = new Map();
    for (const r of monthRevenue) {
      if (!byClient.has(r.client_code)) byClient.set(r.client_code, new Map());
      const m = byClient.get(r.client_code);
      const k = r.service_code ?? '—';
      m.set(k, (m.get(k) ?? 0) + Number(r.recognized_amount_usd));
    }
    for (const t of monthEffort) {
      const mix = byClient.get(t.client_code);
      if (!mix) continue;
      const tot = [...mix.values()].reduce((s, v) => s + v, 0);
      if (!tot) continue;
      out += Number(t.hours) * ((mix.get(service) ?? 0) / tot);
    }
    return out;
  }

  root.append(
    panel({
      eyebrow: 'Monthly',
      title: measure === 'revenue'
        ? 'Recognized revenue by service, per month'
        : 'Attributed hours by service, per month',
      aside: el('div', { class: 'legend' },
        keys.map((k, i) => el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: `background:${seriesColor(i)}` }),
          el('span', { class: 'legend__label', text: k }),
        ]))),
      body: stackedMonths({
        months: monthly, keys,
        format: (v) => (measure === 'revenue' ? fmt.money(v) : fmt.hours(v)),
      }),
      footnote: 'Top 6 service lines by recognized revenue.',
    }),

    twoUp(
      panel({
        eyebrow: 'Commercial',
        title: 'Recognized revenue by service',
        body: rankedBars({
          items: services.map((s, i) => ({
            label: s.service, value: s.usd,
            meta: `${fmt.pct(totalUsd ? s.usd / totalUsd : 0)} · ${s.clients} clients`,
            color: seriesColor(i),
          })),
          format: (v) => fmt.money(v),
        }),
        footnote: 'Measured directly from the job book.',
      }),
      panel({
        eyebrow: 'Effort',
        title: 'Attributed hours by service',
        aside: tag('ATTRIBUTED', 'note'),
        body: rankedBars({
          items: services.map((s, i) => ({
            label: s.service, value: s.hours,
            meta: fmt.pct(totalAttributed ? s.hours / totalAttributed : 0),
            color: seriesColor(i),
          })),
          format: fmt.hours,
        }),
        footnote:
          'Derived, not measured. A client whose revenue sits in one service while the work happened in another is misattributed by construction.',
      }),
    ),

    panel({
      eyebrow: 'Share gap',
      title: 'Revenue share vs. effort share, by service',
      body: pairedBars({
        items: services.map((s) => ({
          label: s.service,
          a: totalUsd ? s.usd / totalUsd : 0,
          b: totalAttributed ? s.hours / totalAttributed : 0,
        })),
        formatA: (v) => fmt.pct(v),
        formatB: (v) => fmt.pct(v),
      }),
      footnote:
        'Teal is revenue share, purple attributed effort share. Read the gap as a prompt to check the mix, not as a margin.',
    }),
  );
}
