/**
 * _shared — Pure, testable helpers for the Desygn A11y audit endpoints.
 *
 * Keeps zod schemas and response builders out of the handler files so they
 * can be unit-tested without spinning up the Edge runtime, the audit engine,
 * or any backing store. Endpoints import everything they need from here.
 *
 * Default WCAG target across the product is 2.2 AA.
 */

import { z } from "zod";
import type { AuditNode, AuditOptions } from "@desygn/audit-engine";

// ─── Constants ───────────────────────────────────────────────────────

export const DEFAULT_WCAG_VERSION = "2.2" as const;
export const DEFAULT_WCAG_LEVEL = "AA" as const;

// ─── Zod schemas ─────────────────────────────────────────────────────

const wcagVersionSchema = z.enum(["2.0", "2.1", "2.2", "3.0"]);
const wcagLevelSchema = z.enum(["A", "AA", "AAA"]);

/**
 * AuditNode validator.
 *
 * `children` is recursive, so the schema is declared with an explicit
 * z.ZodType annotation and `z.lazy()` to break the self-reference. Only the
 * fields the engine actually reads are validated; unknown keys are stripped
 * (zod objects are strict-by-omission — extra keys are dropped on parse).
 */
export const auditNodeSchema: z.ZodType<AuditNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    pageName: z.string().optional(),
    contrastRatio: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    touchTargetCompliant: z.boolean().optional(),
    inferredRole: z.string().optional(),
    hasInteractions: z.boolean().optional(),
    headingLevel: z.number().int().min(1).max(6).optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    fontWeight: z.number().optional(),
    hasMotion: z.boolean().optional(),
    responsiveBehavior: z.enum(["fixed", "fill", "hug"]).optional(),
    children: z.array(auditNodeSchema).optional(),
  }),
);

/** Audit options (all optional — sensible WCAG 2.2 AA defaults applied later). */
export const auditOptionsSchema = z.object({
  wcagVersion: wcagVersionSchema.optional(),
  wcagLevel: wcagLevelSchema.optional(),
  rules: z.array(z.string()).optional(),
  includeAiSuggestions: z.boolean().optional(),
});

/** Figma source credentials. */
export const figmaSourceSchema = z.object({
  fileKey: z.string().min(1),
  nodeId: z.string().optional(),
  accessToken: z.string().min(1),
});

/**
 * Request body for POST /api/a11y/audit-start.
 *
 * `.superRefine` enforces that the fields required by the chosen `source`
 * are actually present, so handlers never have to re-check.
 */
export const auditStartSchema = z
  .object({
    source: z.enum(["figma", "uploaded-json"]),
    figma: figmaSourceSchema.optional(),
    nodes: z.array(auditNodeSchema).optional(),
    options: auditOptionsSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.source === "figma" && !val.figma) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "figma credentials are required when source is 'figma'",
        path: ["figma"],
      });
    }
    if (val.source === "uploaded-json") {
      if (!val.nodes || val.nodes.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "nodes are required when source is 'uploaded-json'",
          path: ["nodes"],
        });
      }
    }
  });

export type AuditStartBody = z.infer<typeof auditStartSchema>;

/** Query params for GET /api/a11y/audit-result. */
export const auditResultQuerySchema = z.object({
  id: z.string().min(1, "id query parameter is required"),
});

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Merge client-supplied options with the product defaults (WCAG 2.2 AA).
 * Returns an AuditOptions safe to hand straight to the engine.
 */
export function resolveAuditOptions(options?: AuditStartBody["options"]): AuditOptions {
  return {
    wcagVersion: options?.wcagVersion ?? DEFAULT_WCAG_VERSION,
    wcagLevel: options?.wcagLevel ?? DEFAULT_WCAG_LEVEL,
    ...(options?.rules ? { rules: options.rules } : {}),
    ...(options?.includeAiSuggestions !== undefined
      ? { includeAiSuggestions: options.includeAiSuggestions }
      : {}),
  };
}

/** Build a JSON Response with a status, body, and optional extra headers. */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

/** Standard error-shaped JSON response: `{ error }` plus any extra fields. */
export function errorResponse(
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
): Response {
  return jsonResponse(status, { error: message, ...extra });
}

/**
 * Format a zod error into a flat, client-safe list of `path: message` strings.
 * Never leaks internal stack traces.
 */
export function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
