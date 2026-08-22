/**
 * The chrome: the demonstration banner, a grouped sidebar, a top bar, and the
 * outlet views render into. Built once, then route changes repaint only the
 * outlet and restyle the nav, so the sidebar never flickers.
 *
 * Two differences from production, both required by this build:
 *
 *  - the banner above everything, which cannot be dismissed and is not
 *    suppressed by boardroom mode, so a screenshot taken from any page carries
 *    the label with it; and
 *  - no sign-out control, because there is no session to end.
 */
import { el, clear } from './dom.js';
import { getState } from '../state.js';
import { currentRoute, navigate } from '../router.js';
import { GROUPS, viewsInGroup, getView, groupLabel } from '../nav.js';
import { SOURCE_WORKBOOK_URL, APP_VERSION, DEMO_LABEL } from '../config.js';
import { sourceLink } from './page.js';

let outlet = null;
let navButtons = new Map();
let statusEl = null;
let crumbEl = null;

export function getOutlet() {
  return outlet;
}

/**
 * The required label. Exported so the splash carries it too — the seconds
 * before the dataset resolves are still a screen someone can screenshot.
 */
export function demoBanner() {
  return el('div', { class: 'demobar', role: 'note' }, [
    el('span', { class: 'demobar__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'demobar__text', text: DEMO_LABEL }),
    el('span', {
      class: 'demobar__sub',
      text: 'Fictional clients, employees and figures · read-only · not connected to any live system',
    }),
  ]);
}

export function setRealtimeStatus(status) {
  if (!statusEl) return;
  statusEl.className = 'livestat livestat--demo';
  statusEl.title =
    status === 'DEMO'
      ? 'Fixed dataset bundled with the page. No database connection is opened.'
      : `Status: ${status}`;
  statusEl.querySelector('.livestat__text').textContent = 'Static · demo dataset';
}

/** Highlight the active nav entry and update the breadcrumb. */
export function highlightRoute(route = currentRoute()) {
  for (const [id, button] of navButtons) {
    const active = id === route;
    button.classList.toggle('nav__item--on', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  }

  if (crumbEl) {
    const view = getView(route);
    clear(crumbEl).append(
      el('span', { class: 'crumb__section', text: groupLabel(view.group) }),
      el('span', { class: 'crumb__sep', text: '/', 'aria-hidden': 'true' }),
      el('span', { class: 'crumb__title', text: view.title })
    );
  }
}

function toggleBoardroom() {
  const on = document.documentElement.dataset.boardroom === 'true';
  document.documentElement.dataset.boardroom = on ? 'false' : 'true';
}

function sidebar() {
  const { profile } = getState();
  navButtons = new Map();

  const groups = GROUPS.map((group) => {
    const items = viewsInGroup(group.id);
    if (!items.length) return null;

    return el('div', { class: 'nav__group' }, [
      el('p', { class: 'nav__grouplabel', text: group.label }),
      ...items.map((view) => {
        const button = el('button', {
          class: 'nav__item',
          type: 'button',
          onClick: () => navigate(view.id),
        });
        button.append(
          el('span', { class: 'nav__dot', 'aria-hidden': 'true' }),
          el('span', { class: 'nav__label', text: view.label })
        );
        navButtons.set(view.id, button);
        return button;
      }),
    ]);
  }).filter(Boolean);

  const displayName = profile?.full_name ?? 'Demo Viewer';

  return el('aside', { class: 'sidebar' }, [
    el('div', { class: 'brand' }, [
      el('span', { class: 'brand__prism', 'aria-hidden': 'true' }),
      el('div', { class: 'brand__text' }, [
        el('p', { class: 'brand__name' }, [
          el('span', { class: 'brand__org', text: 'AGENCY INTELLIGENCE ' }),
          el('span', { class: 'brand__word', text: 'PRISM' }),
        ]),
        // Just the version now: "Intelligence Layer" was a useful descriptor
        // when the lockup read KIJAMII PRISM, but it repeats the name here.
        el('p', { class: 'brand__ver', text: APP_VERSION }),
      ]),
    ]),

    el('nav', { class: 'nav', 'aria-label': 'Sections' }, groups),

    el('div', { class: 'sidebar__foot' }, [
      el('div', { class: 'who' }, [
        el('span', { class: 'who__avatar', text: 'D', 'aria-hidden': 'true' }),
        el('div', { class: 'who__text' }, [
          el('p', { class: 'who__name', text: displayName }),
          el('p', { class: 'who__role', text: 'Read-only' }),
        ]),
      ]),
      // No sign-out control: there is no session in this build to end.
      el('p', { class: 'sidebar__note', text: 'Anonymized demonstration data' }),
    ]),
  ]);
}

function topbar() {
  crumbEl = el('div', { class: 'crumb' });
  statusEl = el('div', { class: 'livestat livestat--demo' }, [
    el('span', { class: 'livestat__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'livestat__text', text: 'Static · demo dataset' }),
  ]);

  return el('header', { class: 'topbar' }, [
    crumbEl,
    el('div', { class: 'topbar__right' }, [
      sourceLink(SOURCE_WORKBOOK_URL),
      el('button', {
        class: 'boardbtn',
        type: 'button',
        text: 'BOARDROOM',
        title: 'Enlarge type and hide controls for presenting',
        onClick: toggleBoardroom,
      }),
      statusEl,
    ]),
  ]);
}

export function renderShell(root) {
  clear(root);
  outlet = el('main', { class: 'outlet', id: 'view' });

  root.append(
    demoBanner(),
    el('div', { class: 'shell' }, [
      sidebar(),
      el('div', { class: 'stage' }, [topbar(), outlet]),
    ])
  );

  highlightRoute();
  return outlet;
}
