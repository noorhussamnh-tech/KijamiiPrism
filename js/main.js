/**
 * Bootstrap and wiring — demonstration build.
 *
 * Production runs session → profile → data → realtime → route, with an auth
 * gate and an approval gate in front. This build has neither gate, because it
 * has nothing to gate: the dataset is public, fictional, and already in the
 * page. So the flow is profile → data → route, and the two view modules that
 * existed only to serve the gates (auth-view, pending-view) are not on this
 * branch at all.
 *
 * Everything downstream of `renderShell` is the production code.
 */
import { loadProfile, loadTeam } from './auth.js';
import { loadPrism, loadSyncStatus, loadSyncIssues } from './data/prism.js';
import { subscribeToChanges } from './realtime.js';
import { getState, setState, replaceCollection, subscribe } from './state.js';
import { currentRoute, onRouteChange } from './router.js';
import { getView } from './nav.js';
import { renderShell, getOutlet, setRealtimeStatus, highlightRoute, demoBanner } from './ui/shell.js';
import { renderView } from './views/index.js';
import { reportError } from './ui/toast.js';
import { el, clear } from './ui/dom.js';
import { DEMO_LABEL } from './config.js';

const app = document.getElementById('app');

let shellMounted = false;
let repaintQueued = false;

/** Repaint the active view. Coalesced, because a burst of state changes would
 *  otherwise trigger one full re-render each. */
function repaint() {
  if (!shellMounted || repaintQueued) return;
  repaintQueued = true;

  requestAnimationFrame(() => {
    repaintQueued = false;
    const outlet = getOutlet();
    if (!outlet) return;
    renderView(outlet, getView(currentRoute()));
    highlightRoute();
    outlet.scrollTop = 0;
  });
}

function showSplash(message) {
  clear(app);
  app.append(
    demoBanner(),
    el('div', { class: 'splash' }, [
      el('span', { class: 'brand__prism brand__prism--lg', 'aria-hidden': 'true' }),
      el('p', { class: 'splash__text', text: message }),
    ])
  );
}

async function enterApp() {
  showSplash('Loading the demonstration dataset…');

  try {
    const profile = await loadProfile();
    setState({ profile, session: { demo: true }, loading: true });

    const [prism, team, syncStatus, syncIssues] = await Promise.all([
      loadPrism(),
      loadTeam(),
      loadSyncStatus(),
      loadSyncIssues(),
    ]);
    replaceCollection('team', team);
    setState({ prism, syncStatus, syncIssues, loading: false });

    renderShell(app);
    shellMounted = true;
    repaint();

    subscribeToChanges({ onStatus: setRealtimeStatus });
  } catch (error) {
    reportError(error, 'Could not load the demonstration dataset.');
    showSplash('Could not load the demonstration dataset. Refresh to try again.');
  }
}

// Any state change repaints the current view — the single path from data to
// pixels.
subscribe(repaint);

onRouteChange(() => repaint());

document.documentElement.dataset.demo = 'true';
document.title = `Kijamii Prism — ${DEMO_LABEL}`;

enterApp();
