import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import type { LanguageModelV1 } from "ai";
import {
  buildCorsHeaders,
  buildSystemPrompt,
  errorResponse,
  handlePreflight,
  normalizeMessages,
  parseBody,
  resolveModelDef,
} from "./lib/chat-shared";
import { checkRateLimit, getClientIp } from "./lib/rateLimit";
import { withRateLimitEdge } from "./lib/rate-limit";

export const config = { runtime: "edge", maxDuration: 30 };

async function handler(req: Request): Promise<Response> {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const cors = buildCorsHeaders(req);

  // Rate limiting
  const ip = getClientIp(Object.fromEntries(req.headers.entries()));
  const rl = checkRateLimit(`chat-stream:${ip}`);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Too many requests. Try again later." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(Math.ceil(rl.resetMs / 1000)) },
    });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch {
    return errorResponse("Invalid JSON.", 400, req);
  }

  const messages = normalizeMessages(body.messages);
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return errorResponse("A user message is required.", 400, req);
  }

  // ── Resolve model & provider ──────────────────────────────────
  const modelDef = resolveModelDef(body.context);
  let model: LanguageModelV1;

  if (modelDef.provider === "google") {
    const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!googleKey) return errorResponse("GOOGLE_GENERATIVE_AI_API_KEY not configured.", 500, req);
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    model = google(modelDef.providerModelId);
  } else {
    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) return errorResponse("GROQ_API_KEY not configured.", 500, req);
    const groq = createGroq({ apiKey: groqKey });
    model = groq(modelDef.providerModelId);
  }

  try {
    const result = streamText({
      model,
      system: buildSystemPrompt(body.context),
      messages,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    return result.toTextStreamResponse({ headers: cors });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Stream failed.", 500, req);
  }
}

// Wrap with Upstash Redis sliding-window rate limit: 20 req / 60 s per IP
export default withRateLimitEdge(handler, "chat-stream", 20);
