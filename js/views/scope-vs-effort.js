/**
 * Scope vs. Effort.
 *
 * Covers only the clients with a documented breakdown in the Scopes tab —
 * currently MYF, KFH and Valmore. Every other active client is listed as
 * unscoped rather than shown at zero scope, because "we never wrote the scope
 * down" and "we agreed to do nothing" are different statements and only one of
 * them is true.
 *
 * Assumed hours are monthly, on a 140-hour basis: assumed_pct x 140.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, kpiRow, twoUp, tag, sourceLink, toolbar, filterBar } from '../ui/page.js';
import { pairedBars, rankedBars, fmt, seriesColor } from '../ui/charts.js';
import { getState } from '../state.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';
import { monthLabel, monthsIn, nameLookup, REFERENCE_HOURS } from '../data/prism.js';

let filters = { from: 'all', to: 'all' };

export function renderScopeVsEffort(root, view) {
  const { prism } = getState();
  clear(root);
  root.append(pageHeader(view));

  if (!prism) {
    root.append(el('p', { class: 'empty', text: 'Loading the record…' }));
    return;
  }

  const { scopeLines, timeDedication, jobBook, clients, employees } = prism;
  const clientName = nameLookup(clients, 'client_code');
  const employeeName = nameLookup(employees, 'employee_code');

  const allMonths = monthsIn(timeDedication);
  const from = filters.from === 'all' ? allMonths[0] : filters.from;
  const to = filters.to === 'all' ? allMonths[allMonths.length - 1] : filters.to;
  const months = allMonths.filter((m) => m >= from && m <= to);
  const effort = timeDedication.filter((t) => t.month_start >= from && t.month_start <= to);

  // Assumed hours are per month, so the window's expectation scales with it.
  const assumedByClient = new Map();
  for (const s of scopeLines) {
    assumedByClient.set(
      s.client_code,
      (assumedByClient.get(s.client_code) ?? 0) + Number(s.assumed_hours ?? 0),
    );
  }

  // A scope row recording zero dedication documents no expectation, so it
  // cannot be compared against. Yango Play is the case in point: it appears in
  // the Scopes tab with 0. Counting it as scoped here while Actual vs. Assumed
  // excludes it would put two different numbers on the same idea.
  const scopedCodes = [...assumedByClient.keys()].filter((c) => assumedByClient.get(c) > 0);
  const zeroScoped = [...assumedByClient.keys()].filter((c) => !(assumedByClient.get(c) > 0));

  const actualByClient = new Map();
  for (const t of effort) {
    actualByClient.set(t.client_code, (actualByClient.get(t.client_code) ?? 0) + Number(t.hours));
  }

  const compared = scopedCodes
    .map((code) => {
      const assumedMonthly = assumedByClient.get(code) ?? 0;
      const assumed = assumedMonthly * months.length;
      const actual = actualByClient.get(code) ?? 0;
      return {
        code, name: clientName(code), assumedMonthly, assumed, actual,
        ratio: assumed ? actual / assumed : null,
        roles: scopeLines.filter((s) => s.client_code === code).length,
        unfilled: scopeLines.filter((s) => s.client_code === code && !s.employee_code).length,
      };
    })
    .filter((c) => c.assumed > 0 || c.actual > 0)
    .sort((a, b) => b.assumed - a.assumed);

  const activeCodes = new Set([
    ...jobBook.filter((r) => r.entry_type === 'revenue').map((r) => r.client_code),
    ...effort.map((t) => t.client_code),
  ]);
  const unscoped = [...activeCodes].filter((c) => c && !scopedCodes.includes(c));
  const zeroActive = zeroScoped.filter((c) => activeCodes.has(c));

  const totalAssumed = compared.reduce((s, c) => s + c.assumed, 0);
  const totalActual = compared.reduce((s, c) => s + c.actual, 0);

  root.append(
    toolbar([
      el('div', { class: 'legend' }, [
        tag(`${compared.length} SCOPED`, 'accent'),
        tag(`${unscoped.length} UNSCOPED`, 'note'),
      ]),
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
        note: `Assumed hours are monthly (pct x ${REFERENCE_HOURS}h), scaled across ${months.length} month${months.length === 1 ? '' : 's'}`,
        onChange: (n, v) => { filters[n] = v; renderScopeVsEffort(root, view); },
      },
    ),

    kpiRow([
      { label: 'Clients with documented scope', value: String(compared.length),
        meta: `Of ${activeCodes.size} active clients` },
      { label: 'Assumed hours', value: fmt.hours(totalAssumed),
        meta: `Across ${months.length} month${months.length === 1 ? '' : 's'}` },
      { label: 'Recorded hours', value: fmt.hours(totalActual), meta: 'Against the same clients' },
      { label: 'Unscoped clients', value: String(unscoped.length),
        meta: 'Active, no scope on file', tone: unscoped.length ? 'note' : undefined },
    ]),
  );

  if (!compared.length) {
    root.append(el('p', { class: 'empty', text: 'No client has a documented scope in this window.' }));
    return;
  }

  root.append(
    panel({
      eyebrow: 'Comparison',
      title: 'Documented scope against effort actually recorded',
      aside: el('div', { class: 'legend' }, [
        el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: 'background:var(--pair-a)' }),
          el('span', { class: 'legend__label', text: 'Assumed' })]),
        el('span', { class: 'legend__item' }, [
          el('span', { class: 'legend__swatch', style: 'background:var(--pair-b)' }),
          el('span', { class: 'legend__label', text: 'Recorded' })]),
      ]),
      body: pairedBars({
        items: compared.map((c) => ({ label: c.name, a: c.assumed, b: c.actual })),
        formatA: fmt.hours, formatB: fmt.hours,
      }),
      footnote:
        'Recorded below assumed is not automatically underservice — it can equally mean the scope is stale.',
    }),

    twoUp(
      panel({
        eyebrow: 'Utilisation',
        title: 'Recorded as a share of assumed',
        body: rankedBars({
          items: compared.map((c) => ({
            label: c.name, value: c.ratio ?? 0,
            meta: `${fmt.hours(c.actual)} of ${fmt.hours(c.assumed)}`,
            color: (c.ratio ?? 0) > 1 ? 'var(--s5)' : seriesColor(0),
          })),
          format: (v) => fmt.pct(v),
        }),
        footnote: 'Pink marks a client absorbing more than its documented scope.',
      }),
      panel({
        eyebrow: 'Scope detail',
        title: 'Documented roles per client',
        body: el('div', { class: 'table-wrap' }, [
          el('table', { class: 'table' }, [
            el('thead', {}, [el('tr', {}, [
              el('th', { text: 'Client' }), el('th', { text: 'Roles' }),
              el('th', { text: 'Unassigned' }), el('th', { text: 'Assumed / month' })])]),
            el('tbody', {}, compared.map((c) =>
              el('tr', {}, [
                el('td', {}, [el('p', { class: 'table__title', text: c.name })]),
                el('td', { class: 'table__muted', text: String(c.roles) }),
                el('td', { class: 'table__muted', text: c.unfilled ? String(c.unfilled) : '—' }),
                el('td', { class: 'table__muted', text: fmt.hours(c.assumedMonthly) }),
              ]))),
          ]),
        ]),
        footnote: 'Unassigned roles are seats in the scope with nobody named against them.',
      }),
    ),

    panel({
      eyebrow: 'Not covered',
      title: 'Active clients with no scope on file',
      body: unscoped.length
        ? el('ul', { class: 'rank' },
            unscoped.sort((a, b) => clientName(a).localeCompare(clientName(b))).map((c) =>
              el('li', { class: 'list__row' }, [
                el('div', { class: 'list__main' }, [
                  el('p', { class: 'list__title', text: clientName(c) }),
                  el('p', { class: 'list__meta',
                    text: actualByClient.has(c) ? `${fmt.hours(actualByClient.get(c))} recorded` : 'revenue only' })]),
              ])))
        : el('p', { class: 'empty', text: 'Every active client has a scope on file.' }),
      footnote:
        'The Scopes tab notes that Castrol, Baskin Robbins and ShoeMart have no resource breakdown yet. These are unscoped, not zero-scope, and are excluded from every figure above.'
        + (zeroActive.length
          ? ` ${zeroActive.map(clientName).join(', ')} ${zeroActive.length === 1 ? 'appears' : 'appear'} in the Scopes tab with zero dedication recorded, which documents no expectation to compare against — also excluded.`
          : ''),
    }),
  );
}
