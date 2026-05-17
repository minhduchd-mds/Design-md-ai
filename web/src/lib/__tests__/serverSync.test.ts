import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ServerSyncEngine, createServerSync } from "../serverSync";

describe("ServerSyncEngine", () => {
  let engine: ServerSyncEngine;

  beforeEach(() => {
    engine = new ServerSyncEngine();
    vi.restoreAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    engine.stopAutoSync();
    vi.useRealTimers();
  });

  describe("configure", () => {
    it("accepts server config", () => {
      engine.configure({ serverUrl: "https://api.desygn.ai", authToken: "tok_123" });
      const status = engine.getStatus();
      expect(status.state).toBe("idle");
    });
  });

  describe("getStatus", () => {
    it("returns idle status by default", () => {
      const status = engine.getStatus();
      expect(status.state).toBe("idle");
      expect(status.lastSyncAt).toBeNull();
      expect(status.pendingPush).toBe(0);
      expect(status.conflicts).toBe(0);
    });
  });

  describe("queuePush", () => {
    it("queues records and updates pending count", () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      engine.queuePush([
        { id: "1", collection: "memories", data: { text: "hello" }, version: 1, updatedAt: Date.now() },
        { id: "2", collection: "memories", data: { text: "world" }, version: 1, updatedAt: Date.now() },
      ]);
      expect(engine.getStatus().pendingPush).toBe(2);
    });
  });

  describe("pushMemories", () => {
    it("throws if not configured", async () => {
      await expect(engine.pushMemories()).rejects.toThrow("not configured");
    });

    it("returns 0 pushed when queue empty", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      const result = await engine.pushMemories();
      expect(result.pushed).toBe(0);
      expect(result.failed).toBe(0);
    });

    it("pushes records to server", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accepted: 2, conflicts: [] }),
      }));

      engine.queuePush([
        { id: "1", collection: "mem", data: { x: 1 }, version: 1, updatedAt: 1000 },
        { id: "2", collection: "mem", data: { x: 2 }, version: 1, updatedAt: 2000 },
      ]);

      const result = await engine.pushMemories();
      expect(result.pushed).toBe(2);
      expect(result.failed).toBe(0);
      expect(engine.getStatus().pendingPush).toBe(0);
    });

    it("handles server conflict response", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      engine.setConflictStrategy("manual");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accepted: 0,
          conflicts: [{ id: "1", remote: { id: "1", collection: "mem", data: { x: 99 }, version: 3, updatedAt: 5000 } }],
        }),
      }));

      engine.queuePush([
        { id: "1", collection: "mem", data: { x: 1 }, version: 1, updatedAt: 1000 },
      ]);

      await engine.pushMemories();
      expect(engine.getConflicts().length).toBe(1);
      expect(engine.getStatus().conflicts).toBe(1);
    });
  });

  describe("pullMemories", () => {
    it("throws if not configured", async () => {
      await expect(engine.pullMemories()).rejects.toThrow("not configured");
    });

    it("fetches records from server", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          records: [
            { id: "r1", collection: "mem", data: { y: 1 }, version: 2, updatedAt: 3000 },
          ],
          cursor: undefined,
          hasMore: false,
        }),
      }));

      const records = await engine.pullMemories();
      expect(records.length).toBe(1);
      expect(records[0].id).toBe("r1");
    });
  });

  describe("conflict resolution", () => {
    it("resolves conflict with local-wins", () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      engine.setConflictStrategy("manual");

      // Manually inject conflict for testing
      const local = { id: "c1", collection: "mem", data: { val: "local" }, version: 2, updatedAt: 2000 };
      const remote = { id: "c1", collection: "mem", data: { val: "remote" }, version: 3, updatedAt: 3000 };

      // Use queuePush + mock to create a conflict
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ accepted: 0, conflicts: [{ id: "c1", remote }] }),
      }));

      engine.queuePush([local]);
      engine.pushMemories().then(() => {
        engine.resolveConflict("c1", "local");
        expect(engine.getConflicts().length).toBe(0);
      });
    });

    it("resolveAllConflicts with LWW picks newer", () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      engine.setConflictStrategy("manual");

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          accepted: 0,
          conflicts: [{ id: "c2", remote: { id: "c2", collection: "m", data: { v: "new" }, version: 5, updatedAt: 9999 } }],
        }),
      }));

      engine.queuePush([{ id: "c2", collection: "m", data: { v: "old" }, version: 1, updatedAt: 1000 }]);
      engine.pushMemories().then(() => {
        engine.resolveAllConflicts("lww");
        expect(engine.getConflicts().length).toBe(0);
      });
    });
  });

  describe("autoSync", () => {
    it("starts and stops auto sync timer", () => {
      engine.configure({ serverUrl: "http://localhost:3000", syncIntervalMs: 5000 });
      engine.startAutoSync();
      // Should not throw
      engine.stopAutoSync();
    });
  });

  describe("snapshot", () => {
    it("exports and imports snapshot", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      engine.queuePush([{ id: "s1", collection: "mem", data: { a: 1 }, version: 1, updatedAt: 100 }]);

      const snapshot = await engine.exportSnapshot();
      const parsed = JSON.parse(snapshot);
      expect(parsed.version).toBe(1);
      expect(parsed.pendingQueue.length).toBe(1);

      // New engine imports
      const engine2 = new ServerSyncEngine();
      engine2.configure({ serverUrl: "http://localhost:3000" });
      await engine2.importSnapshot(snapshot);
      expect(engine2.getStatus().pendingPush).toBe(1);
    });

    it("rejects invalid snapshot version", async () => {
      engine.configure({ serverUrl: "http://localhost:3000" });
      await expect(engine.importSnapshot(JSON.stringify({ version: 99 }))).rejects.toThrow("Unsupported snapshot");
    });
  });

  describe("factory", () => {
    it("creates engine without config", () => {
      const e = createServerSync();
      expect(e.getStatus().state).toBe("idle");
    });

    it("creates engine with config", () => {
      const e = createServerSync({ serverUrl: "http://localhost" });
      expect(e.getStatus().state).toBe("idle");
    });
  });
});
