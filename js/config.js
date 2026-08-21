/**
 * Supabase connection details and app-level constants.
 *
 * The publishable key is designed to ship in client-side code — it identifies
 * the project, it does not authorise anything. Every access decision is made
 * by the Row Level Security policies in supabase/migrations/. Never put a
 * secret or service-role key in this file; it is served to every visitor.
 */
export const SUPABASE_URL = 'https://gwepxpyfgtgagceguyhm.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_WR2wLuKqw6C5Q3uqS8X5UA_z4FeINNy';

/** Mirrors public.admin_email() in the database. Display only — the database decides. */
export const ADMIN_EMAIL = 'noorhussam.nh@gmail.com';

export const APP_VERSION = 'v2.4';

/**
 * The workbook every figure traces back to. Set this to the Google Sheet URL
 * and the "SOURCE WORKBOOK ↗" pills throughout the app become live links.
 * Left null deliberately rather than pointed at a guess — a source link that
 * goes to the wrong document is worse than one that admits it is unset.
 */
export const SOURCE_WORKBOOK_URL = null;
