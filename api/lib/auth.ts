/**
 * auth — Authentication for Desygn A11y API routes.
 *
 * Two credential types:
 *   1. Supabase JWT  — `Authorization: Bearer eyJ...` (verified locally via JWKS)
 *   2. API key       — `Authorization: Bearer dak_live_...` / `dak_test_...`
 *                      (SHA-256 hashed, looked up in the api_keys table)
 *
 * The token-routing + hashing logic is split into pure functions so it can
 * be unit-tested without network or a configured backend. The actual JWKS
 * verification and DB lookup live in `authenticate()`.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { getSupabaseAdmin } from "./supabase-admin.js";

export type Tier = "free" | "pro" | "team" | "enterprise";

export interface AuthContext {
  type: "user" | "api_key";
  userId: string;
  tier: Tier;
  /** Present only for API-key auth. */
  keyId?: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export const API_KEY_PREFIXES = ["dak_live_", "dak_test_"] as const;

// ─── Pure helpers (unit-tested) ──────────────────────────────────────

/** Parse an Authorization header into scheme + token. Throws on malformed input. */
export function parseAuthHeader(header: string | null | undefined): { scheme: string; token: string } {
  if (!header) throw new AuthError("Missing Authorization header");
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2) throw new AuthError("Malformed Authorization header");
  const [scheme, token] = parts;
  if (scheme.toLowerCase() !== "bearer") throw new AuthError("Unsupported auth scheme");
  if (!token) throw new AuthError("Empty bearer token");
  return { scheme, token };
}

/** Classify a bearer token by shape — no verification. */
export function classifyToken(token: string): "supabase-jwt" | "api-key" | "unknown" {
  if (API_KEY_PREFIXES.some((p) => token.startsWith(p))) return "api-key";
  // Supabase access tokens are JWTs: three base64url segments starting "eyJ".
  if (token.startsWith("eyJ") && token.split(".").length === 3) return "supabase-jwt";
  return "unknown";
}

/** Normalize an app_metadata.tier claim to a known Tier (defaults to "free"). */
export function normalizeTier(value: unknown): Tier {
  return value === "pro" || value === "team" || value === "enterprise" ? value : "free";
}

/** SHA-256 hex digest of an API key (Web Crypto — works in Edge + Node 18+). */
export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── JWKS (lazy) ─────────────────────────────────────────────────────

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new AuthError("SUPABASE_URL not configured", 401);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${url}/auth/v1/keys`));
  }
  return jwks;
}

/** Test-only: reset the memoized JWKS. */
export function __resetJwksForTests(): void {
  jwks = null;
}

// ─── Main entry ──────────────────────────────────────────────────────

/**
 * Authenticate a request. Returns the auth context, or throws AuthError.
 * Accepts a Web `Request` or anything with a `.headers.get()` method.
 */
export async function authenticate(req: {
  headers: { get(name: string): string | null };
}): Promise<AuthContext> {
  const { token } = parseAuthHeader(req.headers.get("authorization"));
  const kind = classifyToken(token);

  if (kind === "supabase-jwt") {
    const { payload } = await jwtVerify(token, getJwks(), { audience: "authenticated" }).catch(
      () => {
        throw new AuthError("Invalid or expired token");
      },
    );
    if (!payload.sub) throw new AuthError("Token missing subject");
    const appMeta = (payload as { app_metadata?: { tier?: unknown } }).app_metadata;
    return { type: "user", userId: payload.sub, tier: normalizeTier(appMeta?.tier) };
  }

  if (kind === "api-key") {
    const admin = getSupabaseAdmin();
    if (!admin) throw new AuthError("Auth backend not configured", 401);

    const hash = await hashApiKey(token);
    const { data, error } = await admin
      .from("api_keys")
      .select("id, user_id, revoked_at, expires_at")
      .eq("key_hash", hash)
      .is("revoked_at", null)
      .single();

    if (error || !data) throw new AuthError("Invalid API key");
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      throw new AuthError("API key expired");
    }

    const tier = await getUserTier(data.user_id);
    return { type: "api_key", userId: data.user_id, tier, keyId: data.id };
  }

  throw new AuthError("Unrecognized token format");
}

/** Look up a user's current tier from active subscriptions (defaults to "free"). */
export async function getUserTier(userId: string): Promise<Tier> {
  const admin = getSupabaseAdmin();
  if (!admin) return "free";
  const { data } = await admin
    .from("subscriptions")
    .select("tier, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return normalizeTier(data?.tier);
}
