/**
 * figmaMcpClient — unit tests
 *
 * Tests the HTTP-based MCP connection test using fetch mocks.
 * Verifies JSON-RPC 2.0 `initialize` request is sent correctly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { testFigmaMcpConnection } from "../figmaMcpClient";

// ── Helpers ─────────────────────────────────────────────

function mockFetch(response: { ok: boolean; json?: unknown }) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue({
    ok: response.ok,
    json: () => Promise.resolve(response.json ?? {}),
  } as Response);
}

describe("figmaMcpClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("testFigmaMcpConnection", () => {
    it("returns 'connected' when server responds with valid JSON-RPC", async () => {
      const spy = mockFetch({
        ok: true,
        json: { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } },
      });
      const result = await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");
      expect(result).toBe("connected");
      expect(spy).toHaveBeenCalledOnce();
    });

    it("sends JSON-RPC initialize request with correct structure", async () => {
      const spy = mockFetch({
        ok: true,
        json: { jsonrpc: "2.0", id: 1, result: {} },
      });
      await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");

      const [url, init] = spy.mock.calls[0];
      expect(url).toBe("http://127.0.0.1:3845/mcp");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string) as Record<string, unknown>;
      expect(body.jsonrpc).toBe("2.0");
      expect(body.method).toBe("initialize");
      expect(body.params).toEqual({
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "desygn-ai", version: "5.1.1" },
      });
    });

    it("returns 'error' when server returns non-OK HTTP status", async () => {
      mockFetch({ ok: false });
      const result = await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");
      expect(result).toBe("error");
    });

    it("returns 'error' when response is not valid JSON-RPC", async () => {
      mockFetch({ ok: true, json: { status: "up" } }); // no jsonrpc field
      const result = await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");
      expect(result).toBe("error");
    });

    it("returns 'error' for empty endpoint", async () => {
      const result = await testFigmaMcpConnection("");
      expect(result).toBe("error");
    });

    it("returns 'error' for non-HTTP protocol", async () => {
      const result = await testFigmaMcpConnection("ftp://localhost:3333");
      expect(result).toBe("error");
    });

    it("normalises ws:// to http://", async () => {
      const spy = mockFetch({
        ok: true,
        json: { jsonrpc: "2.0", id: 1, result: {} },
      });
      await testFigmaMcpConnection("ws://localhost:3845/mcp");
      expect(spy.mock.calls[0][0]).toBe("http://localhost:3845/mcp");
    });

    it("normalises wss:// to https://", async () => {
      const spy = mockFetch({
        ok: true,
        json: { jsonrpc: "2.0", id: 1, result: {} },
      });
      await testFigmaMcpConnection("wss://mcp.figma.com/mcp");
      expect(spy.mock.calls[0][0]).toBe("https://mcp.figma.com/mcp");
    });

    it("returns 'error' when fetch throws (network failure)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("NetworkError"));
      const result = await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");
      expect(result).toBe("error");
    });

    it("returns 'error' when fetch is aborted (timeout)", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("Aborted", "AbortError"));
      const result = await testFigmaMcpConnection("http://127.0.0.1:3845/mcp");
      expect(result).toBe("error");
    });

    it("accepts https://mcp.figma.com/mcp as valid endpoint", async () => {
      const spy = mockFetch({
        ok: true,
        json: { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-03-26" } },
      });
      const result = await testFigmaMcpConnection("https://mcp.figma.com/mcp");
      expect(result).toBe("connected");
      expect(spy.mock.calls[0][0]).toBe("https://mcp.figma.com/mcp");
    });
  });
});
