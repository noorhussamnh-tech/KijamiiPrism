/**
 * No client. Deliberately.
 *
 * In production this module creates the Supabase client and everything else
 * imports it from here. On the demonstration branch there is nothing to
 * create: the SDK is not fetched from the CDN, no project URL or key exists in
 * the source, and no object in this build is capable of making a request to a
 * database.
 *
 * The module is kept rather than deleted so that any import left over from a
 * merge fails loudly at the call site instead of silently resolving to
 * undefined and looking, for a moment, like it worked.
 */

const REFUSAL =
  'Agency Intelligence Prism (demo): there is no database client in this build. ' +
  'All figures come from js/demo/dataset.js.';

/**
 * A proxy that throws on any property access. `supabase.from(...)`,
 * `supabase.auth`, `supabase.channel(...)` — all of them stop here.
 */
export const supabase = new Proxy(
  {},
  {
    get(_target, property) {
      if (property === Symbol.toStringTag) return 'DisabledSupabaseClient';
      throw new Error(`${REFUSAL} (attempted: supabase.${String(property)})`);
    },
  },
);
