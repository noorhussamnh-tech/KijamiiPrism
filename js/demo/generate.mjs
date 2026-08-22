/**
 * Demo dataset generator.
 *
 * Run once, output committed:  node js/demo/generate.mjs
 *
 * Nothing here reads production. There is no import, no fetch, no file read of
 * any real record — every value below is invented in this file from a seeded
 * pseudo-random generator. That matters more than it might look: a dataset
 * *derived* from real figures by perturbation still carries the shape of the
 * original, and shape is re-identifying when the client list is public. This
 * one has no original.
 *
 * What it does preserve is analytical behaviour. The concentration curve, the
 * coverage gaps, the scope overruns, the partial trailing month and the
 * unconvertible rows are all planted deliberately, because a demo where every
 * page renders a clean, uneventful chart demonstrates nothing about a platform
 * whose entire argument is how it handles the messy cases.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// --------------------------------------------------------------------- prng

/** mulberry32 — small, fast, and deterministic, which is the only requirement. */
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260822);

const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const round = (n, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// ------------------------------------------------------------------ calendar

const MONTHS = [
  '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01',
  '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01',
];

/** The trailing month is deliberately incomplete — see the note at the top. */
const PARTIAL_MONTH = MONTHS[MONTHS.length - 1];

// A mild seasonal curve. Not dramatic: real books wobble, they do not oscillate.
const SEASON = { 0: 0.94, 1: 0.98, 2: 1.08, 3: 1.12, 4: 1.02, 5: 0.96, 6: 1.05, 7: 1.0 };

// ------------------------------------------------------------------- regions

const REGIONS = [
  { region_code: 'Calderra', name: 'Calderra' },
  { region_code: 'Solvina', name: 'Solvina' },
  { region_code: 'Marovia', name: 'Marovia' },
  { region_code: 'Non-Solvina', name: 'Non-Solvina' },
];

/** Only these two file timesheets. The asymmetry is the point of several views. */
const TIMESHEET_REGIONS = new Set(['Calderra', 'Solvina']);

// ------------------------------------------------------------------ services

const SERVICES = [
  { service_code: 'Social Media', name: 'Social Media' },
  { service_code: 'Content Production', name: 'Content Production' },
  { service_code: 'Media Buying', name: 'Media Buying' },
  { service_code: 'Creative Strategy', name: 'Creative Strategy' },
  { service_code: 'Influencer', name: 'Influencer' },
  { service_code: 'Web & Platforms', name: 'Web & Platforms' },
  { service_code: 'Data & Insights', name: 'Data & Insights' },
  { service_code: 'Brand Consulting', name: 'Brand Consulting' },
];

const SUB_SERVICE = {
  'Social Media': ['Always-on', 'Community', 'Channel Management'],
  'Content Production': ['Photography', 'Video', 'Post-production'],
  'Media Buying': ['Paid Social', 'Programmatic', 'Search'],
  'Creative Strategy': ['Campaign', 'Positioning', 'Concepting'],
  Influencer: ['Seeding', 'Talent', 'Activation'],
  'Web & Platforms': ['Build', 'Maintenance', 'Landing Pages'],
  'Data & Insights': ['Reporting', 'Social Listening', 'Measurement'],
  'Brand Consulting': ['Identity', 'Architecture', 'Workshops'],
};

// ------------------------------------------------------------------- clients

/**
 * base — indicative monthly recognized revenue in USD, before season and noise.
 * kind — retainer books steadily; project books lumpy, with empty months.
 *
 * The bases are chosen so the top five land just above a 60% share, which is
 * where Revenue Concentration starts flagging dependency. A demo that sits
 * safely under every threshold never shows what the thresholds do.
 */
const CLIENTS = [
  { code: 'CL-01', name: 'Meridian Beverages', sector: 'Beverages',          region: 'Marovia',     base: 118000, kind: 'retainer' },
  { code: 'CL-02', name: 'Lumen Telecom',      sector: 'Telecom',            region: 'Marovia',     base: 92000,  kind: 'retainer' },
  { code: 'CL-03', name: 'Northwind Bank',     sector: 'Financial Services', region: 'Marovia',     base: 71000,  kind: 'retainer' },
  { code: 'CL-04', name: 'Halcyon Retail',     sector: 'Retail',             region: 'Calderra',    base: 54000,  kind: 'retainer' },
  { code: 'CL-05', name: 'Cobalt Airlines',    sector: 'Travel',             region: 'Marovia',     base: 46000,  kind: 'project'  },
  { code: 'CL-06', name: 'Verity Pharma',      sector: 'Healthcare',         region: 'Solvina',     base: 33000,  kind: 'retainer' },
  { code: 'CL-07', name: 'Aster Motors',       sector: 'Automotive',         region: 'Solvina',     base: 29000,  kind: 'retainer' },
  { code: 'CL-08', name: 'Juniper Foods',      sector: 'FMCG',               region: 'Calderra',    base: 26000,  kind: 'retainer' },
  { code: 'CL-09', name: 'Onyx Electronics',   sector: 'Electronics',        region: 'Marovia',     base: 24000,  kind: 'project'  },
  { code: 'CL-10', name: 'Solace Hotels',      sector: 'Hospitality',        region: 'Solvina',     base: 21000,  kind: 'retainer' },
  { code: 'CL-11', name: 'Vantage Insurance',  sector: 'Financial Services', region: 'Marovia',     base: 18500,  kind: 'retainer' },
  { code: 'CL-12', name: 'Orchid Cosmetics',   sector: 'Beauty',             region: 'Calderra',    base: 16000,  kind: 'retainer' },
  { code: 'CL-13', name: 'Pinnacle Realty',    sector: 'Real Estate',        region: 'Calderra',    base: 14000,  kind: 'project'  },
  { code: 'CL-14', name: 'Kestrel Logistics',  sector: 'Logistics',          region: 'Solvina',     base: 12500,  kind: 'retainer' },
  { code: 'CL-15', name: 'Marlowe Fashion',    sector: 'Fashion',            region: 'Calderra',    base: 10500,  kind: 'project'  },
  { code: 'CL-16', name: 'Ember Energy',       sector: 'Energy',             region: 'Non-Solvina', base: 9000,   kind: 'project'  },
  { code: 'CL-17', name: 'Thistle Dairy',      sector: 'FMCG',               region: 'Calderra',    base: 7500,   kind: 'retainer' },
  { code: 'CL-18', name: 'Zephyr Fitness',     sector: 'Wellness',           region: 'Solvina',     base: 6000,   kind: 'retainer' },
  { code: 'CL-19', name: 'Wren Education',     sector: 'Education',          region: 'Calderra',    base: 4800,   kind: 'project'  },
  { code: 'CL-20', name: 'Calla Confectionery',sector: 'FMCG',               region: 'Calderra',    base: 3600,   kind: 'retainer' },
  { code: 'CL-21', name: 'Sable Home',         sector: 'Home & Living',      region: 'Calderra',    base: 2400,   kind: 'project'  },
  { code: 'CL-22', name: 'Willow Toys',        sector: 'Toys',               region: 'Solvina',     base: 1500,   kind: 'project'  },

  // Effort but no revenue — the pro-bono and pitch work every agency carries and
  // no job book records. Evidence Exceptions exists to make these visible.
  { code: 'CL-23', name: 'Bramble Media',      sector: 'Media',              region: 'Calderra',    base: 0,      kind: 'none' },
  { code: 'CL-24', name: 'Quill Publishing',   sector: 'Publishing',         region: 'Solvina',     base: 0,      kind: 'none' },
];

/** Which services each client actually buys. Drives the mix, and its shifts. */
const CLIENT_SERVICES = {
  'CL-01': ['Social Media', 'Media Buying', 'Content Production', 'Influencer'],
  'CL-02': ['Media Buying', 'Data & Insights', 'Social Media'],
  'CL-03': ['Brand Consulting', 'Creative Strategy', 'Media Buying'],
  'CL-04': ['Social Media', 'Content Production', 'Media Buying'],
  'CL-05': ['Creative Strategy', 'Content Production', 'Media Buying'],
  'CL-06': ['Data & Insights', 'Content Production', 'Social Media'],
  'CL-07': ['Creative Strategy', 'Web & Platforms', 'Social Media'],
  'CL-08': ['Social Media', 'Influencer', 'Content Production'],
  'CL-09': ['Media Buying', 'Web & Platforms'],
  'CL-10': ['Social Media', 'Content Production'],
  'CL-11': ['Data & Insights', 'Media Buying'],
  'CL-12': ['Influencer', 'Social Media', 'Content Production'],
  'CL-13': ['Web & Platforms', 'Creative Strategy'],
  'CL-14': ['Data & Insights', 'Social Media'],
  'CL-15': ['Influencer', 'Content Production'],
  'CL-16': ['Brand Consulting', 'Data & Insights'],
  'CL-17': ['Social Media', 'Content Production'],
  'CL-18': ['Social Media'],
  'CL-19': ['Web & Platforms', 'Content Production'],
  'CL-20': ['Social Media', 'Influencer'],
  'CL-21': ['Content Production'],
  'CL-22': ['Social Media', 'Content Production'],
};

const CURRENCY = { Calderra: 'CDR', Solvina: 'SVN', Marovia: 'MRV', 'Non-Solvina': 'USD' };
const FX = { CDR: 0.0206, SVN: 0.2723, MRV: 0.2666, USD: 1 };

// ----------------------------------------------------------------- employees

const TEAMS = ['Creative', 'Strategy', 'Media', 'Accounts', 'Production', 'Data'];

const TITLES = {
  Creative: ['Art Director', 'Senior Designer', 'Copywriter', 'Motion Designer', 'Creative Director'],
  Strategy: ['Strategist', 'Senior Strategist', 'Planning Director'],
  Media: ['Media Planner', 'Media Buyer', 'Performance Lead'],
  Accounts: ['Account Executive', 'Account Manager', 'Account Director'],
  Production: ['Producer', 'Production Manager', 'Editor'],
  Data: ['Data Analyst', 'Insights Manager'],
};

const PEOPLE = [
  ['Nadia K.', 'Creative',   'Calderra'], ['Omar T.', 'Media',      'Calderra'],
  ['Layla S.', 'Accounts',   'Calderra'], ['Karim F.', 'Creative',  'Calderra'],
  ['Dana M.', 'Strategy',    'Solvina'],  ['Youssef A.', 'Production', 'Calderra'],
  ['Rana H.', 'Accounts',    'Solvina'],  ['Tarek B.', 'Media',      'Calderra'],
  ['Salma D.', 'Creative',   'Calderra'], ['Hadi N.', 'Data',        'Solvina'],
  ['Mira Z.', 'Accounts',    'Calderra'], ['Basel Q.', 'Creative',   'Solvina'],
  ['Nour E.', 'Production',  'Calderra'], ['Adam W.', 'Strategy',    'Calderra'],
  ['Farah L.', 'Accounts',   'Calderra'], ['Ziad R.', 'Media',       'Solvina'],
  ['Hana P.', 'Creative',    'Calderra'], ['Sami G.', 'Production',  'Solvina'],
  ['Lina V.', 'Data',        'Calderra'], ['Ramy O.', 'Accounts',    'Calderra'],
  ['Dalia C.', 'Creative',   'Solvina'],  ['Marwan I.', 'Media',     'Calderra'],
  ['Yara U.', 'Strategy',    'Calderra'], ['Fadi J.', 'Production',  'Calderra'],
  ['Reem X.', 'Accounts',    'Solvina'],  ['Hisham Y.', 'Creative',  'Calderra'],
  ['Aya T.', 'Data',         'Solvina'],  ['Nabil K.', 'Media',      'Calderra'],
  ['Sarah M.', 'Accounts',   'Calderra'], ['Amir S.', 'Creative',    'Calderra'],
  ['Maya F.', 'Production',  'Solvina'],  ['Rashid B.', 'Strategy',  'Solvina'],
  ['Tala H.', 'Creative',    'Calderra'], ['Jamil D.', 'Accounts',   'Calderra'],
];

const employees = PEOPLE.map(([name, team, region], i) => ({
  employee_code: `EMP-${String(i + 1).padStart(2, '0')}`,
  name,
  team,
  region,
  title: pick(TITLES[team]),
  is_placeholder: false,
}));

// Placeholder rows exist in any real mapping: a freelance pool that books hours
// without being a person. Kept so the flag has something to describe.
employees.push(
  { employee_code: 'EMP-35', name: 'Freelance Pool', team: 'Production', region: 'Calderra', title: 'Freelance Resource', is_placeholder: true },
  { employee_code: 'EMP-36', name: 'Contract Resource', team: 'Creative', region: 'Solvina', title: 'Contract Resource', is_placeholder: true },
);

// --------------------------------------------------- employee → client books

const effortClients = CLIENTS.filter((c) => TIMESHEET_REGIONS.has(c.region));

/** Bigger clients pull more people onto them. */
function clientsForEmployee(emp) {
  const pool = effortClients.filter((c) => c.region === emp.region);
  const weighted = pool.flatMap((c) => Array(Math.max(1, Math.round((c.base || 3000) / 6000))).fill(c));
  const n = 2 + Math.floor(rand() * 3);
  const chosen = new Set();
  let guard = 0;
  while (chosen.size < Math.min(n, pool.length) && guard++ < 60) chosen.add(pick(weighted).code);
  return [...chosen];
}

const book = new Map(employees.map((e) => [e.employee_code, clientsForEmployee(e)]));

/**
 * Six people carry a sustained overload — three or more consecutive months
 * above the 140h reference. Workload Pressure's whole argument is the
 * difference between one heavy month and a run of them, so the dataset has to
 * contain both.
 */
const HOT = new Map([
  ['EMP-04', [1, 2, 3, 4]],
  ['EMP-09', [2, 3, 4]],
  ['EMP-13', [0, 1, 2, 3, 4, 5]],
  ['EMP-17', [3, 4, 5]],
  ['EMP-24', [1, 2, 3]],
  ['EMP-31', [4, 5, 6]],
]);

/** Scattered single heavy months — deadlines, not staffing problems. */
const SPIKES = new Set(['EMP-02|2', 'EMP-07|5', 'EMP-11|1', 'EMP-19|6', 'EMP-22|3', 'EMP-28|0', 'EMP-33|4']);

/** Employee-months with no submission at all. Gaps, never zeros. */
const GAPS = new Set([
  'EMP-03|1', 'EMP-03|5', 'EMP-06|2', 'EMP-10|0', 'EMP-10|1', 'EMP-14|4',
  'EMP-18|3', 'EMP-21|6', 'EMP-25|2', 'EMP-25|3', 'EMP-27|5', 'EMP-30|1',
  'EMP-32|4', 'EMP-34|0', 'EMP-34|6', 'EMP-35|2', 'EMP-35|3', 'EMP-36|1',
  'EMP-05|6', 'EMP-12|5', 'EMP-16|0', 'EMP-20|4', 'EMP-23|6', 'EMP-29|2',
]);

// A handful of people joined or left mid-window, so their gaps are contiguous
// at one end rather than scattered — a different shape on the coverage grid.
const STARTS = { 'EMP-33': 2, 'EMP-34': 3 };
const ENDS = { 'EMP-26': 5 };

// ------------------------------------------------------- time dedication

const timeDedication = [];
let timeRow = 1000;

for (const emp of employees) {
  const clientCodes = book.get(emp.employee_code);
  if (!clientCodes.length) continue;

  for (let mi = 0; mi < MONTHS.length; mi += 1) {
    const key = `${emp.employee_code}|${mi}`;
    if (GAPS.has(key)) continue;
    if (STARTS[emp.employee_code] !== undefined && mi < STARTS[emp.employee_code]) continue;
    if (ENDS[emp.employee_code] !== undefined && mi > ENDS[emp.employee_code]) continue;

    // The trailing month is only partly filed in — the same reason the job book
    // is thin there. Timesheets arrive late.
    if (MONTHS[mi] === PARTIAL_MONTH && !chance(0.45)) continue;

    let total;
    if (HOT.get(emp.employee_code)?.includes(mi)) total = between(146, 192);
    else if (SPIKES.has(key)) total = between(142, 168);
    else if (emp.is_placeholder) total = between(24, 76);
    else total = between(96, 138);

    if (MONTHS[mi] === PARTIAL_MONTH) total *= between(0.4, 0.75);

    // Split the month across that person's clients, unevenly — nobody divides
    // their time in equal quarters.
    const weights = clientCodes.map(() => between(0.5, 1));
    const sum = weights.reduce((s, w) => s + w, 0);

    clientCodes.forEach((code, i) => {
      const hours = round((total * weights[i]) / sum, 1);
      if (hours < 1) return;
      timeDedication.push({
        source_row: (timeRow += 1),
        month_start: MONTHS[mi],
        employee_code: emp.employee_code,
        client_code: code,
        hours,
        team: emp.team,
        title: emp.title,
        engagement_type: CLIENTS.find((c) => c.code === code).kind === 'retainer' ? 'Retainer' : 'Project',
        is_deleted: false,
      });
    });
  }
}

// Two clients absorb effort that no revenue row accounts for. Assigned to a few
// people on top of their existing book, which is how pitch work actually lands.
for (const [code, crew] of [['CL-23', ['EMP-01', 'EMP-08', 'EMP-14']], ['CL-24', ['EMP-05', 'EMP-25']]]) {
  for (const empCode of crew) {
    const emp = employees.find((e) => e.employee_code === empCode);
    for (let mi = 0; mi < MONTHS.length; mi += 1) {
      if (!chance(0.55)) continue;
      if (GAPS.has(`${empCode}|${mi}`)) continue;
      timeDedication.push({
        source_row: (timeRow += 1),
        month_start: MONTHS[mi],
        employee_code: empCode,
        client_code: code,
        hours: round(between(4, 22), 1),
        team: emp.team,
        title: emp.title,
        engagement_type: 'Project',
        is_deleted: false,
      });
    }
  }
}

// ------------------------------------------------------------------ job book

const jobBook = [];
let jobRow = 5000;

/** A few very large single rows so the 100K+ band is populated. */
const CAMPAIGNS = new Set(['CL-01|2', 'CL-02|3', 'CL-03|4', 'CL-05|1']);

for (const client of CLIENTS) {
  if (client.kind === 'none') continue;
  const services = CLIENT_SERVICES[client.code];
  const ccy = CURRENCY[client.region];

  for (let mi = 0; mi < MONTHS.length; mi += 1) {
    const month = MONTHS[mi];

    // Project clients bill in bursts; retainers bill every month.
    if (client.kind === 'project' && chance(0.35)) continue;
    if (month === PARTIAL_MONTH && !chance(0.3)) continue;

    const monthUsd = client.base * SEASON[mi] * between(0.86, 1.16);
    if (monthUsd < 200) continue;

    // One or more service rows per month. Big books split across more lines.
    const lines = Math.min(services.length, 1 + Math.floor(rand() * (client.base > 20000 ? 3 : 2)));
    const chosen = [...services].sort(() => rand() - 0.5).slice(0, lines);
    const weights = chosen.map(() => between(0.4, 1));
    const wsum = weights.reduce((s, w) => s + w, 0);

    chosen.forEach((service, i) => {
      let usd = (monthUsd * weights[i]) / wsum;
      if (i === 0 && CAMPAIGNS.has(`${client.code}|${mi}`)) usd = between(112000, 168000);
      if (usd < 60) return;

      const rate = FX[ccy];
      const amount = round(usd / rate, 2);

      // A small number of rows have no rate on file for their currency. They
      // keep their recorded amount and carry no USD figure at all, rather than
      // being counted as zero.
      const unconvertible = chance(0.028) && ccy !== 'USD';

      jobBook.push({
        source_row: (jobRow += 1),
        client_code: client.code,
        region_code: client.region,
        entry_type: 'revenue',
        month_start: month,
        service_code: service,
        sub_service: pick(SUB_SERVICE[service]),
        currency: ccy,
        recognized_amount: amount,
        recognized_amount_usd: unconvertible ? null : round(usd, 2),
        fx_rate_used: unconvertible ? null : rate,
        is_deleted: false,
      });
    });

    // Media buying is largely pass-through, so it books a matching cost line.
    if (chosen.includes('Media Buying') && chance(0.7)) {
      const costUsd = monthUsd * between(0.3, 0.52);
      jobBook.push({
        source_row: (jobRow += 1),
        client_code: client.code,
        region_code: client.region,
        entry_type: 'cost',
        month_start: month,
        service_code: 'Media Buying',
        sub_service: 'Pass-through',
        currency: ccy,
        recognized_amount: round(costUsd / FX[ccy], 2),
        recognized_amount_usd: round(costUsd, 2),
        fx_rate_used: FX[ccy],
        is_deleted: false,
      });
    }
  }
}

// Two very small rows so the "Under 1K" band is not empty. Small retouching
// jobs invoiced separately — unremarkable, and they widen the distribution.
for (const [code, month, service] of [['CL-21', MONTHS[2], 'Content Production'], ['CL-22', MONTHS[4], 'Social Media']]) {
  const client = CLIENTS.find((c) => c.code === code);
  const usd = between(320, 880);
  jobBook.push({
    source_row: (jobRow += 1),
    client_code: code,
    region_code: client.region,
    entry_type: 'revenue',
    month_start: month,
    service_code: service,
    sub_service: pick(SUB_SERVICE[service]),
    currency: CURRENCY[client.region],
    recognized_amount: round(usd / FX[CURRENCY[client.region]], 2),
    recognized_amount_usd: round(usd, 2),
    fx_rate_used: FX[CURRENCY[client.region]],
    is_deleted: false,
  });
}

// ---------------------------------------------------------------- scope lines

/**
 * Scope is derived from observed effort with a deliberate offset per client, so
 * Actual vs. Assumed has something to say. An offset above 1 means the client
 * absorbs more than its documented scope; below 1, less. Both are on the page,
 * because a demo showing only overruns implies the platform only detects one
 * direction.
 */
const SCOPE_OFFSET = {
  'CL-04': 0.84,   // running well over scope
  'CL-06': 1.28,   // running under scope — possibly a stale document
  'CL-08': 0.96,   // roughly on scope
  'CL-07': 1.09,
  'CL-12': 0.74,   // the clearest overrun
  'CL-18': 0,      // in the scope document with no dedication recorded at all
};

const SCOPE_FUNCTIONS = ['Creative', 'Account Management', 'Media', 'Strategy', 'Production', 'Analytics'];

const scopeLines = [];

for (const [code, offset] of Object.entries(SCOPE_OFFSET)) {
  const rows = timeDedication.filter((t) => t.client_code === code);
  const months = new Set(rows.map((r) => r.month_start)).size || 1;
  const actualMonthly = rows.reduce((s, r) => s + r.hours, 0) / months;
  const targetMonthly = actualMonthly * offset;

  const crew = [...new Set(rows.map((r) => r.employee_code))].slice(0, 5);
  const seats = crew.length || 3;

  // Split the documented dedication across named seats, plus one unassigned
  // seat on two of the clients — a role in the scope with nobody against it.
  const weights = Array.from({ length: seats }, () => between(0.5, 1));
  const wsum = weights.reduce((s, w) => s + w, 0);

  crew.forEach((empCode, i) => {
    const emp = employees.find((e) => e.employee_code === empCode);
    const hours = offset === 0 ? 0 : round((targetMonthly * weights[i]) / wsum, 1);
    scopeLines.push({
      client_code: code,
      employee_code: empCode,
      function: pick(SCOPE_FUNCTIONS),
      title: emp?.title ?? 'Team Member',
      assignee_name: emp?.name ?? '—',
      assumed_pct: round(hours / 140, 3),
      assumed_hours: hours,
      is_deleted: false,
    });
  });

  if (code === 'CL-04' || code === 'CL-12') {
    scopeLines.push({
      client_code: code,
      employee_code: null,
      function: pick(SCOPE_FUNCTIONS),
      title: 'Unassigned',
      assignee_name: null,
      assumed_pct: 0.15,
      assumed_hours: 21,
      is_deleted: false,
    });
  }
}

// ----------------------------------------------------------------- contracts

const contracts = CLIENTS.filter((c) => c.kind !== 'none').map((c, i) => {
  const unknown = ['CL-05', 'CL-13', 'CL-16'].includes(c.code);
  return {
    client_code: c.code,
    end_date: unknown ? null : `2026-${String(9 + (i % 4)).padStart(2, '0')}-30`,
    end_date_unknown: unknown,
  };
});

// --------------------------------------------------------------- sync record

const RUN_ID = 418;

const unconvertibleRows = jobBook.filter(
  (r) => r.recognized_amount !== null && r.recognized_amount_usd === null,
);

const syncIssues = [];

for (const row of unconvertibleRows) {
  syncIssues.push({
    run_id: RUN_ID,
    tab: 'Job Book',
    source_row: row.source_row,
    severity: 'warning',
    code: 'fx_rate_missing',
    column_name: 'fx_rate',
    raw_value: row.currency,
    message: `No exchange rate on file for ${row.currency} on ${row.month_start}.`,
  });
}

const SYNTHETIC_ISSUES = [
  ['Job Book', 'date_unparseable', 'recognized_date', 'n/a'],
  ['Job Book', 'date_unparseable', 'recognized_date', 'tbc'],
  ['Job Book', 'date_invalid', 'recognized_date', '2062-04-31'],
  ['Job Book', 'date_invalid', 'recognized_date', '2026-13-02'],
  ['Time Dedication', 'hours_unparseable', 'hours', 'half day'],
  ['Time Dedication', 'hours_unparseable', 'hours', '~40'],
  ['Time Dedication', 'hours_unparseable', 'hours', 'see note'],
  ['Time Dedication', 'month_unparseable', 'month', 'Q2'],
  ['Time Dedication', 'month_unparseable', 'month', 'summer'],
  ['Contracts', 'contract_end_unknown', 'end_date', '?'],
  ['Contracts', 'contract_end_unknown', 'end_date', '?'],
  ['Contracts', 'contract_end_unknown', 'end_date', 'rolling'],
];

const ISSUE_MESSAGE = {
  date_unparseable: 'Value in a date column is not a date; the field was left empty.',
  date_invalid: 'Date out of range; the field was left empty.',
  hours_unparseable: 'Hours value is not numeric; the cell was skipped.',
  month_unparseable: 'Month not recognised; the row is absent from every monthly total.',
  contract_end_unknown: 'Contract end recorded as unknown; kept as unknown, not as null.',
};

SYNTHETIC_ISSUES.forEach(([tab, code, column, raw], i) => {
  syncIssues.push({
    run_id: RUN_ID,
    tab,
    source_row: 7000 + i,
    severity: code === 'contract_end_unknown' ? 'info' : 'warning',
    code,
    column_name: column,
    raw_value: raw,
    message: ISSUE_MESSAGE[code],
  });
});

const syncStatus = {
  last_run_id: RUN_ID,
  status: 'succeeded',
  last_run_started: '2026-08-21T02:00:00.000Z',
  last_run_finished: '2026-08-21T02:00:37.000Z',
  issue_count: syncIssues.length,
  rows_loaded: timeDedication.length + jobBook.length + scopeLines.length,
};

// ------------------------------------------------------------------ accounts

/**
 * Access Control reads these instead of `profiles`. No addresses: the page has
 * no email column in this build, and the field is not carried here either, so
 * there is nothing to leak even if a column came back.
 */
const accounts = [
  { id: 'demo-1', full_name: 'A. Demo Viewer',   role: 'member', is_approved: true,  created_at: '2026-02-11T09:14:00.000Z' },
  { id: 'demo-2', full_name: 'B. Reviewer',      role: 'admin',  is_approved: true,  created_at: '2026-01-04T08:02:00.000Z' },
  { id: 'demo-3', full_name: 'C. Analyst',       role: 'member', is_approved: true,  created_at: '2026-03-22T13:40:00.000Z' },
  { id: 'demo-4', full_name: 'D. Account Lead',  role: 'member', is_approved: true,  created_at: '2026-04-08T11:05:00.000Z' },
  { id: 'demo-5', full_name: 'E. New Starter',   role: 'member', is_approved: false, created_at: '2026-08-18T16:27:00.000Z' },
];

// -------------------------------------------------------------------- output

const clients = CLIENTS.map((c) => ({ client_code: c.code, name: c.name, sector: c.sector }));
const employeeRows = employees.map((e) => ({
  employee_code: e.employee_code,
  name: e.name,
  is_placeholder: e.is_placeholder,
}));

const lines = (rows) => rows.map((r) => `  ${JSON.stringify(r)},`).join('\n');

const out = `/**
 * The demo dataset — GENERATED, DO NOT EDIT BY HAND.
 *
 * Produced by js/demo/generate.mjs. Every value in this file is invented: no
 * client, employee, amount or date here corresponds to anything real, and the
 * file was not derived from any production record. Regenerate with:
 *
 *     node js/demo/generate.mjs
 *
 * Rows: ${clients.length} clients · ${employeeRows.length} employees · ${timeDedication.length} timesheet rows
 *       · ${jobBook.length} job book rows · ${scopeLines.length} scope lines · ${syncIssues.length} quarantined values
 */

export const REGIONS = [
${lines(REGIONS)}
];

export const SERVICES = [
${lines(SERVICES)}
];

export const CLIENTS = [
${lines(clients)}
];

export const EMPLOYEES = [
${lines(employeeRows)}
];

export const CONTRACTS = [
${lines(contracts)}
];

export const SCOPE_LINES = [
${lines(scopeLines)}
];

export const SYNC_STATUS = ${JSON.stringify(syncStatus, null, 2)};

export const SYNC_ISSUES = [
${lines(syncIssues)}
];

export const ACCOUNTS = [
${lines(accounts)}
];

export const TIME_DEDICATION = [
${lines(timeDedication)}
];

export const JOB_BOOK = [
${lines(jobBook)}
];
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(join(here, 'dataset.js'), out);

// A short report, so a regeneration that quietly changes the shape of the demo
// is visible at the terminal rather than three pages into the app.
const revenue = jobBook.filter((r) => r.entry_type === 'revenue' && r.recognized_amount_usd !== null);
const totalUsd = revenue.reduce((s, r) => s + r.recognized_amount_usd, 0);
const byClient = new Map();
for (const r of revenue) byClient.set(r.client_code, (byClient.get(r.client_code) ?? 0) + r.recognized_amount_usd);
const ranked = [...byClient.values()].sort((a, b) => b - a);
const top5 = ranked.slice(0, 5).reduce((s, v) => s + v, 0);

const grid = new Set(timeDedication.map((t) => `${t.employee_code}|${t.month_start}`));
const people = new Set(timeDedication.map((t) => t.employee_code));

console.log(`clients            ${clients.length}`);
console.log(`employees          ${employeeRows.length}`);
console.log(`timesheet rows     ${timeDedication.length}`);
console.log(`job book rows      ${jobBook.length}  (${unconvertibleRows.length} without USD)`);
console.log(`scope lines        ${scopeLines.length}`);
console.log(`quarantined        ${syncIssues.length}`);
console.log(`revenue (USD)      ${Math.round(totalUsd).toLocaleString('en-US')}`);
console.log(`top 5 share        ${(100 * top5 / totalUsd).toFixed(1)}%`);
console.log(`largest client     ${(100 * ranked[0] / totalUsd).toFixed(1)}%`);
console.log(`coverage           ${(100 * grid.size / (people.size * MONTHS.length)).toFixed(1)}%`);
console.log(`total hours        ${Math.round(timeDedication.reduce((s, t) => s + t.hours, 0)).toLocaleString('en-US')}`);
