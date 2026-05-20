/**
 * POST /api/a11y/audit-start
 *
 * Run a synchronous WCAG accessibility audit and persist the result.
 *
 * Flow:
 *   1. authenticate(req)                         → 401/403 on failure
 *   2. checkQuota(userId, tier, "audit")         → 402 when exhausted
 *   3. validate body with auditStartSchema       → 400 on bad input
 *   4. resolve nodes (Figma REST fetch or uploaded JSON)
 *   5. createDefaultEngine().run({ nodes, options })  (synchronous)
 *   6. persist to audit_runs + audit_issues (skipped when backend unset)
 *   7. recordUsage(userId, "audit")
 *   8. 200 { auditRunId, score, summary, status: "completed" }
 *
 * Default WCAG target: 2.2 AA (see _shared.resolveAuditOptions).
 */

import { createDefaultEngine } from "@desygn/audit-engine";
import type { AuditNode } from "@desygn/audit-engine";
import { FigmaRestClient, transformFigmaToAuditNodes } from "@desygn/figma-rest-adapter";
import { authenticate, AuthError } from "../lib/auth.js";
import { checkQuota, recordUsage } from "../lib/quota.js";
import { getSupabaseAdmin } from "../lib/supabase-admin.js";
import {
  auditStartSchema,
  errorResponse,
  formatZodError,
  jsonResponse,
  resolveAuditOptions,
} from "./_shared.js";

export const config = { runtime: "edge", maxDuration: 60 };

async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "Method not allowed. Use POST.");
  }

  // 1. Authenticate ──────────────────────────────────────────────────
  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) return errorResponse(err.status, err.message);
    return errorResponse(401, "Authentication failed");
  }

  // 2. Quota (write action) ──────────────────────────────────────────
  const quota = await checkQuota(auth.userId, auth.tier, "audit");
  if (!quota.allowed) {
    return errorResponse(402, "Audit quota exceeded for your plan.", {
      remaining: 0,
      resetAt: quota.resetAt.toISOString(),
    });
  }

  // 3. Parse + validate body ─────────────────────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse(400, "Invalid JSON body.");
  }

  const parsed = auditStartSchema.safeParse(raw);
  if (!parsed.success) {
    return errorResponse(400, "Invalid request body.", {
      details: formatZodError(parsed.error),
    });
  }
  const body = parsed.data;

  // 4. Resolve audit nodes ───────────────────────────────────────────
  let nodes: AuditNode[];
  try {
    if (body.source === "figma") {
      // superRefine guarantees body.figma is present for source === "figma".
      const { fileKey, nodeId, accessToken } = body.figma!;
      const client = new FigmaRestClient(accessToken);
      const file = await client.getFile(fileKey, nodeId ? [nodeId] : undefined);
      nodes = transformFigmaToAuditNodes(file.document);
    } else {
      // source === "uploaded-json" — superRefine guarantees nodes present.
      nodes = body.nodes!;
    }
  } catch (err) {
    // Figma fetch / transform failure — surface as a 502 (upstream error).
    const message = err instanceof Error ? err.message : "Failed to load design source.";
    return errorResponse(502, `Could not load design source: ${message}`);
  }

  if (nodes.length === 0) {
    return errorResponse(400, "No auditable nodes were found in the provided source.");
  }

  // 5. Run the audit synchronously ───────────────────────────────────
  const options = resolveAuditOptions(body.options);
  let result;
  try {
    result = await createDefaultEngine().run({ nodes, options });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Audit engine error.";
    return errorResponse(500, `Audit failed: ${message}`);
  }

  // 6. Persist (graceful degrade when backend unconfigured) ──────────
  const auditRunId = result.id;
  const admin = getSupabaseAdmin();
  if (admin) {
    try {
      await admin.from("audit_runs").insert({
        id: auditRunId,
        user_id: auth.userId,
        source: body.source,
        figma_file_key: body.source === "figma" ? body.figma!.fileKey : null,
        figma_node_id: body.source === "figma" ? (body.figma!.nodeId ?? null) : null,
        score: result.score,
        wcag_version: result.wcagVersion,
        wcag_level: result.wcagLevel,
        node_count: result.nodeCount,
        summary: result.summary,
        duration_ms: result.durationMs,
        status: "completed",
      });

      if (result.issues.length > 0) {
        await admin.from("audit_issues").insert(
          result.issues.map((issue) => ({
            audit_run_id: auditRunId,
            rule_id: issue.ruleId,
            wcag_criterion: issue.wcagCriterion,
            category: issue.category,
            severity: issue.severity,
            node_id: issue.nodeId,
            node_name: issue.nodeName,
            node_type: issue.nodeType,
            page_name: issue.pageName ?? null,
            message: issue.message,
            expected: issue.expected ?? null,
            observed: issue.observed ?? null,
            fix_suggestion: issue.fixSuggestion ?? null,
          })),
        );
      }
    } catch (err) {
      // Persistence failure must not lose the audit result — log + continue.
      console.error("[audit-start] persistence failed:", err instanceof Error ? err.message : err);
    }
  }

  // 7. Record usage (no-op when backend unconfigured) ────────────────
  await recordUsage(auth.userId, "audit", { auditRunId, source: body.source });

  // 8. Respond ───────────────────────────────────────────────────────
  return jsonResponse(200, {
    auditRunId,
    score: result.score,
    summary: result.summary,
    status: "completed",
  });
}

export default handler;
