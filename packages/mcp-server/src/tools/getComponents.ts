/**
 * get_components — Return components from the loaded snapshot.
 *
 * Supports filtering by name, page, role, source, and type.
 */

import { z } from "zod";
import { getSnapshot } from "../store.js";

export const GET_COMPONENTS_SCHEMA = {
  name: "get_components",
  description:
    "List UI components from the Figma design system. " +
    "Returns component names, types, roles, and variant properties. " +
    "Filter by name, page, role, or source.",
  inputSchema: {
    type: "object" as const,
    properties: {
      name: {
        type: "string",
        description: "Filter by component name (case-insensitive substring match).",
      },
      page: {
        type: "string",
        description: "Filter by page name (case-insensitive substring match).",
      },
      role: {
        type: "string",
        enum: [
          "navigation", "kpi", "chart", "table", "form",
          "modal", "card", "list", "action", "content", "unknown",
        ],
        description: "Filter by component role.",
      },
      source: {
        type: "string",
        enum: ["local", "document", "library", "instance", "suggested"],
        description: "Filter by component source.",
      },
      type: {
        type: "string",
        enum: ["COMPONENT", "COMPONENT_SET"],
        description: "Filter by node type.",
      },
    },
  },
};

export const getComponentsInput = z.object({
  name: z.string().optional(),
  page: z.string().optional(),
  role: z
    .enum([
      "navigation", "kpi", "chart", "table", "form",
      "modal", "card", "list", "action", "content", "unknown",
    ])
    .optional(),
  source: z.enum(["local", "document", "library", "instance", "suggested"]).optional(),
  type: z.enum(["COMPONENT", "COMPONENT_SET"]).optional(),
});

export function handleGetComponents(args: z.infer<typeof getComponentsInput>) {
  const snapshot = getSnapshot();
  if (!snapshot) {
    return { content: [{ type: "text" as const, text: "No design system loaded. Use load_snapshot first." }] };
  }

  let components = snapshot.components;

  if (args.name) {
    const query = args.name.toLowerCase();
    components = components.filter((c) => c.name.toLowerCase().includes(query));
  }

  if (args.page) {
    const query = args.page.toLowerCase();
    components = components.filter((c) => c.pageName.toLowerCase().includes(query));
  }

  if (args.role) {
    components = components.filter((c) => c.role === args.role);
  }

  if (args.source) {
    components = components.filter((c) => c.source === args.source);
  }

  if (args.type) {
    components = components.filter((c) => c.type === args.type);
  }

  const summary = `${components.length} component(s) from "${snapshot.fileName}"`;
  const items = components.map((c) => ({
    name: c.name,
    type: c.type,
    page: c.pageName,
    role: c.role ?? "unknown",
    source: c.source ?? "local",
    description: c.description ?? "",
    variants: c.variantProperties ?? {},
  }));

  return {
    content: [{ type: "text" as const, text: JSON.stringify({ summary, components: items }, null, 2) }],
  };
}
