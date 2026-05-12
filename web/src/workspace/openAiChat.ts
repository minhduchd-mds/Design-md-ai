import type { ChatMessage } from "../app/types";

interface ChatContext {
  projectName: string;
  category: string;
  selectedTemplate: string;
  readinessScore: number | null;
  activeDesignMd: boolean;
}

interface ChatResponse {
  message?: string;
  error?: string;
}

export async function sendOpenAiChat(messages: ChatMessage[], context: ChatContext): Promise<string> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.map((message) => ({
        role: message.role,
        title: message.title,
        content: message.content,
      })),
      context,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "OpenAI chat request failed.");
  }

  return payload.message?.trim() || "I could not generate a response.";
}
