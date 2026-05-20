/**
 * load_snapshot — Load a design system snapshot from a JSON file.
 *
 * The snapshot is exported by the Figma plugin and contains
 * components, design tokens (variables), and page metadata.
 */

import { z } from "zod";
import { loadSnapshotFromFile } from "../store.js";

export const LOAD_SNAPSHOT_SCHEMA = {
  name: "load_snapshot",
  description:
    "Load a Figma design system snapshot from a local JSON file. " +
    "The file should be exported by the Desygn AI Figma plugin. " +
    "Once loaded, other tools can query components and tokens.",
  inputSchema: {
    type: "object" as const,
    properties: {
      path: {
        type: "string",
        description: "Absolute path to the design snapshot JSON file.",
      },
    },
    required: ["path"],
  },
};

export const loadSnapshotInput = z.object({
  path: z.string(),
});

export async function handleLoadSnapshot(args: z.infer<typeof loadSnapshotInput>) {
  try {
    const snapshot = await loadSnapshotFromFile(args.path);

    const summary = {
      fileName: snapshot.fileName,
      pageName: snapshot.pageName,
      pages: snapshot.pages.length,
      components: snapshot.components.length,
      tokens: snapshot.variables.length,
    };

    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          status: "loaded",
          summary,
        }, null, 2),
      }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Failed to load snapshot: ${message}` }],
      isError: true,
    };
  }
}
