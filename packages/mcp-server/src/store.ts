/**
 * store — In-memory design system snapshot store.
 *
 * The MCP server loads a design system snapshot from a JSON file
 * (exported by the Figma plugin) and serves it via MCP tools.
 *
 * The snapshot can be updated at runtime via the `load_snapshot` tool
 * or by passing a file path at startup via --snapshot flag.
 */

import { readFile } from "node:fs/promises";
import type { DesignSnapshot } from "./types.js";

let currentSnapshot: DesignSnapshot | null = null;

export function getSnapshot(): DesignSnapshot | null {
  return currentSnapshot;
}

export function setSnapshot(snapshot: DesignSnapshot): void {
  currentSnapshot = snapshot;
}

export async function loadSnapshotFromFile(filePath: string): Promise<DesignSnapshot> {
  const raw = await readFile(filePath, "utf-8");
  const data = JSON.parse(raw) as DesignSnapshot;

  if (!data.fileName || !Array.isArray(data.components) || !Array.isArray(data.variables)) {
    throw new Error("Invalid snapshot: missing required fields (fileName, components, variables).");
  }

  currentSnapshot = data;
  return data;
}

export function createEmptySnapshot(): DesignSnapshot {
  return {
    fileName: "(no file loaded)",
    pageName: "",
    pages: [],
    components: [],
    variables: [],
  };
}
