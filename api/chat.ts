import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

interface ChatMessagePayload {
  role?: "user" | "assistant";
  content?: string;
  title?: string;
}

interface ChatContextPayload {
  projectName?: string;
  category?: string;
  selectedTemplate?: string;
  readinessScore?: number | null;
  activeDesignMd?: boolean;
}

interface ChatBody {
  messages?: ChatMessagePayload[];
  context?: ChatContextPayload;
}

interface VercelRequest {
  method?: string;
  body?: ChatBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const systemPrompt =
  "You are the OpenAI chat assistant inside Design-md-ai. Answer the user's chat request directly and practically. Keep Design.md generation as a separate workflow: when the user asks to create or regenerate Design.md, explain the next action briefly and tell them to use the dedicated Design.md action if needed. Do not claim to edit files or run tools unless the app context says that already happened.";

function setCors(response: VercelResponse): void {
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));
}

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u4E00-\u9FFF]/g, "")
    .trim()
    .slice(0, 6000);
}

function buildContextLine(context: ChatContextPayload | undefined): string {
  if (!context) return "No workspace context is available.";
  return [
    `Project: ${sanitize(context.projectName ?? "Untitled")}`,
    `Category: ${sanitize(context.category ?? "Unknown")}`,
    `Template: ${sanitize(context.selectedTemplate ?? "Unselected")}`,
    `Readiness: ${typeof context.readinessScore === "number" ? `${context.readinessScore}/100` : "Not validated"}`,
    `Design.md active: ${context.activeDesignMd ? "yes" : "no"}`,
  ].join("\n");
}

function normalizeMessages(messages: ChatMessagePayload[] | undefined) {
  return (messages ?? [])
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      role: message.role as "user" | "assistant",
      content: sanitize([message.title, message.content].filter(Boolean).join("\n")),
    }))
    .filter((message) => message.content)
    .slice(-12);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  const messages = normalizeMessages(request.body?.messages);
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    response.status(400).json({ error: "A user message is required." });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "system", content: `Workspace context:\n${buildContextLine(request.body?.context)}` },
        ...messages,
      ],
    });

    response.status(200).json({ message: completion.choices[0]?.message.content ?? "" });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Chat request failed." });
  }
}
