/**
 * The one and only Supabase client.
 *
 * This is the single module that imports from the CDN — everything else
 * imports `supabase` from here. Changing CDN or pinning a new version is
 * therefore a one-line edit.
 *
 * The version is pinned deliberately. An unpinned `@2` lets a CDN release
 * change behaviour on a page reload with no commit on our side.
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.58.0/+esm';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './config.js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'pkce',
    // Email confirmation links come back as `?code=...` on the query string.
    // This must stay on for them to establish a session. It does not collide
    // with our hash-based router, which only reads `location.hash`.
    detectSessionInUrl: true,
  },
});
