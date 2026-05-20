/**
 * match_component — Find the best matching component for a UI requirement.
 *
 * Performs fuzzy name matching and role-based filtering to suggest
 * the most appropriate component from the design system.
 */

import { z } from "zod";
import { getSnapshot } from "../store.js";
import type { DesignComponent } from "../types.js";

export const MATCH_COMPONENT_SCHEMA = {
  name: "match_component",
  description:
    "Find the best matching component for a UI requirement. " +
    "Provide a description of what you need (e.g. 'primary button', 'data table', 'navigation bar') " +
    "and optionally a role. Returns ranked matches with similarity scores.",
  inputSchema: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "Natural-language description of the needed UI element.",
      },
      role: {
        type: "string",
        enum: [
          "navigation", "kpi", "chart", "table", "form",
          "modal", "card", "list", "action", "content", "unknown",
        ],
        description: "Preferred component role (optional).",
      },
      limit: {
        type: "number",
        description: "Maximum number of results (default 5, max 20).",
      },
    },
    required: ["query"],
  },
};

export const matchComponentInput = z.object({
  query: z.string(),
  role: z
    .enum([
      "navigation", "kpi", "chart", "table", "form",
      "modal", "card", "list", "action", "content", "unknown",
    ])
    .optional(),
  limit: z.number().min(1).max(20).optional(),
});

/** Simple token-based similarity: Jaccard index over lowercased word tokens. */
function tokenSimilarity(a: string, b: string): number {
  const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/));
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  return intersection / (setA.size + setB.size - intersection);
}

/** Substring containment bonus (either direction). */
function substringBonus(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 0.4;
  if (q.includes(t)) return 0.2;
  return 0;
}

function scoreComponent(query: string, comp: DesignComponent, preferredRole?: string): number {
  let score = 0;

  // Name similarity
  score += tokenSimilarity(query, comp.name) * 0.5;
  score += substringBonus(query, comp.name) * 0.5;

  // Description similarity
  if (comp.description) {
    score += tokenSimilarity(query, comp.description) * 0.3;
  }

  // Role match bonus
  if (preferredRole && comp.role === preferredRole) {
    score += 0.2;
  }

  // Role keyword in query bonus
  if (comp.role && comp.role !== "unknown") {
    if (query.toLowerCase().includes(comp.role)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1);
}

export function handleMatchComponent(args: z.infer<typeof matchComponentInput>) {
  const snapshot = getSnapshot();
  if (!snapshot) {
    return { content: [{ type: "text" as const, text: "No design system loaded. Use load_snapshot first." }] };
  }

  const limit = args.limit ?? 5;

  const scored = snapshot.components
    .map((c) => ({ component: c, score: scoreComponent(args.query, c, args.role) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (scored.length === 0) {
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          summary: `No matching components found for "${args.query}" in "${snapshot.fileName}"`,
          matches: [],
        }, null, 2),
      }],
    };
  }

  const matches = scored.map((s) => ({
    name: s.component.name,
    score: Math.round(s.score * 100) / 100,
    type: s.component.type,
    page: s.component.pageName,
    role: s.component.role ?? "unknown",
    description: s.component.description ?? "",
    variants: s.component.variantProperties ?? {},
  }));

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        summary: `${matches.length} match(es) for "${args.query}" in "${snapshot.fileName}"`,
        matches,
      }, null, 2),
    }],
  };
}
