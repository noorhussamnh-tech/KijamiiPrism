/**
 * Session — demonstration build.
 *
 * There is no authentication here, and that is not a shortcut. A sign-in form
 * over a public dataset is theatre: it implies a boundary that does not exist,
 * and it invites someone to type a real password into a demo. So the build has
 * no credential surface at all — no form, no session token, no email address,
 * nothing to phish and nothing to leak.
 *
 * The functions production calls are still exported with the same signatures,
 * so main.js is the production file. The four that changed state in production
 * — signIn, signUp, setRole, setApproval — are gone rather than stubbed,
 * because a no-op write is a button that lies about what it did.
 */
import { ACCOUNTS } from './demo/dataset.js';

/**
 * A fixed viewer. Not a signed-in user: a label for the chrome that expects
 * one. `role: 'member'` deliberately — the demo shows the read view, which is
 * what an administrator sees too, minus controls that no longer exist.
 */
const DEMO_PROFILE = Object.freeze({
  id: 'demo-viewer',
  full_name: 'Demo Viewer',
  role: 'member',
  is_approved: true,
  created_at: '2026-08-01T00:00:00.000Z',
});

const DEMO_SESSION = Object.freeze({
  user: Object.freeze({ id: 'demo-viewer' }),
  demo: true,
});

export async function getSession() {
  return DEMO_SESSION;
}

/**
 * Nothing changes the session in this build, so there is nothing to notify. The
 * unsubscribe function is still returned so callers need no special case.
 */
export function onAuthStateChange() {
  return () => {};
}

export async function loadProfile() {
  return DEMO_PROFILE;
}

/** The fictional roster Access Control displays. Carries no email column. */
export async function loadTeam() {
  return ACCOUNTS.map((a) => ({ ...a }));
}
