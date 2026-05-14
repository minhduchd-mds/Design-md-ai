import type { ChatMessage } from "../app/types";

interface ChatContext {
  projectName: string;
  category: string;
  selectedTemplate: string;
  readinessScore: number | null;
  activeDesignMd: boolean;
  workspaceTab: "chat" | "code";
  model?: string;
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

  // ── Streaming path (plain text stream from toTextStreamResponse) ──
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

    if (!response.ok) {
      let errorMsg = `Chat stream failed (${response.status}).`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody.error) errorMsg = errBody.error;
      } catch { /* ignore */ }
      throw new Error(errorMsg);
    }

    if (!response.body) {
      throw new Error("No response stream received.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onToken(chunk);
      }
    }

    return full || "No response generated.";
  }

  // ── Non-streaming fallback ──
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
