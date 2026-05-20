/**
 * supabase-admin — Lazy service-role Supabase client for server routes.
 *
 * Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from the environment.
 * Returns null when either is missing so callers can degrade gracefully
 * (mirrors the pattern in rate-limit.ts). The service-role key bypasses
 * RLS — only ever use this on the server, never expose to the client.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

/**
 * Returns a memoized service-role client, or null if env vars are absent.
 * Callers MUST handle the null case (treat as "backend not configured").
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  if (!adminClient) {
    adminClient = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return adminClient;
}

/** True when the service-role backend is configured. */
export function isSupabaseConfigured(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Test-only: reset the memoized client (used by unit tests). */
export function __resetSupabaseAdminForTests(): void {
  adminClient = null;
}
