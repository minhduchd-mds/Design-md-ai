/**
 * Example plugin: Acme Brand Checker
 *
 * Demonstrates the @desygn/sdk surface:
 *   - defineCriterion — declarative audit criteria
 *   - defineCheck — pure check logic
 *   - defineAgent — custom AI agent
 *   - definePlugin — full plugin manifest
 *
 * Run example check standalone:
 *   npx tsx sdk/examples/acme-brand-checker.ts
 */

import {
  defineAgent,
  defineCheck,
  defineCriterion,
  definePlugin,
} from "../helpers";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Define a criterion
// ─────────────────────────────────────────────────────────────────────────────

const brandSpacingCriterion = defineCriterion({
  id: "acme.brand-spacing",
  name: "Brand spacing scale (4/8/16)",
  description: "All spacing must be a multiple of 4 from the brand scale.",
  category: "tokens",
  severity: "medium",
  source: "custom",
  tags: ["brand", "spacing"],
});

const brandColorsCriterion = defineCriterion({
  id: "acme.brand-colors",
  name: "Brand color palette only",
  description: "Use only colors from the Acme brand palette.",
  category: "tokens",
  severity: "high",
  source: "custom",
  tags: ["brand", "color"],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Define a pure check function
// ─────────────────────────────────────────────────────────────────────────────

const ACME_SCALE = [0, 4, 8, 16, 24, 32, 48, 64];

const brandSpacingCheck = defineCheck({
  criterionId: "acme.brand-spacing",
  check: (designContext) => {
    const ctx = designContext as { tokens?: { spacing?: number[] } };
    const spacing = ctx.tokens?.spacing ?? [];
    const offScale = spacing.filter((s) => !ACME_SCALE.includes(s));

    return {
      checkId: "acme.brand-spacing",
      status: offScale.length === 0 ? "pass" : "fail",
      score: offScale.length === 0 ? 1 : Math.max(0, 1 - offScale.length / spacing.length),
      severity: "medium",
      confidence: 0.95,
      reason:
        offScale.length === 0
          ? "All spacing values match the Acme scale."
          : `${offScale.length} spacing values off-scale: ${offScale.join(", ")}`,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Define a custom AI agent (mocked — a real agent would call an LLM)
// ─────────────────────────────────────────────────────────────────────────────

const brandToneAgent = defineAgent({
  id: "acme.brand-tone",
  name: "Brand Tone Reviewer",
  role: "custom",
  description: "Checks UI copy against the Acme brand voice guidelines.",
  execute: async (input, ctx) => {
    ctx.logger.info("Running brand tone review", { auditRunId: input.auditRunId });

    // In a real plugin, call an LLM here. For the example we return a stub.
    return {
      success: true,
      output: {
        toneScore: 0.85,
        violations: [],
        suggestions: ["Replace 'submit' with 'save changes' for friendlier tone"],
      },
      costUsd: 0.002,
    };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Compose the plugin manifest
// ─────────────────────────────────────────────────────────────────────────────

export default definePlugin({
  id: "acme.brand-checker",
  name: "Acme Brand Checker",
  version: "1.0.0",
  description: "Audits designs against the Acme brand guidelines (spacing, colors, tone).",
  author: "Acme Corp",
  homepage: "https://acme.example.com/desygn-plugin",
  hostVersion: ">=5.0.0",
  permissions: ["audit:read", "audit:write"],
  contributes: {
    criteria: [brandSpacingCriterion, brandColorsCriterion],
    checks: [brandSpacingCheck],
    agents: [brandToneAgent],
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Standalone smoke test
// ─────────────────────────────────────────────────────────────────────────────

if (typeof process !== "undefined" && process.argv[1]?.includes("acme-brand-checker")) {
  // eslint-disable-next-line no-console
  console.log("=== Acme Brand Checker — Smoke Test ===");

  const result = brandSpacingCheck.check(
    { tokens: { spacing: [4, 8, 12, 16, 18, 32] } },
    {
      pluginId: "acme.brand-checker",
      projectId: "test-project",
      hostVersion: "5.0.0",
      // eslint-disable-next-line no-console
      logger: { debug: () => {}, info: console.log, warn: console.warn, error: console.error },
      storage: { get: async () => null, set: async () => {}, delete: async () => {} },
    },
  );

  // eslint-disable-next-line no-console
  console.log("Spacing check result:", result);
}
