/**
 * Page grammar.
 *
 * Every analytical view in Prism is built from the same sequence: a question,
 * a statement of what is shown, a note on method, controls, headline figures,
 * then evidence. These helpers make that sequence the path of least
 * resistance, so pages stay consistent without each view re-deciding its own
 * layout.
 */
import { el } from './dom.js';

/** The editorial header: question → headline → method caveat. */
export function pageHeader(view) {
  return el('header', { class: 'page__head' }, [
    el('p', { class: 'page__question', text: view.question }),
    el('h1', { class: 'page__headline', text: view.headline }),
    view.caveat && el('p', { class: 'page__caveat', text: view.caveat }),
  ]);
}

/**
 * A segmented control. Returns the element; `onPick` receives the chosen id.
 * Used for CUMULATIVE / PEAK MONTH / A–Z style view switches.
 */
export function segmented(options, active, onPick) {
  return el(
    'div',
    { class: 'segmented', role: 'tablist' },
    options.map((o) =>
      el('button', {
        class: `segmented__opt${o.id === active ? ' segmented__opt--on' : ''}`,
        type: 'button',
        role: 'tab',
        'aria-selected': String(o.id === active),
        text: o.label,
        onClick: () => onPick(o.id),
      })
    )
  );
}

/** The "SOURCE WORKBOOK ↗" pill. Href is configured, never guessed. */
export function sourceLink(href) {
  if (!href) {
    return el('span', {
      class: 'srcpill srcpill--unset',
      title: 'Set the workbook URL in js/config.js',
      text: '● SOURCE NOT LINKED',
    });
  }
  return el('a', {
    class: 'srcpill',
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: '● SOURCE WORKBOOK ↗',
  });
}

/** Toolbar sitting under the header: toggles on the left, source on the right. */
export function toolbar(children) {
  return el('div', { class: 'toolbar' }, children);
}

/**
 * The filter strip. `filters` is a list of { name, label, options, value }.
 * `note` is the right-aligned caveat, e.g. "Totals never include future empty months".
 */
export function filterBar(filters, { note, onChange } = {}) {
  return el('section', { class: 'filters', 'aria-label': 'Filters' }, [
    el(
      'div',
      { class: 'filters__row' },
      filters.map((f) =>
        el('label', { class: 'filters__item', for: `flt_${f.name}` }, [
          el('span', { class: 'filters__label', text: f.label }),
          el(
            'select',
            {
              class: 'input input--inline',
              id: `flt_${f.name}`,
              name: f.name,
              disabled: f.disabled ?? false,
              onChange: (e) => onChange?.(f.name, e.target.value),
            },
            (f.options ?? []).map((o) =>
              el('option', {
                value: o.value,
                text: o.label,
                selected: String(o.value) === String(f.value),
              })
            )
          ),
        ])
      )
    ),
    note && el('p', { class: 'filters__note', text: note }),
  ]);
}

/**
 * A headline figure. `tone` shifts the value colour for figures that carry a
 * warning (an exception count, months above reference).
 */
export function kpi({ label, value, meta, tone }) {
  return el('article', { class: 'kpi' }, [
    el('p', { class: 'kpi__label', text: label }),
    el('p', { class: `kpi__value${tone ? ` kpi__value--${tone}` : ''}`, text: value }),
    meta && el('p', { class: 'kpi__meta', text: meta }),
  ]);
}

export function kpiRow(items) {
  return el('section', { class: 'kpi-row' }, items.map(kpi));
}

/**
 * An evidence panel: eyebrow, title, optional right-hand slot (legend or
 * toggle), body, and a source footnote.
 */
export function panel({ eyebrow, title, aside, body, footnote, wide = true }) {
  return el('section', { class: `panel${wide ? '' : ' panel--half'}` }, [
    el('div', { class: 'panel__top' }, [
      el('div', {}, [
        eyebrow && el('p', { class: 'panel__eyebrow', text: eyebrow }),
        title && el('h2', { class: 'panel__title', text: title }),
      ]),
      aside,
    ]),
    body,
    footnote && el('p', { class: 'panel__footnote', text: footnote }),
  ]);
}

/** Two panels side by side, stacking on narrow screens. */
export function twoUp(a, b) {
  return el('div', { class: 'two-up' }, [a, b]);
}

/** A colour key for a categorical series. */
export function legend(series) {
  return el(
    'div',
    { class: 'legend' },
    series.map((s) =>
      el('span', { class: 'legend__item' }, [
        el('span', { class: 'legend__swatch', style: `background:${s.color}` }),
        el('span', { class: 'legend__label', text: s.label }),
      ])
    )
  );
}

/** A small labelled tag, e.g. HATCHED = NO SUBMISSION, ATTRIBUTED, USD. */
export function tag(text, variant = 'neutral') {
  return el('span', { class: `tag tag--${variant}`, text });
}

/**
 * The state every analytical view holds until its source data arrives.
 *
 * It renders the page's real chrome and then says precisely which columns are
 * missing — so the page doubles as the specification for the export that will
 * fill it, rather than being a blank rectangle labelled "no data".
 */
export function awaitingData(view) {
  return el('section', { class: 'awaiting' }, [
    el('div', { class: 'awaiting__mark', 'aria-hidden': 'true' }),
    el('h2', { class: 'awaiting__title', text: 'Waiting on source data' }),
    el('p', {
      class: 'awaiting__body',
      text: 'The layout, filters and figures for this view are built. It needs these columns before it can show a real number:',
    }),
    el(
      'ul',
      { class: 'awaiting__needs' },
      (view.needs ?? []).map((n) => el('li', { class: 'awaiting__need', text: n }))
    ),
    el('p', {
      class: 'awaiting__hint',
      text: 'Deliberately blank rather than filled with placeholder figures — a chart with invented numbers is indistinguishable from a real one at a glance.',
    }),
  ]);
}
