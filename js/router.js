/**
 * Hash routing. Chosen over the History API deliberately: the app is deployed
 * as static files, and a path-based route would 404 on refresh unless the host
 * is configured to rewrite. A hash always resolves to index.html.
 *
 * Valid routes come from nav.js, so adding a view to the sidebar makes it
 * routable in the same edit.
 */
import { VIEW_IDS, DEFAULT_VIEW } from './nav.js';

export function currentRoute() {
  const name = window.location.hash.replace(/^#\/?/, '');
  return VIEW_IDS.includes(name) ? name : DEFAULT_VIEW;
}

export function navigate(route) {
  window.location.hash = `#/${route}`;
}

export function onRouteChange(handler) {
  const listener = () => handler(currentRoute());
  window.addEventListener('hashchange', listener);
  return () => window.removeEventListener('hashchange', listener);
}
