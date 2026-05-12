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
  let response: Response;
  try {
    response = await fetch("/api/chat", {
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
  } catch {
    throw new Error("OpenAI chat API is unavailable. Start the app with the local API route server or deploy it with Vercel.");
  }

  const payload = (await response.json().catch(() => ({}))) as ChatResponse;

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("OpenAI chat API route was not found. Restart the dev server so /api/chat is registered.");
    }
    throw new Error(payload.error ?? `OpenAI chat request failed with status ${response.status}.`);
  }

  return payload.message?.trim() || "I could not generate a response.";
}
