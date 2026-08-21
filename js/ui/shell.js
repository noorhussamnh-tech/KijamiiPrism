/**
 * The signed-in chrome: grouped sidebar, top bar, and the outlet views render
 * into. Built once per sign-in; route changes repaint only the outlet and
 * restyle the nav, so the sidebar never flickers.
 */
import { el, clear } from './dom.js';
import { getState, isAdmin } from '../state.js';
import { currentRoute, navigate } from '../router.js';
import { GROUPS, viewsInGroup, getView, groupLabel } from '../nav.js';
import { SOURCE_WORKBOOK_URL, APP_VERSION } from '../config.js';
import { sourceLink } from './page.js';

let outlet = null;
let navButtons = new Map();
let statusEl = null;
let crumbEl = null;

export function getOutlet() {
  return outlet;
}

export function setRealtimeStatus(status) {
  if (!statusEl) return;
  const live = status === 'SUBSCRIBED';
  statusEl.className = `livestat ${live ? 'livestat--on' : 'livestat--off'}`;
  statusEl.title = live ? 'Subscribed to database changes' : `Realtime: ${status}`;
  statusEl.querySelector('.livestat__text').textContent = live ? 'Live · Supabase' : 'Offline';
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

function sidebar({ onSignOut }) {
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

  const displayName = profile?.full_name || profile?.email || 'Signed in';
  const initial = (displayName[0] ?? '?').toUpperCase();

  return el('aside', { class: 'sidebar' }, [
    el('div', { class: 'brand' }, [
      el('span', { class: 'brand__prism', 'aria-hidden': 'true' }),
      el('div', { class: 'brand__text' }, [
        el('p', { class: 'brand__name' }, [
          el('span', { class: 'brand__kijamii', text: 'KIJAMII ' }),
          el('span', { class: 'brand__word', text: 'PRISM' }),
        ]),
        el('p', { class: 'brand__ver', text: `${APP_VERSION} · Intelligence Layer` }),
      ]),
    ]),

    el('nav', { class: 'nav', 'aria-label': 'Sections' }, groups),

    el('div', { class: 'sidebar__foot' }, [
      el('div', { class: 'who' }, [
        el('span', { class: 'who__avatar', text: initial, 'aria-hidden': 'true' }),
        el('div', { class: 'who__text' }, [
          el('p', { class: 'who__name', text: displayName }),
          el('p', {
            class: 'who__role',
            text: isAdmin() ? 'Kijamii Leader' : 'Kijamii Team',
          }),
        ]),
      ]),
      el('button', {
        class: 'signout',
        type: 'button',
        text: 'SIGN OUT',
        onClick: onSignOut,
      }),
    ]),
  ]);
}

function topbar() {
  crumbEl = el('div', { class: 'crumb' });
  statusEl = el('div', { class: 'livestat livestat--off' }, [
    el('span', { class: 'livestat__dot', 'aria-hidden': 'true' }),
    el('span', { class: 'livestat__text', text: 'Offline' }),
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

export function renderShell(root, { onSignOut }) {
  clear(root);
  outlet = el('main', { class: 'outlet', id: 'view' });

  root.append(
    el('div', { class: 'shell' }, [
      sidebar({ onSignOut }),
      el('div', { class: 'stage' }, [topbar(), outlet]),
    ])
  );

  highlightRoute();
  return outlet;
}
