/**
 * get_design_summary — Return a high-level overview of the loaded design system.
 *
 * Includes file name, page list, component/token counts, and breakdowns.
 */

import { getSnapshot } from "../store.js";

export const GET_DESIGN_SUMMARY_SCHEMA = {
  name: "get_design_summary",
  description:
    "Get a high-level overview of the loaded Figma design system. " +
    "Returns file name, pages, component count, token count, " +
    "role distribution, and variable type breakdown.",
  inputSchema: {
    type: "object" as const,
    properties: {},
  },
};

export function handleGetDesignSummary() {
  const snapshot = getSnapshot();
  if (!snapshot) {
    return { content: [{ type: "text" as const, text: "No design system loaded. Use load_snapshot first." }] };
  }

  // Role distribution
  const roleMap = new Map<string, number>();
  for (const c of snapshot.components) {
    const role = c.role ?? "unknown";
    roleMap.set(role, (roleMap.get(role) ?? 0) + 1);
  }

  // Variable type distribution
  const varTypeMap = new Map<string, number>();
  for (const v of snapshot.variables) {
    varTypeMap.set(v.resolvedType, (varTypeMap.get(v.resolvedType) ?? 0) + 1);
  }

  // Collection list
  const collections = new Set<string>();
  for (const v of snapshot.variables) {
    collections.add(v.collectionName);
  }

  const summary = {
    fileName: snapshot.fileName,
    pageName: snapshot.pageName,
    pages: snapshot.pages.map((p) => ({ name: p.name, componentCount: p.componentCount })),
    totalComponents: snapshot.components.length,
    totalTokens: snapshot.variables.length,
    roleDistribution: Object.fromEntries(roleMap),
    variableTypes: Object.fromEntries(varTypeMap),
    collections: [...collections],
  };

  return {
    content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
  };
}
