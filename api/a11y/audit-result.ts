/**
 * GET /api/a11y/audit-result?id=<auditRunId>
 *
 * Fetch a persisted audit run and its issues.
 *
 * Flow:
 *   1. authenticate(req)                       → 401/403 on failure
 *   2. validate ?id= query param               → 400 when missing
 *   3. getSupabaseAdmin(); if null             → 503 (backend not configured)
 *   4. read audit_runs (scoped to the caller); if not found → 404
 *   5. read audit_issues for that run
 *   6. 200 { run, issues } with Cache-Control: private, max-age=3600
 */

import { authenticate, AuthError } from "../lib/auth.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import { auditResultQuerySchema, errorResponse, jsonResponse } from "./_shared.js";

export const config = { runtime: "edge" };

async function handler(req: Request): Promise<Response> {
  if (req.method !== "GET") {
    return errorResponse(405, "Method not allowed. Use GET.");
  }

  // 1. Authenticate ──────────────────────────────────────────────────
  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, err.message);
    return errorResponse(401, "Authentication failed");
  }

  // 2. Validate query ────────────────────────────────────────────────
  const id = new URL(req.url).searchParams.get("id");
  const parsed = auditResultQuerySchema.safeParse({ id });
  if (!parsed.success) {
    return errorResponse(400, "An 'id' query parameter is required.");
  }
  const auditRunId = parsed.data.id;

  // 3. Backend must be configured to read persisted runs ─────────────
  const admin = getSupabaseAdmin();
  if (!admin) {
    return errorResponse(503, "Audit backend not configured");
  }

  // 4. Read the run, scoped to the authenticated user ────────────────
  const { data: run, error: runError } = await admin
    .from("audit_runs")
    .select("*")
    .eq("id", auditRunId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (runError) {
    return errorResponse(500, "Failed to read audit run.");
  }
  if (!run) {
    return errorResponse(404, "Audit run not found.");
  }

  // 5. Read the issues for that run ──────────────────────────────────
  const { data: issues, error: issuesError } = await admin
    .from("audit_issues")
    .select("*")
    .eq("audit_run_id", auditRunId);

  if (issuesError) {
    return errorResponse(500, "Failed to read audit issues.");
  }

  // 6. Respond (privately cacheable for an hour) ─────────────────────
  return jsonResponse(
    200,
    { run, issues: issues ?? [] },
    { "Cache-Control": "private, max-age=3600" },
  );
}

export default handler;
