/**
 * load_snapshot tool + store.loadSnapshotFromFile — unit tests.
 */

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { writeFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSnapshotFromFile, getSnapshot, setSnapshot } from "../store.js";
import { handleLoadSnapshot } from "../tools/loadSnapshot.js";
import type { DesignSnapshot } from "../types.js";

const TMP_DIR = join(tmpdir(), "desygn-mcp-test");
const VALID_SNAPSHOT: DesignSnapshot = {
  fileName: "Test.fig",
  pageName: "Page 1",
  pages: [{ id: "p1", name: "Page 1", componentCount: 0 }],
  components: [],
  variables: [
    { id: "v1", name: "color", collectionName: "C", modeName: "M", resolvedType: "COLOR", value: "#fff" },
  ],
};

async function writeTempFile(name: string, data: unknown): Promise<string> {
  await mkdir(TMP_DIR, { recursive: true });
  const path = join(TMP_DIR, name);
  await writeFile(path, JSON.stringify(data), "utf-8");
  return path;
}

const tempFiles: string[] = [];

afterAll(async () => {
  for (const f of tempFiles) {
    try { await unlink(f); } catch { /* ignore */ }
  }
});

describe("loadSnapshotFromFile", () => {
  it("loads a valid snapshot file", async () => {
    const path = await writeTempFile("valid.json", VALID_SNAPSHOT);
    tempFiles.push(path);

    const result = await loadSnapshotFromFile(path);
    expect(result.fileName).toBe("Test.fig");
    expect(result.variables).toHaveLength(1);
    expect(getSnapshot()).toBe(result);
  });

  it("rejects missing required fields", async () => {
    const path = await writeTempFile("invalid.json", { foo: "bar" });
    tempFiles.push(path);

    await expect(loadSnapshotFromFile(path)).rejects.toThrow("Invalid snapshot");
  });

  it("rejects non-existent file", async () => {
    await expect(loadSnapshotFromFile("/no/such/file.json")).rejects.toThrow();
  });
});

describe("handleLoadSnapshot", () => {
  beforeEach(() => {
    // Clear current snapshot
    setSnapshot({
      fileName: "(cleared)",
      pageName: "",
      pages: [],
      components: [],
      variables: [],
    });
  });

  it("returns loaded status on success", async () => {
    const path = await writeTempFile("tool-valid.json", VALID_SNAPSHOT);
    tempFiles.push(path);

    const result = await handleLoadSnapshot({ path });
    const parsed = JSON.parse(result.content[0].text) as { status: string; summary: Record<string, unknown> };
    expect(parsed.status).toBe("loaded");
    expect(parsed.summary.fileName).toBe("Test.fig");
    expect(parsed.summary.tokens).toBe(1);
  });

  it("returns error on invalid file", async () => {
    const result = await handleLoadSnapshot({ path: "/no/such/file.json" });
    expect(result.content[0].text).toContain("Failed to load snapshot");
    expect(result.isError).toBe(true);
  });

  it("returns error on invalid JSON structure", async () => {
    const path = await writeTempFile("tool-bad.json", { invalid: true });
    tempFiles.push(path);

    const result = await handleLoadSnapshot({ path });
    expect(result.content[0].text).toContain("Failed to load snapshot");
    expect(result.isError).toBe(true);
  });
});
