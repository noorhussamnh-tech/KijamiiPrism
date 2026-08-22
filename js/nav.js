/**
 * The navigation model — and the single source of truth for page identity.
 *
 * Sidebar groups, the router's valid routes, the top-bar breadcrumb, and each
 * page's editorial header all read from here, so a view cannot drift out of
 * sync with the way it is labelled in the nav.
 *
 * Every entry also declares `needs`: the source columns that view depends on.
 * That is not decoration — the data-pending state renders it, so each page
 * states exactly what it is waiting for.
 */

export const GROUPS = [
  { id: 'intelligence', label: 'Intelligence' },
  { id: 'operations', label: 'Operations' },
  { id: 'strategy', label: 'Strategy' },
  { id: 'library', label: 'Library' },
  { id: 'administration', label: 'Administration' },
];

/**
 * question  — the mono eyebrow; every page answers one question
 * headline  — the display statement of what the page shows
 * caveat    — the method note; what the numbers are and are not
 * needs     — source columns required before the view can render real figures
 */
export const VIEWS = [
  // ------------------------------------------------------------ intelligence
  {
    id: 'dashboard',
    group: 'intelligence',
    label: 'Management Dashboard',
    title: 'Management Dashboard',
    question: 'Where does the agency stand this month?',
    headline: 'One screen for revenue, effort and coverage, with everything else one click away',
    caveat:
      'Every figure here is recorded, not forecast. Months with no submission are gaps, never zeros.',
    needs: ['Job book · revenue', 'Time dedication · hours', 'Master mapping · employee ↔ region'],
  },
  {
    id: 'revenue-concentration',
    group: 'intelligence',
    label: 'Revenue Concentration',
    title: 'Revenue Concentration',
    question: 'How much of the revenue rests on how few clients?',
    headline: 'Recognized revenue ranked by client, with the dependency the top accounts represent',
    caveat:
      'Concentration is measured on recognized revenue in the selected window, not on contracted value.',
    needs: ['Job book · client, revenue, currency, month'],
  },
  {
    id: 'regional-actuals',
    group: 'intelligence',
    label: 'Regional Actuals',
    title: 'Regional Actuals',
    question: 'What did each region actually record?',
    headline: 'Calderra and Solvina side by side on recorded revenue and recorded effort',
    caveat:
      'Regional figures convert to a single currency at the rate stated on the row; conversion is applied once, at read time.',
    needs: ['Job book · region, revenue, currency', 'Time dedication · region, hours'],
  },
  {
    id: 'projects-ticket-size',
    group: 'intelligence',
    label: 'Projects & Ticket Size',
    title: 'Projects & Ticket Size',
    question: 'What is a typical engagement worth?',
    headline: 'Distribution of engagement value, and where the outliers sit',
    caveat:
      'Ticket size is revenue per engagement row in the job book. Retainers spanning months are counted per recognized month, not once.',
    needs: ['Job book · engagement, client, revenue, month'],
  },

  // -------------------------------------------------------------- operations
  {
    id: 'hours-coverage',
    group: 'operations',
    label: 'Hours & Coverage',
    title: 'Hours & Coverage',
    question: 'Who submitted, and for which months?',
    headline: 'Submission coverage before any number is read as effort',
    caveat:
      'Coverage is the precondition for every other operations view. A missing submission is not zero effort — it is an unknown.',
    needs: ['Time dedication · employee, month, submitted'],
  },
  {
    id: 'hours-per-employee',
    group: 'operations',
    label: 'Hours per Employee',
    title: 'Hours per Month per Employee',
    question: 'How many hours did each employee record, month by month?',
    headline: 'Employee-level monthly effort, with missing submissions shown as gaps',
    caveat:
      'These are recorded timesheet hours, not utilization or capacity. A blank cell means no submission for that month — it is never read as zero effort.',
    needs: ['Time dedication · employee code, month, hours', 'Master mapping · employee code ↔ name'],
  },
  {
    id: 'revenue-vs-hours',
    group: 'operations',
    label: 'Revenue vs. Hours',
    title: 'Revenue vs. Hours',
    question: 'Which clients earn well against the effort they absorb?',
    headline: 'Recognized revenue set against recorded hours, per client',
    caveat:
      'Hours are recorded against clients directly here — no attribution is involved, unlike the per-service view.',
    needs: ['Job book · client, revenue', 'Time dedication · client, hours'],
  },
  {
    id: 'revenue-hours-service',
    group: 'operations',
    label: 'Revenue & Hours per Service',
    title: 'Revenue & Hours per Service',
    question: 'Which service lines earn the revenue, and which absorb the effort?',
    headline: "Revenue is recorded per service; hours are attributed through each client's service mix",
    caveat:
      "Timesheets carry no service column. A client's recorded hours are split across that client's services in proportion to that client's recognized revenue in the same window — an attribution, not a direct measurement.",
    needs: ['Job book · client, service, revenue', 'Time dedication · client, hours'],
  },
  {
    id: 'scope-vs-effort',
    group: 'operations',
    label: 'Scope vs. Effort',
    title: 'Scope vs. Effort',
    question: 'Are we working to the scope we sold?',
    headline: 'Documented scope against the effort actually recorded, per client',
    caveat:
      'Scope is read from the signed scope document. Clients with recorded effort but no documented scope are listed separately rather than treated as zero-scope.',
    needs: ['Scope document · client, assumed hours', 'Time dedication · client, hours'],
  },
  {
    id: 'actual-vs-assumed',
    group: 'operations',
    label: 'Actual vs. Assumed Hours',
    title: 'Actual vs. Assumed Dedication',
    question: 'Where does real effort diverge from assumed dedication?',
    headline: 'Deviation from documented dedication, per client and per month',
    caveat:
      'Deviation is actual minus assumed. A positive bar is effort beyond what was documented; it is a signal to check the scope, not automatically an overrun.',
    needs: ['Scope document · client, assumed monthly hours', 'Time dedication · client, month, hours'],
  },
  {
    id: 'workload-pressure',
    group: 'operations',
    label: 'Workload Pressure',
    title: 'Workload Pressure',
    question: 'Who is carrying more than they can hold?',
    headline: 'Sustained load per employee against the reference month',
    caveat:
      'Pressure counts employee-months above the reference threshold. It reads recorded hours only, and cannot see unrecorded overtime.',
    needs: ['Time dedication · employee, month, hours', 'Reference threshold'],
  },

  // ---------------------------------------------------------------- strategy
  {
    id: 'client-intelligence',
    group: 'strategy',
    label: 'Client Intelligence',
    title: 'Client Intelligence',
    question: 'What does the record say about each client?',
    headline: 'One profile per client: revenue, effort, services, scope and exceptions',
    caveat: 'A profile aggregates the same records the operations views read. Nothing is inferred.',
    needs: ['Job book', 'Time dedication', 'Scope document'],
  },
  {
    id: 'commercial-direction',
    group: 'strategy',
    label: 'Commercial Direction',
    title: 'Commercial Direction',
    question: 'Which way is the book moving?',
    headline: 'Direction of travel across revenue, mix and concentration',
    caveat:
      'Direction is read from recorded months only. Partial current months are excluded from any trend line rather than being annualised.',
    needs: ['Job book · month, client, service, revenue'],
  },
  {
    id: 'evidence-exceptions',
    group: 'strategy',
    label: 'Evidence Exceptions',
    title: 'Evidence Exceptions',
    question: 'What in the record cannot be trusted yet?',
    headline: 'Every gap, mismatch and unscoped account the other views had to work around',
    caveat:
      'This page exists so the exceptions are visible rather than silently absorbed. It is the honest counterpart to every clean number elsewhere.',
    needs: ['All sources · join failures, missing submissions, unscoped clients'],
  },

  // ----------------------------------------------------------------- library
  {
    id: 'about',
    group: 'library',
    label: 'About Prism',
    title: 'About Prism',
    question: 'What is this platform, and what are its rules?',
    headline: 'Purpose, method and the governance rules every view obeys',
    caveat: null,
    needs: [],
    static: true,
  },
  {
    id: 'knowledge-center',
    group: 'library',
    label: 'Knowledge Center',
    title: 'Knowledge Center',
    question: 'How is each figure defined?',
    headline: 'Definitions, formulas and the source column behind every metric',
    caveat: null,
    needs: [],
    static: true,
  },
  {
    id: 'boardroom',
    group: 'library',
    label: 'Boardroom Mode',
    title: 'Boardroom Mode',
    question: 'What goes on the screen in the room?',
    headline: 'The reduced set, sized for a projector and stripped of controls',
    caveat: null,
    needs: [],
    static: true,
  },

  // ---------------------------------------------------------- administration
  {
    id: 'access-control',
    group: 'administration',
    label: 'Access Control',
    title: 'Access Control',
    question: 'Who can see this, and at what level?',
    headline: 'Accounts and roles, enforced by the database rather than the interface',
    caveat: null,
    needs: [],
    static: true,
  },
];

const BY_ID = new Map(VIEWS.map((v) => [v.id, v]));
const GROUP_LABEL = new Map(GROUPS.map((g) => [g.id, g.label]));

export const DEFAULT_VIEW = 'dashboard';

export function getView(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_VIEW);
}

export function groupLabel(groupId) {
  return GROUP_LABEL.get(groupId) ?? '';
}

export function viewsInGroup(groupId) {
  return VIEWS.filter((v) => v.group === groupId);
}

export const VIEW_IDS = VIEWS.map((v) => v.id);
