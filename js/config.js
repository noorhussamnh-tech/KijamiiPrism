/**
 * App-level constants for the demonstration build.
 *
 * The production configuration is deliberately absent. There is no Supabase
 * URL, no publishable key and no administrator address in this file, because
 * this branch has no backend to point them at — every figure is read from
 * js/demo/dataset.js, in the browser, offline.
 *
 * If you are adding something here, note what is *not* here: a credential of
 * any kind, in any form, does not belong on this branch. The demo is public.
 */

/** Read by main.js, shell.js and page.js to render the demonstration chrome. */
export const DEMO_MODE = true;

/** The label required on every screen. Rendered by ui/shell.js. */
export const DEMO_LABEL = 'Demonstration Environment — Anonymized Data';

export const APP_VERSION = 'v2.4 · demo';

/**
 * There is no source workbook on this branch, and there will not be one — the
 * pill exists so the interface grammar stays intact, and it says exactly what
 * the figures behind it are.
 */
export const SOURCE_WORKBOOK_URL = null;
