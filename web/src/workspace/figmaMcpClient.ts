/**
 * figmaMcpClient — HTTP connection test for Figma MCP.
 *
 * Figma MCP server uses Streamable HTTP transport (POST JSON-RPC 2.0),
 * NOT WebSocket. Known endpoints:
 *   - Remote: https://mcp.figma.com/mcp
 *   - Local:  http://127.0.0.1:3845/mcp
 *
 * This module sends an `initialize` JSON-RPC 2.0 request to verify the
 * server is alive and speaks MCP protocol.
 */

export type FigmaMcpStatus = "idle" | "connecting" | "connected" | "error";

const CONNECTION_TIMEOUT_MS = 5000;

/**
 * Test connection to a Figma MCP endpoint via HTTP POST (JSON-RPC 2.0).
 * Returns "connected" on valid response, "error" on failure.
 */
export async function testFigmaMcpConnection(endpoint: string): Promise<"connected" | "error"> {
  const url = normaliseHttpUrl(endpoint);
  if (!url) return "error";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "desygn-ai", version: "5.1.1" },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return "error";

    const data = (await response.json()) as Record<string, unknown>;
    // Valid MCP response has jsonrpc field and either result or error
    if (data && typeof data === "object" && "jsonrpc" in data) {
      return "connected";
    }
    return "error";
  } catch {
    return "error";
  } finally {
    clearTimeout(timer);
  }
}

// ── helpers ──────────────────────────────────────────────

function normaliseHttpUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    // Convert ws/wss to http/https for backward compat with saved endpoints
    let normalized = trimmed;
    if (normalized.startsWith("ws://")) normalized = normalized.replace("ws://", "http://");
    else if (normalized.startsWith("wss://")) normalized = normalized.replace("wss://", "https://");

    const url = new URL(normalized);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}
