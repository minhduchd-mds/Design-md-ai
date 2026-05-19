/**
 * chatApi — Chat API integration layer (Groq / Google Gemini via /api/chat).
 *
 * Delegates to:
 *  - streamClient.postStream  (streaming path — onToken callback)
 *  - apiClient.post           (non-streaming fallback)
 *
 * Benefits: automatic retry, AbortController lifecycle, rate-limit awareness,
 * error normalization, and error bus emission.
 *
 * NOTE: Despite the legacy export name `sendClaudeChat`, this calls Groq and
 * Google Gemini via our /api/chat-stream endpoint — not the Anthropic API.
 * The function name is kept for backward compatibility; alias `sendChat` below.
 */

import type { ChatMessage } from "../app/types";
import { apiClient } from "../lib/apiClient";
import { postStream } from "../lib/streamClient";
import { chatRateLimit } from "../lib/rateLimit";
import { errorBus } from "../lib/errorBus";

interface ChatResponse {
  message?: string;
  error?: string;
}

export async function sendChat(
  messages: ChatMessage[],
  context: {
    projectName: string;
    category: string;
    selectedTemplate: string;
    readinessScore: number | null;
    activeDesignMd: boolean;
    workspaceTab: "chat" | "code" | "checklist";
    model: string;
  },
  onToken?: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  // Client-side rate limit guard
  if (!chatRateLimit.consume()) {
    const waitSec = chatRateLimit.waitSeconds.toFixed(1);
    throw new Error(`Rate limited — please wait ${waitSec}s before retrying.`);
  }

  const body = {
    messages: messages.map((m) => {
      const base: Record<string, unknown> = { role: m.role, title: m.title, content: m.content };
      // Include image attachments so the AI model can see uploaded images
      if (m.attachments && m.attachments.length > 0) {
        base.attachments = m.attachments
          .filter((a) => a.type.startsWith("image/"))
          .map((a) => ({ type: a.type, name: a.name, url: a.url }));
      }
      return base;
    }),
    context,
  };

  // ── Streaming path ────────────────────────────────────────────
  if (onToken) {
    try {
      return await postStream("/api/chat-stream", body, onToken, { signal });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat stream failed";
      if (message.includes("NETWORK") || message.includes("fetch")) {
        throw new Error("Chat API unavailable. Start the dev server or deploy to Vercel.");
      }
      errorBus.network(message, true);
      throw err;
    }
  }

  // ── Non-streaming fallback ────────────────────────────────────
  try {
    const payload = await apiClient.post<ChatResponse>("/api/chat", body, { signal });
    return payload.message?.trim() || "No response generated.";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Chat request failed";
    if (message.includes("404")) {
      throw new Error("Chat API route not found. Restart the dev server so /api/chat is registered.");
    }
    throw err;
  }
}

/** @deprecated Use `sendChat` instead. Alias kept for backward compatibility. */
export const sendClaudeChat = sendChat;
