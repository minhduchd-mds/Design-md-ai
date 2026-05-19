/**
 * sdk/helpers.ts — Public SDK Helpers
 *
 * Identity-style `define*` functions that provide type inference and runtime
 * validation for plugin authors. The host loader can introspect these objects
 * to register the plugin's contributions.
 *
 * @example
 * ```ts
 * import { defineCriterion, defineAgent, definePlugin } from "@desygn/sdk";
 *
 * const myCriterion = defineCriterion({
 *   id: "acme.brand-spacing",
 *   name: "Brand spacing scale",
 *   category: "tokens",
 *   severity: "medium",
 *   description: "Spacing must follow the brand 4/8/16 scale",
 * });
 *
 * export default definePlugin({
 *   id: "acme.brand-checker",
 *   name: "Acme Brand Checker",
 *   version: "1.0.0",
 *   description: "Checks designs against the Acme brand guidelines",
 *   author: "Acme Corp",
 *   contributes: { criteria: [myCriterion] },
 * });
 * ```
 */

import { ChecklistCriterionSchema } from "../shared/schemas/index";
import type {
  CustomAgent,
  CustomCheck,
  CustomCriterion,
  PluginManifest,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════════
// defineCriterion — Identity function with runtime schema validation
// ═══════════════════════════════════════════════════════════════════════════════

export function defineCriterion(criterion: CustomCriterion): CustomCriterion {
  // Validate the criterion shape at definition time so plugin authors get
  // immediate feedback instead of failing at registration.
  const { check: _check, ...validatable } = criterion;
  const parsed = ChecklistCriterionSchema.safeParse(validatable);
  if (!parsed.success) {
    const issues = (parsed.error.issues ?? [])
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid criterion "${criterion.id}": ${issues}`);
  }
  return criterion;
}

// ═══════════════════════════════════════════════════════════════════════════════
// defineCheck — Bind a check function to a criterion
// ═══════════════════════════════════════════════════════════════════════════════

export function defineCheck(check: CustomCheck): CustomCheck {
  if (!check.criterionId) {
    throw new Error("defineCheck: criterionId is required");
  }
  if (typeof check.check !== "function") {
    throw new Error(`defineCheck (${check.criterionId}): check must be a function`);
  }
  return check;
}

// ═══════════════════════════════════════════════════════════════════════════════
// defineAgent — Validate and return an agent definition
// ═══════════════════════════════════════════════════════════════════════════════

export function defineAgent(agent: CustomAgent): CustomAgent {
  if (!agent.id || typeof agent.id !== "string") {
    throw new Error("defineAgent: id is required");
  }
  if (!agent.id.includes(".")) {
    throw new Error(
      `defineAgent (${agent.id}): id must be namespaced (e.g., "myorg.my-agent")`,
    );
  }
  if (typeof agent.execute !== "function") {
    throw new Error(`defineAgent (${agent.id}): execute must be a function`);
  }
  return agent;
}

// ═══════════════════════════════════════════════════════════════════════════════
// definePlugin — Validate the full plugin manifest
// ═══════════════════════════════════════════════════════════════════════════════

const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+].+)?$/;

export function definePlugin(plugin: PluginManifest): PluginManifest {
  if (!plugin.id || !plugin.id.includes(".")) {
    throw new Error(`definePlugin: id must be namespaced (got "${plugin.id}")`);
  }
  if (!SEMVER_RE.test(plugin.version)) {
    throw new Error(
      `definePlugin (${plugin.id}): version must be valid semver (got "${plugin.version}")`,
    );
  }
  if (!plugin.contributes || typeof plugin.contributes !== "object") {
    throw new Error(`definePlugin (${plugin.id}): contributes is required`);
  }
  // Validate nested contributions
  for (const c of plugin.contributes.criteria ?? []) defineCriterion(c);
  for (const a of plugin.contributes.agents ?? []) defineAgent(a);
  for (const ch of plugin.contributes.checks ?? []) defineCheck(ch);
  return plugin;
}
