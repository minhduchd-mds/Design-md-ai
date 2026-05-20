/**
 * get_design_tokens — Return design tokens (variables) from the loaded snapshot.
 *
 * Supports filtering by type (COLOR, FLOAT, STRING, BOOLEAN) and collection.
 */

import { z } from "zod";
import { getSnapshot } from "../store.js";

export const GET_DESIGN_TOKENS_SCHEMA = {
  name: "get_design_tokens",
  description:
    "List design tokens (variables) from the Figma design system. " +
    "Returns color tokens, spacing values, and other design variables. " +
    "Filter by type or collection name.",
  inputSchema: {
    type: "object" as const,
    properties: {
      type: {
        type: "string",
        enum: ["COLOR", "FLOAT", "STRING", "BOOLEAN"],
        description: "Filter by variable type. Omit for all types.",
      },
      collection: {
        type: "string",
        description: "Filter by collection name (case-insensitive substring match).",
      },
    },
  },
};

export const getDesignTokensInput = z.object({
  type: z.enum(["COLOR", "FLOAT", "STRING", "BOOLEAN"]).optional(),
  collection: z.string().optional(),
});

export function handleGetDesignTokens(args: z.infer<typeof getDesignTokensInput>) {
  const snapshot = getSnapshot();
  if (!snapshot) {
    return { content: [{ type: "text" as const, text: "No design system loaded. Use load_snapshot first." }] };
  }

  let variables = snapshot.variables;

  if (args.type) {
    variables = variables.filter((v) => v.resolvedType === args.type);
  }

  if (args.collection) {
    const query = args.collection.toLowerCase();
    variables = variables.filter((v) => v.collectionName.toLowerCase().includes(query));
  }

  const summary = `${variables.length} token(s) from "${snapshot.fileName}"`;
  const tokens = variables.map((v) => ({
    name: v.name,
    collection: v.collectionName,
    type: v.resolvedType,
    value: v.value,
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ summary, tokens }, null, 2) }],
  };
}
