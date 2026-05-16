/**
 * figmaMcpClient — unit tests
 *
 * Tests the WS connection logic without a real server using a mock WebSocket.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { testFigmaMcpConnection, connectFigmaMcp } from "../figmaMcpClient";

// ── Mock WebSocket ──────────────────────────────────────────
class MockWebSocket {
  url: string;
  readyState = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: ((ev: { wasClean: boolean; code: number }) => void) | null = null;
  sentMessages: string[] = [];
  static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string) { this.sentMessages.push(data); }
  close() { this.readyState = 3; }

  // Test helpers
  simulateOpen() { this.readyState = 1; this.onopen?.(); }
  simulateMessage(data: unknown) { this.onmessage?.({ data: JSON.stringify(data) }); }
  simulateError() { this.onerror?.(); }
  simulateClose(wasClean = true, code = 1000) { this.readyState = 3; this.onclose?.({ wasClean, code }); }
}

describe("figmaMcpClient", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    MockWebSocket.instances = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = MockWebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  // ── testFigmaMcpConnection ──────────────────────────────

  describe("testFigmaMcpConnection", () => {
    it("returns 'connected' when server opens and replies", async () => {
      const promise = testFigmaMcpConnection("ws://localhost:3333");
      // Give synchronous constructor a tick to run
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      expect(ws).toBeDefined();
      ws.simulateOpen();
      ws.simulateMessage({ jsonrpc: "2.0", id: 1, result: "pong" });
      expect(await promise).toBe("connected");
    });

    it("sends a JSON-RPC ping on open", async () => {
      const promise = testFigmaMcpConnection("ws://localhost:3333");
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({});
      await promise;
      expect(ws.sentMessages).toHaveLength(1);
      const msg = JSON.parse(ws.sentMessages[0]) as { method: string; jsonrpc: string };
      expect(msg.method).toBe("ping");
      expect(msg.jsonrpc).toBe("2.0");
    });

    it("returns 'error' when WebSocket emits error", async () => {
      const promise = testFigmaMcpConnection("ws://localhost:3333");
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      ws.simulateError();
      expect(await promise).toBe("error");
    });

    it("returns 'error' for empty endpoint", async () => {
      const result = await testFigmaMcpConnection("");
      expect(result).toBe("error");
    });

    it("returns 'error' for non-WS endpoint", async () => {
      const result = await testFigmaMcpConnection("ftp://localhost:3333");
      expect(result).toBe("error");
    });

    it("normalises http:// to ws://", async () => {
      const promise = testFigmaMcpConnection("http://localhost:3333/mcp");
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      expect(ws.url).toBe("ws://localhost:3333/mcp");
      ws.simulateOpen();
      ws.simulateMessage({});
      await promise;
    });

    it("normalises https:// to wss://", async () => {
      const promise = testFigmaMcpConnection("https://my-server.io/mcp");
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      expect(ws.url).toBe("wss://my-server.io/mcp");
      ws.simulateOpen();
      ws.simulateMessage({});
      await promise;
    });

    it("returns 'error' on timeout (5s)", async () => {
      vi.useFakeTimers();
      const promise = testFigmaMcpConnection("ws://localhost:3333");
      vi.advanceTimersByTime(5001);
      expect(await promise).toBe("error");
    });

    it("does not settle twice if both message and error fire", async () => {
      const promise = testFigmaMcpConnection("ws://localhost:3333");
      await new Promise(r => setTimeout(r, 0));
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({ result: "pong" });
      ws.simulateError(); // should be ignored — already settled
      expect(await promise).toBe("connected");
    });
  });

  // ── connectFigmaMcp ──────────────────────────────────────

  describe("connectFigmaMcp", () => {
    it("calls onStatusChange('connected') when socket opens", () => {
      const onStatus = vi.fn();
      const onMsg = vi.fn();
      connectFigmaMcp("ws://localhost:3333", onMsg, onStatus);
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      expect(onStatus).toHaveBeenCalledWith("connected");
    });

    it("calls onMessage with parsed JSON", () => {
      const onStatus = vi.fn();
      const onMsg = vi.fn();
      connectFigmaMcp("ws://localhost:3333", onMsg, onStatus);
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateMessage({ type: "figma.variables", data: [] });
      expect(onMsg).toHaveBeenCalledWith({ type: "figma.variables", data: [] });
    });

    it("calls onStatusChange('error') on socket error", () => {
      const onStatus = vi.fn();
      const onMsg = vi.fn();
      connectFigmaMcp("ws://localhost:3333", onMsg, onStatus);
      const ws = MockWebSocket.instances[0];
      ws.simulateError();
      expect(onStatus).toHaveBeenCalledWith("error");
    });

    it("returns cleanup function that closes socket", () => {
      const onStatus = vi.fn();
      const cleanup = connectFigmaMcp("ws://localhost:3333", vi.fn(), onStatus);
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      cleanup();
      expect(ws.readyState).toBe(3);
    });

    it("calls onStatusChange('idle') on close after connect", () => {
      const onStatus = vi.fn();
      connectFigmaMcp("ws://localhost:3333", vi.fn(), onStatus);
      const ws = MockWebSocket.instances[0];
      ws.simulateOpen();
      ws.simulateClose(true, 1000);
      expect(onStatus).toHaveBeenLastCalledWith("idle");
    });

    it("returns error status immediately for invalid endpoint", () => {
      const onStatus = vi.fn();
      connectFigmaMcp("", vi.fn(), onStatus);
      expect(onStatus).toHaveBeenCalledWith("error");
      expect(MockWebSocket.instances).toHaveLength(0);
    });
  });
});
