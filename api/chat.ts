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
  workspaceTab?: "chat" | "code";
  model?: string;
}

const ALLOWED_MODELS = [
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "mixtral-8x7b-32768",
  "gemma2-9b-it",
];

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

// Chat tab: pure assistant, no Design.md mentions
const CHAT_SYSTEM_PROMPT =
  "You are a helpful AI assistant powered by Groq. Answer questions directly, clearly, and naturally. Use markdown in responses: code blocks for code, bullet lists for structured info, headers only for long answers. Be concise but thorough.";

// Code tab: design/frontend assistant with workspace context
const CODE_SYSTEM_PROMPT =
  "You are an AI assistant for UI design and frontend development. Help with component architecture, design tokens, layout planning, responsive behavior, and implementation guidance. When workspace context is provided, use it to give grounded, project-specific answers.";

function buildSystemPrompt(workspaceTab: "chat" | "code" | undefined): string {
  return workspaceTab === "code" ? CODE_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;
}

function setCors(response: VercelResponse): void {
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));
}

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\tÀ-ɏ一-鿿]/g, "")
    .trim()
    .slice(0, 6000);
}

function buildContextLine(context: ChatContextPayload | undefined): string {
  if (!context || context.workspaceTab !== "code") return "";
  return [
    `Project: ${sanitize(context.projectName ?? "Untitled")}`,
    `Category: ${sanitize(context.category ?? "Unknown")}`,
    `Template: ${sanitize(context.selectedTemplate ?? "Unselected")}`,
    `Readiness: ${typeof context.readinessScore === "number" ? `${context.readinessScore}/100` : "Not validated"}`,
    `Design context active: ${context.activeDesignMd ? "yes" : "no"}`,
  ].join("\n");
}

function normalizeMessages(messages: ChatMessagePayload[] | undefined) {
  return (messages ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: sanitize([m.title, m.content].filter(Boolean).join("\n")),
    }))
    .filter((m) => m.content)
    .slice(-12);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);

  if (request.method === "OPTIONS") { response.status(200).end(); return; }
  if (request.method !== "POST") { response.status(405).json({ error: "Method not allowed." }); return; }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) { response.status(500).json({ error: "GROQ_API_KEY is not configured." }); return; }

  const messages = normalizeMessages(request.body?.messages);
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") {
    response.status(400).json({ error: "A user message is required." });
    return;
  }

  const context = request.body?.context;
  const contextLine = buildContextLine(context);
  const systemMessages: { role: "system"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(context?.workspaceTab) },
    ...(contextLine ? [{ role: "system" as const, content: `Workspace context:\n${contextLine}` }] : []),
  ];

  try {
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const requestedModel = context?.model ?? "llama-3.3-70b-versatile";
    const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";

    const completion = await groq.chat.completions.create({
      model,
      max_tokens: 8192,
      messages: [...systemMessages, ...messages],
    });

    response.status(200).json({ message: completion.choices[0]?.message.content ?? "" });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Chat request failed." });
  }
}
