/**
 * Realtime — inert in the demonstration build.
 *
 * In production this opens a websocket to Supabase and reloads the record when
 * a row changes. Here the dataset is fixed and shipped with the page, so there
 * is nothing to subscribe to and no socket is opened. The Content-Security
 * Policy in vercel.json would refuse the connection in any case.
 *
 * The status callback still fires once, so the top-bar indicator reports what
 * this build actually is rather than sitting on "Offline" and reading as a
 * broken connection.
 */

export function subscribeToChanges({ onStatus } = {}) {
  onStatus?.('DEMO');
  return null;
}

export function unsubscribeFromChanges() {}
