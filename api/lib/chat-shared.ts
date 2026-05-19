import type { ModelMessage } from "ai";

export interface ChatContextPayload {
  projectName?: string;
  category?: string;
  selectedTemplate?: string;
  readinessScore?: number | null;
  activeDesignMd?: boolean;
  workspaceTab?: "chat" | "code";
  model?: string;
}

export interface ChatAttachmentPayload {
  type: string;
  name: string;
  url: string; // data URL (base64)
}

export interface ChatBody {
  messages?: Array<{ role?: string; content?: string; title?: string; attachments?: ChatAttachmentPayload[] }>;
  context?: ChatContextPayload;
}

// ── Model registry ───────────────────────────────────────────────
export type ModelProvider = "groq" | "google";

export interface ModelDef {
  id: string;
  provider: ModelProvider;
  providerModelId: string;
}

export const MODEL_REGISTRY: ModelDef[] = [
  // Groq models
  { id: "llama-3.3-70b-versatile",  provider: "groq",   providerModelId: "llama-3.3-70b-versatile" },
  { id: "llama-3.1-8b-instant",     provider: "groq",   providerModelId: "llama-3.1-8b-instant" },
  { id: "mixtral-8x7b-32768",       provider: "groq",   providerModelId: "mixtral-8x7b-32768" },
  { id: "gemma2-9b-it",             provider: "groq",   providerModelId: "gemma2-9b-it" },
  // Google Gemini models
  { id: "gemini-2.0-flash",         provider: "google",  providerModelId: "gemini-2.0-flash" },
  { id: "gemini-2.5-flash",         provider: "google",  providerModelId: "gemini-2.5-flash" },
  { id: "gemini-2.0-flash-lite",    provider: "google",  providerModelId: "gemini-2.0-flash-lite" },
];

export const ALLOWED_MODELS = MODEL_REGISTRY.map((m) => m.id);

const CHAT_SYSTEM = `You are a friendly, knowledgeable AI assistant.

Guidelines:
- Respond naturally in the same language the user writes in (Vietnamese, English, etc.)
- Be conversational and direct — skip preambles like "Sure!" or "Great question!"
- Use markdown formatting: **bold** for emphasis, \`code\` for inline code, fenced code blocks with language tags for code snippets, bullet lists for structured info
- For code questions, include working examples with correct syntax highlighting
- When explaining concepts, use clear language and analogies
- If you are unsure about something, say so honestly
- Keep responses focused and practical

Image embedding:
- You CAN display images in your responses using markdown: ![description](url)
- The chat UI renders markdown images inline — users will see the actual image, not just a link
- When the user asks for images/photos/illustrations, use these free image services:
  • Unsplash keywords: ![description](https://images.unsplash.com/photo-1560807707-8cc77767d783?w=800&q=80) — use known Unsplash photo IDs when relevant
  • Lorem Picsum (random high-quality photos): ![description](https://picsum.photos/seed/KEYWORD/800/500) — replace KEYWORD with a relevant English word
  • Placeholder with text: ![description](https://placehold.co/800x400/6366f1/ffffff?text=Your+Text+Here)
- Always include a descriptive alt text in the brackets
- You can show multiple images in one response for galleries, comparisons, etc.
- Example: "Here's a sample landscape:" followed by ![Beautiful mountain landscape](https://picsum.photos/seed/mountain/800/500)`;

const CODE_SYSTEM = `You are an expert UI/UX design and frontend development assistant inside a Design.md workspace.

Guidelines:
- Help with component architecture, design tokens, responsive layout, accessibility, and implementation strategy
- Respond in the same language the user writes in
- When workspace context is available (project name, template, readiness score), use it to give grounded, project-specific answers
- Use markdown formatting with proper code blocks (tsx, css, json, etc.)
- Be specific — reference actual component names, token values, and breakpoints when possible
- Suggest best practices from modern design systems (shadcn/ui, Radix, Tailwind conventions)`;

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\tÀ-ɏĀ-ɏḀ-ỿ　-鿿가-힯]/g, "")
    .trim()
    .slice(0, 8000);
}

export function buildSystemPrompt(context: ChatContextPayload | undefined): string {
  const base = context?.workspaceTab === "code" ? CODE_SYSTEM : CHAT_SYSTEM;

  if (!context || context.workspaceTab !== "code") return base;

  const lines = [
    `Project: ${sanitize(context.projectName ?? "Untitled")}`,
    `Category: ${sanitize(context.category ?? "Unknown")}`,
    `Template: ${sanitize(context.selectedTemplate ?? "Unselected")}`,
    `Readiness: ${typeof context.readinessScore === "number" ? `${context.readinessScore}/100` : "Not validated"}`,
    `Design context active: ${context.activeDesignMd ? "yes" : "no"}`,
  ];
  return `${base}\n\nWorkspace context:\n${lines.join("\n")}`;
}

/**
 * Maximum size for a single inline image (base64 data URL).
 * Larger images are described by name only to avoid blowing up the context.
 */
const MAX_IMAGE_DATA_URL_LEN = 2_000_000; // ~1.5 MB decoded

export function normalizeMessages(raw: ChatBody["messages"]): ModelMessage[] {
  return (raw ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => {
      const text = sanitize([m.title, m.content].filter(Boolean).join("\n"));
      const images = (m.attachments ?? []).filter(
        (a) => a.type.startsWith("image/") && a.url.startsWith("data:") && a.url.length <= MAX_IMAGE_DATA_URL_LEN,
      );

      // If no images, keep simple text content (works with all providers)
      if (images.length === 0) {
        return { role: m.role as "user" | "assistant", content: text };
      }

      // Multimodal: build content parts array for vision models
      // SDK ImagePart: { type: "image", image: DataContent | URL, mediaType?: string }
      const parts: Array<{ type: string; text?: string; image?: URL; mediaType?: string }> = [];
      if (text) {
        parts.push({ type: "text", text });
      }
      for (const img of images) {
        try {
          parts.push({ type: "image", image: new URL(img.url), mediaType: img.type });
        } catch {
          // Invalid data URL — describe instead
          parts.push({ type: "text", text: `[Attached image: ${sanitize(img.name)}]` });
        }
      }

      return { role: m.role as "user" | "assistant", content: parts };
    })
    .filter((m) => {
      if (typeof m.content === "string") return m.content.length > 0;
      return Array.isArray(m.content) && m.content.length > 0;
    })
    .slice(-20) as ModelMessage[];
}

import { buildCorsHeaders } from "./cors";

/** @deprecated Use buildCorsHeaders(req) for origin-restricted CORS */
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function resolveModel(context: ChatContextPayload | undefined): string {
  const requestedModel = context?.model ?? "llama-3.3-70b-versatile";
  return ALLOWED_MODELS.includes(requestedModel) ? requestedModel : "llama-3.3-70b-versatile";
}

export function resolveModelDef(context: ChatContextPayload | undefined): ModelDef {
  const id = resolveModel(context);
  return MODEL_REGISTRY.find((m) => m.id === id) ?? MODEL_REGISTRY[0];
}

export function handlePreflight(req: Request): Response | null {
  const headers = buildCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed." }), { status: 405, headers });
  }
  return null;
}

export function errorResponse(message: string, status: number, req?: Request): Response {
  const headers = req ? buildCorsHeaders(req) : corsHeaders;
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export { buildCorsHeaders };

export async function parseBody(req: Request): Promise<ChatBody> {
  return (await req.json()) as ChatBody;
}
