/**
 * The generic analytical page.
 *
 * Fourteen of the eighteen views share one shape — question, headline, method
 * note, filters, headline figures, evidence — differing only in which filters
 * they expose and which figures they lead with. Writing fourteen near-identical
 * modules would make a change to the grammar a fourteen-file edit, so the
 * shape lives here once and each view contributes only what is genuinely its
 * own.
 *
 * The figures render with their labels and an em dash for the value until the
 * source workbook is loaded. That is intentional: the page shows exactly what
 * it will say, without inventing what it will say it about.
 */
import { el, clear } from '../ui/dom.js';
import {
  pageHeader,
  toolbar,
  filterBar,
  kpiRow,
  segmented,
  sourceLink,
  awaitingData,
} from '../ui/page.js';
import { SOURCE_WORKBOOK_URL } from '../config.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const opts = (list) => list.map((v) => ({ value: v, label: v }));
const monthOpts = opts(MONTHS);

/** Filters shared by nearly every operational view. */
const BASE = [
  { name: 'region', label: 'Region', value: 'All regions', options: opts(['All regions', 'Egypt', 'UAE']) },
  { name: 'client', label: 'Client', value: 'All clients', options: opts(['All clients']) },
  { name: 'from', label: 'From', value: 'Jan', options: monthOpts },
  { name: 'to', label: 'To', value: 'Aug', options: monthOpts },
];

const withCurrency = [
  {
    name: 'currency',
    label: 'Currency',
    value: 'USD (converted)',
    options: opts(['USD (converted)', 'EGP', 'AED']),
  },
  ...BASE,
];

/**
 * Per-view specifics. `kpis` are the headline figures the page leads with;
 * `tabs` is the segmented control where the reference design has one.
 */
const SPEC = {
  dashboard: {
    filters: withCurrency,
    kpis: [
      { label: 'Recognized revenue', meta: 'All clients in this selection' },
      { label: 'Recorded hours', meta: 'Sum of submitted timesheet cells' },
      { label: 'Active clients', meta: 'With revenue or effort in the window' },
      { label: 'Evidence exceptions', meta: 'Gaps needing attention', tone: 'note' },
    ],
  },
  'revenue-concentration': {
    filters: withCurrency,
    tabs: [
      { id: 'top5', label: 'TOP 5' },
      { id: 'top10', label: 'TOP 10' },
      { id: 'all', label: 'ALL' },
    ],
    kpis: [
      { label: 'Recognized revenue', meta: 'All clients in this selection' },
      { label: 'Top 5 share', meta: 'Of recognized revenue' },
      { label: 'Clients with revenue', meta: 'Distinct clients in the job book' },
      { label: 'Largest single client', meta: 'Share of the book', tone: 'note' },
    ],
  },
  'regional-actuals': {
    filters: withCurrency,
    kpis: [
      { label: 'Egypt revenue', meta: 'Converted at the workbook rate' },
      { label: 'UAE revenue', meta: 'Converted at the workbook rate' },
      { label: 'Egypt hours', meta: 'Recorded, not capacity' },
      { label: 'UAE hours', meta: 'Recorded, not capacity' },
    ],
  },
  'projects-ticket-size': {
    filters: withCurrency,
    tabs: [
      { id: 'median', label: 'MEDIAN' },
      { id: 'mean', label: 'MEAN' },
      { id: 'spread', label: 'SPREAD' },
    ],
    kpis: [
      { label: 'Engagements', meta: 'Rows in the job book' },
      { label: 'Median ticket', meta: 'Per recognized month' },
      { label: 'Largest engagement', meta: 'Single recognized row' },
      { label: 'Below median', meta: 'Engagements under the midpoint' },
    ],
  },

  'hours-coverage': {
    filters: BASE,
    kpis: [
      { label: 'Employees expected', meta: 'On the master mapping' },
      { label: 'Submissions received', meta: 'Employee-months with a value' },
      { label: 'Coverage', meta: 'Received over expected' },
      { label: 'Missing submissions', meta: 'Never read as zero', tone: 'note' },
    ],
  },
  'hours-per-employee': {
    filters: BASE,
    tabs: [
      { id: 'cumulative', label: 'CUMULATIVE' },
      { id: 'peak', label: 'PEAK MONTH' },
      { id: 'az', label: 'A–Z' },
    ],
    kpis: [
      { label: 'Employees with recorded hours', meta: 'In the selected window' },
      { label: 'Total recorded hours', meta: 'Sum of submitted timesheet cells' },
      { label: 'Average per employee', meta: 'Across populated months' },
      { label: 'Months above reference', meta: 'Employee-months above 140h', tone: 'note' },
    ],
  },
  'revenue-vs-hours': {
    filters: withCurrency,
    kpis: [
      { label: 'Recognized revenue', meta: 'All clients in this selection' },
      { label: 'Recorded hours', meta: 'Directly against clients' },
      { label: 'Revenue per hour', meta: 'Across the selection' },
      { label: 'Clients without hours', meta: 'Revenue but no recorded effort', tone: 'note' },
    ],
  },
  'revenue-hours-service': {
    filters: [
      ...withCurrency.slice(0, 3),
      { name: 'sector', label: 'Sector', value: 'All sectors', options: opts(['All sectors']) },
      { name: 'engagement', label: 'Engagement', value: 'All', options: opts(['All']) },
      ...withCurrency.slice(3),
    ],
    tabs: [
      { id: 'revenue', label: 'REVENUE' },
      { id: 'hours', label: 'HOURS' },
    ],
    kpis: [
      { label: 'Service lines with revenue', meta: 'Distinct Service values in the job book' },
      { label: 'Recognized revenue', meta: 'All services in this selection' },
      { label: 'Recorded hours', meta: 'Before service attribution' },
      {
        label: 'Hours not attributable',
        meta: 'Clients with recorded hours but no revenue rows',
        tone: 'note',
      },
    ],
  },
  'scope-vs-effort': {
    filters: BASE,
    kpis: [
      { label: 'Clients with documented scope', meta: 'From the signed scope document' },
      { label: 'Assumed hours', meta: 'Total documented dedication' },
      { label: 'Recorded hours', meta: 'Against the same clients' },
      { label: 'Unscoped clients', meta: 'Effort with no scope on file', tone: 'note' },
    ],
  },
  'actual-vs-assumed': {
    filters: BASE,
    tabs: [
      { id: 'deviation', label: 'DEVIATION' },
      { id: 'monthly', label: 'MONTHLY' },
      { id: 'variance', label: 'VARIANCE' },
    ],
    kpis: [
      { label: 'Clients compared', meta: 'With both scope and effort' },
      { label: 'Total deviation', meta: 'Actual minus assumed' },
      { label: 'Above dedication', meta: 'Clients running over scope' },
      { label: 'Below dedication', meta: 'Clients running under scope' },
    ],
  },
  'workload-pressure': {
    filters: BASE,
    kpis: [
      { label: 'Employees above reference', meta: 'At least one month over 140h' },
      { label: 'Sustained pressure', meta: 'Three or more consecutive months', tone: 'note' },
      { label: 'Peak employee-month', meta: 'Highest single recorded month' },
      { label: 'Reference threshold', meta: 'Hours per month' },
    ],
  },

  'client-intelligence': {
    filters: withCurrency,
    kpis: [
      { label: 'Clients profiled', meta: 'With any record in the window' },
      { label: 'Revenue covered', meta: 'Across profiled clients' },
      { label: 'Effort covered', meta: 'Across profiled clients' },
      { label: 'Incomplete profiles', meta: 'Missing scope, effort or revenue', tone: 'note' },
    ],
  },
  'commercial-direction': {
    filters: withCurrency,
    tabs: [
      { id: 'revenue', label: 'REVENUE' },
      { id: 'mix', label: 'MIX' },
      { id: 'concentration', label: 'CONCENTRATION' },
    ],
    kpis: [
      { label: 'Complete months', meta: 'Partial months excluded from trend' },
      { label: 'Revenue trend', meta: 'Across complete months' },
      { label: 'Mix shift', meta: 'Largest service movement' },
      { label: 'Concentration trend', meta: 'Top 5 share over time' },
    ],
  },
  'evidence-exceptions': {
    filters: BASE,
    kpis: [
      { label: 'Total exceptions', meta: 'Across all sources', tone: 'note' },
      { label: 'Missing submissions', meta: 'Employee-months with no value' },
      { label: 'Join failures', meta: 'Codes absent from master mapping' },
      { label: 'Unscoped clients', meta: 'Effort with no scope on file' },
    ],
  },
};

export function renderAnalytical(root, view, uiState = {}) {
  const spec = SPEC[view.id] ?? { filters: BASE, kpis: [] };
  clear(root);

  const tabState = uiState[view.id] ?? spec.tabs?.[0]?.id;

  root.append(
    pageHeader(view),

    toolbar([
      spec.tabs
        ? segmented(spec.tabs, tabState, (id) => {
            uiState[view.id] = id;
            renderAnalytical(root, view, uiState);
          })
        : el('span'),
      sourceLink(SOURCE_WORKBOOK_URL),
    ]),

    filterBar(
      // Filters are inert until data arrives — offering working controls over
      // nothing to filter would be a lie about the page's state.
      spec.filters.map((f) => ({ ...f, disabled: true })),
      { note: 'Totals never include future empty months' }
    ),

    kpiRow(spec.kpis.map((k) => ({ ...k, value: '—' }))),

    awaitingData(view)
  );
}

export const ANALYTICAL_IDS = Object.keys(SPEC);
