/**
 * About Prism — what the platform is, how it reads the record, and the rules
 * every view obeys. Static content: no source data required.
 */
import { el, clear } from '../ui/dom.js';
import { pageHeader, panel } from '../ui/page.js';
import { GROUPS, viewsInGroup } from '../nav.js';

const RULES = [
  {
    title: 'A gap is not a zero',
    body: 'A month with no timesheet submission is unknown effort, not absent effort. It renders hatched, it is excluded from averages, and it is never summed as zero. Most of the honesty in this platform rests on this single rule.',
  },
  {
    title: 'Recorded, not forecast',
    body: 'Every figure traces to a row in the source record. Nothing is projected, annualised, or smoothed. A partial current month stays partial rather than being scaled to a full one.',
  },
  {
    title: 'Attribution is labelled as attribution',
    body: 'Timesheets carry no service column, so service-level hours are derived from each client’s revenue mix. Wherever a number is inferred rather than measured, the page says so in the method note above the chart.',
  },
  {
    title: 'Exceptions are visible, not absorbed',
    body: 'Join failures, missing submissions and unscoped clients are surfaced on their own page rather than quietly dropped. A clean total that hides what it excluded is worse than a smaller total that shows its working.',
  },
  {
    title: 'Every figure is labelled',
    body: 'Colour shows shape; the printed number shows magnitude. No value in Prism requires reading a position against an axis to know what it is.',
  },
  {
    title: 'The database decides who sees what',
    body: 'In production, access is enforced by Row Level Security in Postgres, not by hiding controls in the interface — hiding a button is a courtesy; the policy is the boundary. This demonstration build has no database and no accounts at all; it is read-only by construction.',
  },
];

const METHOD = [
  ['Source', 'Four records: the job book for revenue, time dedication for hours, the scope document for assumed dedication, and a master mapping that joins employee codes to names and regions. In this demonstration build all four are a single fixed, fictional dataset shipped with the page.'],
  ['Join', 'Employee code from the master mapping links time dedication to people and regions. Client code links the job book, timesheets and scope document. Rows that fail to join appear in Evidence Exceptions rather than being discarded.'],
  ['Window', 'Every view is bounded by the From and To month selection. Totals never reach into future empty months.'],
  ['Currency', 'Regional figures convert to a single currency at the rate stated on the row. Conversion is applied once, at read time, never re-applied downstream.'],
];

export function renderAbout(root, view) {
  clear(root);

  root.append(
    pageHeader(view),

    panel({
      eyebrow: 'Purpose',
      title: 'What Prism is for',
      body: el('div', { class: 'prose' }, [
        el('p', {
          text: 'The agency runs on records kept in spreadsheets — what was billed, what was worked, what was promised. Those records answer real questions, but only to whoever is willing to open four tabs and reconcile them by hand.',
        }),
        el('p', {
          text: 'Prism is the reading layer over those records. It joins them once, applies one consistent set of rules, and puts each answer on a page that states the question it answers and the method it used to answer it.',
        }),
        el('p', {
          text: 'It is deliberately read-only. Prism is not where the record is kept and not where it is corrected — the source record remains the source of truth. What Prism adds is a consistent, inspectable reading of what is already there.',
        }),
      ]),
    }),

    panel({
      eyebrow: 'This build',
      title: 'What you are looking at',
      body: el('div', { class: 'prose' }, [
        el('p', {
          text: 'This is the demonstration environment. Every page, filter, calculation and interaction is the production application, running the production code — but the record underneath it is not. It is a fixed, fully invented dataset generated for this build.',
        }),
        el('p', {
          text: 'Client names, employee names, regions, revenue figures, hours, scope percentages and exception counts are all fictional. None of them corresponds to a real account, a real person or a real amount, and none was derived from a real one by rounding, scaling or perturbation. The dataset was written from nothing.',
        }),
        el('p', {
          text: 'Nothing here connects to anything. There is no database client in the build, no credentials in the source, no sign-in, and no path by which a figure on screen could have come from a live system. The page opens no network connection after it loads.',
        }),
      ]),
      footnote:
        'The patterns are deliberate, though: the concentration curve, the missing timesheets, the clients with no scope on file and the incomplete trailing month are all planted, because a platform built to handle imperfect records demonstrates nothing on a perfect one.',
    }),

    panel({
      eyebrow: 'Governance',
      title: 'Rules every view obeys',
      body: el(
        'div',
        { class: 'rules' },
        RULES.map((r, i) =>
          el('article', { class: 'rule' }, [
            el('span', { class: 'rule__num', text: String(i + 1).padStart(2, '0') }),
            el('div', {}, [
              el('h3', { class: 'rule__title', text: r.title }),
              el('p', { class: 'rule__body', text: r.body }),
            ]),
          ])
        )
      ),
    }),

    panel({
      eyebrow: 'Method',
      title: 'How the record is read',
      body: el(
        'dl',
        { class: 'deflist' },
        METHOD.flatMap(([term, def]) => [
          el('dt', { class: 'deflist__t', text: term }),
          el('dd', { class: 'deflist__d', text: def }),
        ])
      ),
    }),

    panel({
      eyebrow: 'Modules',
      title: 'What each section covers',
      body: el(
        'div',
        { class: 'modules' },
        GROUPS.map((g) =>
          el('div', { class: 'modules__group' }, [
            el('p', { class: 'modules__label', text: g.label }),
            el(
              'ul',
              { class: 'modules__list' },
              viewsInGroup(g.id).map((v) =>
                el('li', { class: 'modules__item' }, [
                  el('p', { class: 'modules__name', text: v.label }),
                  el('p', { class: 'modules__q', text: v.question }),
                ])
              )
            ),
          ])
        )
      ),
      footnote: 'Each module answers one question. If a page cannot state its question, it does not belong.',
    })
  );
}
