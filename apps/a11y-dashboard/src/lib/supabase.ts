/**
 * supabase — memoized browser Supabase client for the A11y dashboard.
 *
 * The client is created lazily from Vite env vars and cached for the life of
 * the tab. When either env var is missing (e.g. local dev without a backend,
 * CI, or the e2e harness) `getSupabaseClient()` returns `null` so the app can
 * degrade gracefully rather than crash. Call `isSupabaseConfigured()` to branch
 * UI/routing on backend availability.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** True when both the Supabase URL and anon key are present and non-empty. */
export function isSupabaseConfigured(): boolean {
  return (
    typeof url === "string" &&
    url.length > 0 &&
    typeof anonKey === "string" &&
    anonKey.length > 0
  );
}

// Memoize across calls. `undefined` = not yet resolved, `null` = unconfigured.
let cached: SupabaseClient | null | undefined;

/**
 * Return the singleton browser Supabase client, or `null` when env vars are
 * unset. The result is memoized so repeated calls (e.g. from AuthProvider and
 * route loaders) share one client and one realtime/auth connection.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  if (!isSupabaseConfigured()) {
    cached = null;
    return cached;
  }

  cached = createClient(url as string, anonKey as string, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}
