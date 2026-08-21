/**
 * Knowledge Center — the definition behind every metric, with the source
 * column it reads and the trap it avoids. Static content.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel, tag } from '../ui/page.js';

const METRICS = [
  {
    term: 'Recorded hours',
    formula: 'SUM(time_dedication.hours) over the window',
    source: 'Time dedication · hours',
    note: 'Hours someone entered on a timesheet. Not utilization, not capacity, and not billable hours.',
  },
  {
    term: 'Coverage',
    formula: 'submissions_received ÷ (employees × months in window)',
    source: 'Time dedication · employee, month',
    note: 'The precondition for every effort figure. Low coverage does not make hours wrong — it makes them incomplete, which is a different problem.',
  },
  {
    term: 'Recognized revenue',
    formula: 'SUM(job_book.revenue) for months inside the window',
    source: 'Job book · revenue, month',
    note: 'Recognized in the month it was earned, not the month it was invoiced or collected.',
  },
  {
    term: 'Attributed hours',
    formula: "client_hours × (service_revenue ÷ client_total_revenue)",
    source: 'Job book · client, service, revenue + Time dedication · client, hours',
    note: 'An estimate, not a measurement. Timesheets carry no service column, so a client’s hours are split across their services in proportion to revenue. A client with revenue in one service and effort in another will be attributed wrongly by construction.',
    flag: 'ATTRIBUTED',
  },
  {
    term: 'Assumed dedication',
    formula: 'scope_document.assumed_monthly_hours',
    source: 'Scope document · client, assumed hours',
    note: 'What the signed scope says the client should absorb. A client absent from the scope document is unscoped, not zero-scope.',
  },
  {
    term: 'Deviation',
    formula: 'recorded_hours − assumed_hours',
    source: 'Derived',
    note: 'Positive is effort beyond documented scope. It is a prompt to check whether the scope is stale, not automatically an overrun.',
  },
  {
    term: 'Ticket size',
    formula: 'revenue per engagement row, per recognized month',
    source: 'Job book · engagement, revenue, month',
    note: 'A twelve-month retainer counts once per recognized month, not once at signature. Comparing it to a one-off project fee without that adjustment overstates the retainer.',
  },
  {
    term: 'Revenue per hour',
    formula: 'recognized_revenue ÷ recorded_hours',
    source: 'Derived',
    note: 'Only meaningful where coverage is high. Dividing full revenue by partial hours inflates the rate, so the figure is suppressed below a coverage floor.',
  },
  {
    term: 'Concentration',
    formula: 'top_n_revenue ÷ total_revenue',
    source: 'Job book · client, revenue',
    note: 'Measured on recognized revenue in the window, not on contracted value or pipeline.',
  },
  {
    term: 'Months above reference',
    formula: 'COUNT(employee_months WHERE hours > threshold)',
    source: 'Time dedication · employee, month, hours',
    note: 'Counts recorded months only. Unrecorded overtime is invisible here, which means this figure is a floor rather than a true count.',
  },
];

export function renderKnowledgeCenter(root, view) {
  clear(root);

  root.append(
    pageHeader(view),

    panel({
      eyebrow: 'Definitions',
      title: 'Every metric, its formula, and what it cannot tell you',
      body: el(
        'div',
        { class: 'metrics' },
        METRICS.map((m) =>
          el('article', { class: 'metric' }, [
            el('div', { class: 'metric__head' }, [
              el('h3', { class: 'metric__term', text: m.term }),
              m.flag && tag(m.flag, 'note'),
            ]),
            el('p', { class: 'metric__formula', text: m.formula }),
            el('p', { class: 'metric__source', text: `Source · ${m.source}` }),
            el('p', { class: 'metric__note', text: m.note }),
          ])
        )
      ),
      footnote:
        'Where a metric has a known blind spot, it is stated here rather than discovered later in a meeting.',
    })
  );
}
