import type { ChatMessage } from "../app/types";

interface ChatContext {
  projectName: string;
  category: string;
  selectedTemplate: string;
  readinessScore: number | null;
  activeDesignMd: boolean;
  workspaceTab: "chat" | "code";
}

interface ChatResponse {
  message?: string;
  error?: string;
}

export async function sendClaudeChat(
  messages: ChatMessage[],
  context: ChatContext,
  onToken?: (token: string) => void,
): Promise<string> {
  const body = JSON.stringify({
    messages: messages.map((m) => ({ role: m.role, title: m.title, content: m.content })),
    context,
  });

  // Streaming path — used when onToken callback is provided
  if (onToken) {
    let response: Response;
    try {
      response = await fetch("/api/chat-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      throw new Error("Chat API is unavailable. Start the dev server or deploy to Vercel.");
    }

    if (!response.ok || !response.body) {
      throw new Error(`Chat stream failed with status ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") return full;
        if (!data) continue;

        let parsed: { delta?: string; error?: string };
        try {
          parsed = JSON.parse(data) as { delta?: string; error?: string };
        } catch {
          continue; // skip non-JSON lines
        }

        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta) {
          full += parsed.delta;
          onToken(parsed.delta);
        }
      }
    }
    return full || "No response generated.";
  }

  // Non-streaming fallback
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    throw new Error("Chat API is unavailable. Start the dev server or deploy to Vercel.");
  }

  const payload = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Chat API route not found. Restart the dev server so /api/chat is registered.");
    }
    throw new Error(payload.error ?? `Chat request failed with status ${response.status}.`);
  }

  return payload.message?.trim() || "No response generated.";
}
