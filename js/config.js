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
 * The workbook every figure traces back to. The "SOURCE WORKBOOK ↗" pills
 * throughout the app link here, so any number on screen can be checked
 * against the row it came from.
 *
 * Opening it still requires Google access — the link is a pointer, not a
 * bypass. Anyone without permission on the Sheet sees Google's own request
 * screen, which is the correct outcome.
 */
export const SOURCE_WORKBOOK_URL =
  'https://docs.google.com/spreadsheets/d/1OD0gmT-LI8rHxKBQEfVFUmnY3D4noSwEKz1ia5TqRLY/edit';
