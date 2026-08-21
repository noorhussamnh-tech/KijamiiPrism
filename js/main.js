/**
 * Bootstrap and wiring.
 *
 * Flow: session → profile → data → realtime → route. Each step depends on the
 * one before it, which is why they are sequential rather than parallel: the
 * realtime socket must carry the signed-in token, and the shell needs the role
 * before it decides what to show.
 */
import { getSession, onAuthStateChange, signOut, loadProfile, loadTeam } from './auth.js';
import { loadAll } from './db.js';
import { subscribeToChanges, unsubscribeFromChanges } from './realtime.js';
import { getState, setState, clearData, replaceCollection, subscribe } from './state.js';
import { currentRoute, onRouteChange } from './router.js';
import { getView } from './nav.js';
import { renderAuthView } from './ui/auth-view.js';
import { renderShell, getOutlet, setRealtimeStatus, highlightRoute } from './ui/shell.js';
import { renderView } from './views/index.js';
import { reportError } from './ui/toast.js';
import { el, clear } from './ui/dom.js';
import { supabase } from './supabase.js';

const app = document.getElementById('app');

let shellMounted = false;
let repaintQueued = false;

/** Repaint the active view. Coalesced, because a burst of realtime events
 *  would otherwise trigger one full re-render each. */
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
    el('div', { class: 'splash' }, [
      el('span', { class: 'brand__prism brand__prism--lg', 'aria-hidden': 'true' }),
      el('p', { class: 'splash__text', text: message }),
    ])
  );
}

async function enterApp(session) {
  setState({ session, loading: true });
  showSplash('Loading the intelligence layer…');

  try {
    const profile = await loadProfile(session.user.id);
    setState({ profile });

    const [{ clients, projects, tasks }, team] = await Promise.all([loadAll(), loadTeam()]);
    replaceCollection('clients', clients);
    replaceCollection('projects', projects);
    replaceCollection('tasks', tasks);
    replaceCollection('team', team);
    setState({ loading: false });

    renderShell(app, { onSignOut: handleSignOut });
    shellMounted = true;
    repaint();

    // Only now, with a session on the socket, will RLS-filtered changes arrive.
    subscribeToChanges({ onStatus: setRealtimeStatus });
  } catch (error) {
    reportError(error, 'Could not load the workspace.');
    showSplash('Could not load the workspace. Refresh to try again.');
  }
}

function leaveApp() {
  unsubscribeFromChanges();
  shellMounted = false;
  document.documentElement.dataset.boardroom = 'false';
  clearData();
  renderAuthView(app);
}

async function handleSignOut() {
  try {
    await signOut();
  } catch (error) {
    reportError(error, 'Could not sign out.');
  }
}

// Any state change repaints the current view — the single path from data to
// pixels, whether the change came from a local edit or another user.
subscribe(repaint);

onRouteChange(() => repaint());

onAuthStateChange((event, session) => {
  if (session && !shellMounted) {
    enterApp(session);
  } else if (!session && event === 'SIGNED_OUT') {
    leaveApp();
  } else if (session) {
    // TOKEN_REFRESHED and USER_UPDATED — keep the stored session current.
    setState({ session });
  }
});

async function start() {
  showSplash('Starting…');
  try {
    const session = await getSession();
    if (session) await enterApp(session);
    else renderAuthView(app);
  } catch (error) {
    reportError(error, 'Could not reach Supabase.');
    renderAuthView(app);
  }
}

start();

// Exposed for the manual RLS checks documented in the README — a member should
// be able to reach for `supabase` here and still be refused by the database.
window.__prism = { getState, supabase };
