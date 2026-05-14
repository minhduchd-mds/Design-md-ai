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
}

interface ChatBody {
  messages?: ChatMessagePayload[];
  context?: ChatContextPayload;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const CHAT_SYSTEM_PROMPT =
  "You are a helpful AI assistant powered by Groq. Answer questions directly, clearly, and naturally. Use markdown in responses: code blocks for code, bullet lists for structured info, headers only for long answers. Be concise but thorough.";

const CODE_SYSTEM_PROMPT =
  "You are an AI assistant for UI design and frontend development. Help with component architecture, design tokens, layout planning, responsive behavior, and implementation guidance. When workspace context is provided, use it to give grounded, project-specific answers.";

function buildSystemPrompt(workspaceTab: "chat" | "code" | undefined): string {
  return workspaceTab === "code" ? CODE_SYSTEM_PROMPT : CHAT_SYSTEM_PROMPT;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any): Promise<void> {
  Object.entries(corsHeaders).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === "OPTIONS") { res.status(200).end(); return; }
  if (req.method !== "POST") { res.status(405).end(); return; }

  const apiKey = process.env.GROQ_API_KEY as string | undefined;
  if (!apiKey) {
    res.setHeader("Content-Type", "text/event-stream");
    res.write(`data: ${JSON.stringify({ error: "GROQ_API_KEY not configured." })}\n\n`);
    res.end();
    return;
  }

  const body = req.body as ChatBody;
  const messages = normalizeMessages(body?.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    res.status(400).end();
    return;
  }

  const context = body?.context;
  const contextLine = buildContextLine(context);
  const systemMessages: { role: "system"; content: string }[] = [
    { role: "system", content: buildSystemPrompt(context?.workspaceTab) },
    ...(contextLine ? [{ role: "system" as const, content: `Workspace context:\n${contextLine}` }] : []),
  ];

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  try {
    const groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
    const stream = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8192,
      stream: true,
      messages: [...systemMessages, ...messages],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        res.write(`data: ${JSON.stringify({ delta })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
  } catch (error) {
    res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : "Stream failed." })}\n\n`);
  } finally {
    res.end();
  }
}
