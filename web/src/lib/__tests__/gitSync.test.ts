import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitSyncEngine, createGitSync } from "../gitSync";

describe("GitSyncEngine", () => {
  let engine: GitSyncEngine;

  beforeEach(() => {
    engine = new GitSyncEngine();
    vi.restoreAllMocks();
  });

  describe("configure", () => {
    it("marks engine as configured", () => {
      engine.configure({ owner: "test", repo: "repo", token: "ghp_xxx" });
      expect(engine.isConfigured()).toBe(true);
    });

    it("not configured without token", () => {
      expect(engine.isConfigured()).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("returns unconfigured status by default", () => {
      const status = engine.getStatus();
      expect(status.configured).toBe(false);
      expect(status.lastSync).toBeNull();
      expect(status.pendingChanges).toBe(0);
    });

    it("returns configured status after configure", () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });
      const status = engine.getStatus();
      expect(status.configured).toBe(true);
    });
  });

  describe("stageFiles", () => {
    it("stages files and updates pending count", () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });
      engine.stageFiles([
        { path: "src/test.ts", content: "console.log('hi')", operation: "create" },
        { path: "src/old.ts", content: "", operation: "delete" },
      ]);
      expect(engine.getStatus().pendingChanges).toBe(2);
    });

    it("clearStaged removes all pending files", () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });
      engine.stageFiles([{ path: "a.ts", content: "x", operation: "create" }]);
      engine.clearStaged();
      expect(engine.getStatus().pendingChanges).toBe(0);
    });
  });

  describe("commitFiles", () => {
    it("throws if no files staged", async () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });
      await expect(engine.commitFiles("feat/test", "test commit")).rejects.toThrow("No files to commit");
    });

    it("commits files via GitHub API", async () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });

      const fetchMock = vi.fn()
        // Get branch ref
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ object: { sha: "abc123" } }),
          headers: new Map(),
        })
        // Get base commit
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ tree: { sha: "tree123" } }),
          headers: new Map(),
        })
        // Create blob
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sha: "blob123" }),
          headers: new Map(),
        })
        // Create tree
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sha: "newtree123" }),
          headers: new Map(),
        })
        // Create commit
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ sha: "commit123", html_url: "https://github.com/org/app/commit/commit123" }),
          headers: new Map(),
        })
        // Update ref
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({}),
          headers: new Map(),
        });

      vi.stubGlobal("fetch", fetchMock);

      engine.stageFiles([{ path: "src/new.ts", content: "export const x = 1;", operation: "create" }]);
      const result = await engine.commitFiles("feat/test", "add new file");

      expect(result.sha).toBe("commit123");
      expect(result.message).toBe("add new file");
      expect(engine.getStatus().pendingChanges).toBe(0);
    });
  });

  describe("createBranch", () => {
    it("creates branch via API", async () => {
      engine.configure({ owner: "org", repo: "app", token: "ghp_123" });

      const fetchMock = vi.fn()
        // Get base branch SHA
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ object: { sha: "main_sha" } }),
          headers: new Map(),
        })
        // Create ref
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ ref: "refs/heads/feat/new", object: { sha: "main_sha" } }),
          headers: new Map(),
        });

      vi.stubGlobal("fetch", fetchMock);

      const sha = await engine.createBranch("feat/new");
      expect(sha).toBe("main_sha");
    });
  });

  describe("error handling", () => {
    it("throws on unconfigured engine", async () => {
      await expect(engine.listBranches()).rejects.toThrow("not configured");
    });

    it("throws on 403 without retry", async () => {
      engine.configure({ owner: "org", repo: "app", token: "bad_token" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: () => Promise.resolve("Forbidden"),
        headers: new Map(),
      }));

      await expect(engine.listBranches()).rejects.toThrow("403");
    });
  });

  describe("factory", () => {
    it("creates engine without config", () => {
      const e = createGitSync();
      expect(e.isConfigured()).toBe(false);
    });

    it("creates engine with config", () => {
      const e = createGitSync({ owner: "x", repo: "y", token: "ghp_z" });
      expect(e.isConfigured()).toBe(true);
    });
  });
});
