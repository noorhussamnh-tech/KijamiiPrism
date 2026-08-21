/**
 * Chart primitives, built from DOM and CSS rather than a charting library.
 *
 * Two rules run through all of them, both taken from the reference designs:
 *
 * 1. **Every value is labelled.** A colour ramp shows shape; the number shows
 *    magnitude. Reading a figure off a legend is guesswork, so the figure is
 *    printed on the mark.
 *
 * 2. **Absent is not zero.** A missing submission renders hatched with an
 *    em dash. A zero renders as 0. Collapsing the two is the single most
 *    consequential error these views could make.
 *
 * All of them take data as arguments and hold no opinion about where it came
 * from, so they are ready before the source workbook is.
 */
import { el } from './dom.js';

const SERIES_VARS = ['--s1', '--s2', '--s3', '--s4', '--s5', '--s6'];

export function seriesColor(i) {
  return `var(${SERIES_VARS[i % SERIES_VARS.length]})`;
}

function compact(n) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n * 10) / 10);
}

export const fmt = {
  compact,
  hours: (n) => `${compact(n)}h`,
  money: (n, ccy = 'USD') => `${compact(n)} ${ccy}`,
  pct: (n) => `${(n * 100).toFixed(1)}%`,
};

/**
 * Labelled matrix. `rows` is [{ label, cells: [{ value|null, title }] }].
 * A null value is "no submission" and renders hatched.
 */
export function heatmap({ columns, rows, format = compact, emptyLabel = '—' }) {
  const values = rows.flatMap((r) => r.cells.map((c) => c.value)).filter((v) => v !== null && v !== undefined);
  const max = values.length ? Math.max(...values) : 0;

  // Five filled steps; step 0 is reserved for a real zero so it stays visible.
  const step = (v) => {
    if (max <= 0) return 1;
    return Math.min(5, Math.max(1, Math.ceil((v / max) * 5)));
  };

  // An explicit track count, not auto-fit: auto-fit derives the number of
  // columns from available width, so a narrow container silently produces
  // fewer tracks than there are months and every row wraps.
  const cols = `grid-template-columns: 170px repeat(${columns.length}, minmax(44px, 1fr))`;

  const head = el('div', { class: 'hm__row hm__row--head', style: cols }, [
    el('div', { class: 'hm__rowlabel' }),
    ...columns.map((c) => el('div', { class: 'hm__colhead', text: c })),
  ]);

  const body = rows.map((r) =>
    el('div', { class: 'hm__row', style: cols }, [
      el('div', { class: 'hm__rowlabel', text: r.label, title: r.label }),
      ...r.cells.map((c) => {
        const absent = c.value === null || c.value === undefined;
        return el('div', {
          class: absent ? 'hm__cell hm__cell--absent' : `hm__cell hm__cell--l${step(c.value)}`,
          text: absent ? emptyLabel : format(c.value),
          title: c.title ?? (absent ? 'No submission' : String(c.value)),
        });
      }),
    ])
  );

  return el('div', { class: 'hm-wrap' }, [el('div', { class: 'hm' }, [head, ...body])]);
}

/**
 * Ranked horizontal bars with the value printed at the end.
 * `items` is [{ label, value, meta, color }].
 */
export function rankedBars({ items, format = compact, color }) {
  const max = items.length ? Math.max(...items.map((i) => i.value)) : 0;

  return el(
    'ul',
    { class: 'rank' },
    items.map((it, i) =>
      el('li', { class: 'rank__row' }, [
        el('span', { class: 'rank__label', text: it.label, title: it.label }),
        el('span', { class: 'rank__track' }, [
          el('span', {
            class: 'rank__fill',
            style: `width:${max > 0 ? (it.value / max) * 100 : 0}%;background:${
              it.color ?? color ?? seriesColor(i)
            }`,
          }),
        ]),
        el('span', { class: 'rank__nums' }, [
          el('span', { class: 'rank__value', text: format(it.value) }),
          it.meta && el('span', { class: 'rank__meta', text: it.meta }),
        ]),
      ])
    )
  );
}

/**
 * Paired bars comparing two measures on the same row — revenue share against
 * effort share, actual against assumed. The gap between the pair is the point,
 * so they share a scale.
 */
export function pairedBars({ items, formatA = compact, formatB = compact }) {
  const max = items.length
    ? Math.max(...items.flatMap((i) => [i.a, i.b]).filter((n) => Number.isFinite(n)))
    : 0;
  const w = (v) => (max > 0 ? (v / max) * 100 : 0);

  return el(
    'ul',
    { class: 'pair' },
    items.map((it) =>
      el('li', { class: 'pair__row' }, [
        el('span', { class: 'pair__label', text: it.label, title: it.label }),
        el('span', { class: 'pair__bars' }, [
          el('span', { class: 'pair__track' }, [
            el('span', { class: 'pair__fill pair__fill--a', style: `width:${w(it.a)}%` }),
          ]),
          el('span', { class: 'pair__track' }, [
            el('span', { class: 'pair__fill pair__fill--b', style: `width:${w(it.b)}%` }),
          ]),
        ]),
        el('span', { class: 'pair__nums' }, [
          el('span', { class: 'pair__value', text: formatA(it.a) }),
          el('span', { class: 'pair__value pair__value--b', text: formatB(it.b) }),
        ]),
      ])
    )
  );
}

/**
 * Monthly stacked columns. `months` is [{ label, segments: [{ key, value }] }],
 * `keys` gives the stacking order and legend order.
 */
export function stackedMonths({ months, keys, format = compact }) {
  const totals = months.map((m) => m.segments.reduce((s, x) => s + (x.value || 0), 0));
  const max = totals.length ? Math.max(...totals) : 0;
  const colorFor = (key) => seriesColor(keys.indexOf(key));

  return el('div', { class: 'stack' }, [
    el(
      'div',
      { class: 'stack__plot' },
      months.map((m, mi) =>
        el('div', { class: 'stack__col' }, [
          el('div', { class: 'stack__barwrap' }, [
            el('div', { class: 'stack__total', text: totals[mi] ? format(totals[mi]) : '' }),
            el(
              'div',
              {
                class: 'stack__bar',
                style: `height:${max > 0 ? (totals[mi] / max) * 100 : 0}%`,
              },
              m.segments
                .filter((s) => s.value > 0)
                .map((s) =>
                  el('span', {
                    class: 'stack__seg',
                    style: `flex-grow:${s.value};background:${colorFor(s.key)}`,
                    title: `${s.key} · ${format(s.value)}`,
                  })
                )
            ),
          ]),
          el('div', { class: 'stack__xlabel', text: m.label }),
        ])
      )
    ),
  ]);
}

/**
 * Deviation bars: signed values on a shared centre line. Used for actual minus
 * assumed, where the sign carries the meaning.
 */
export function deviationBars({ items, format = compact }) {
  const max = items.length ? Math.max(...items.map((i) => Math.abs(i.value)), 0) : 0;

  return el(
    'ul',
    { class: 'dev' },
    items.map((it) => {
      const over = it.value >= 0;
      return el('li', { class: 'dev__row' }, [
        el('span', { class: 'dev__label', text: it.label, title: it.label }),
        el('span', { class: 'dev__track' }, [
          el('span', { class: 'dev__axis' }),
          el('span', {
            class: `dev__fill dev__fill--${over ? 'over' : 'under'}`,
            style: `width:${max > 0 ? (Math.abs(it.value) / max) * 50 : 0}%;${
              over ? 'left:50%' : 'right:50%'
            }`,
          }),
        ]),
        el('span', {
          class: `dev__value dev__value--${over ? 'over' : 'under'}`,
          text: `${over ? '+' : ''}${format(it.value)}`,
        }),
      ]);
    })
  );
}
