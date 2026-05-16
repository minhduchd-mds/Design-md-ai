/**
 * figmaMcpClient — real WebSocket connection test for Figma MCP.
 *
 * Figma MCP server (Model Context Protocol) listens on a WebSocket endpoint.
 * This client attempts a real WS handshake with a 5s timeout, sends a ping,
 * and waits for any valid JSON response to confirm the server is alive.
 *
 * Protocol:
 *   → { jsonrpc: "2.0", id: 1, method: "ping" }
 *   ← Any JSON message (pong, capabilities, etc.)
 */

export type FigmaMcpStatus = "idle" | "connecting" | "connected" | "error";

const CONNECTION_TIMEOUT_MS = 5000;

/**
 * Attempt to connect to a Figma MCP WebSocket endpoint and verify it responds.
 * Returns "connected" on success, "error" on failure.
 */
export async function testFigmaMcpConnection(endpoint: string): Promise<"connected" | "error"> {
  // Normalise: allow http(s) → convert to ws(s)
  const wsUrl = normaliseWsUrl(endpoint);
  if (!wsUrl) return "error";

  return new Promise<"connected" | "error">((resolve) => {
    let settled = false;

    const settle = (result: "connected" | "error") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      try { ws.close(); } catch { /* ignore */ }
      resolve(result);
    };

    const timer = setTimeout(() => settle("error"), CONNECTION_TIMEOUT_MS);

    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      settle("error");
      return;
    }

    ws.onopen = () => {
      // Send JSON-RPC ping as per MCP spec
      try {
        ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }));
      } catch {
        settle("error");
      }
    };

    ws.onmessage = () => {
      // Any response means the server is alive
      settle("connected");
    };

    ws.onerror = () => settle("error");
    ws.onclose = (ev) => {
      // If we close with code 1000/1001 before getting a message it might still be a valid server
      // that just doesn't implement ping — treat clean close as error (need actual response)
      if (!settled) settle(ev.wasClean && ev.code === 1000 ? "error" : "error");
    };
  });
}

/**
 * Create a persistent MCP session that stays open and calls onMessage for every event.
 * Returns a cleanup function to close the socket.
 */
export function connectFigmaMcp(
  endpoint: string,
  onMessage: (data: unknown) => void,
  onStatusChange: (status: FigmaMcpStatus) => void,
): () => void {
  const wsUrl = normaliseWsUrl(endpoint);
  if (!wsUrl) { onStatusChange("error"); return () => {}; }

  onStatusChange("connecting");
  let ws: WebSocket;
  let closed = false;

  try {
    ws = new WebSocket(wsUrl);
  } catch {
    onStatusChange("error");
    return () => {};
  }

  ws.onopen = () => {
    onStatusChange("connected");
    ws.send(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }));
  };

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data as string) as unknown;
      onMessage(data);
    } catch {
      onMessage(ev.data);
    }
  };

  ws.onerror = () => onStatusChange("error");
  ws.onclose = () => { if (!closed) onStatusChange("idle"); };

  return () => {
    closed = true;
    try { ws.close(); } catch { /* ignore */ }
  };
}

// ── helpers ──────────────────────────────────────────────

function normaliseWsUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // Allow ws://, wss://, http://, https://
    const url = trimmed.startsWith("ws") ? new URL(trimmed) : new URL(trimmed.replace(/^http/, "ws"));
    if (!["ws:", "wss:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
