import { createGroq } from "@ai-sdk/groq";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import type { LanguageModel } from "ai";
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
  let model: LanguageModel;

  try {
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
  } catch (error) {
    return errorResponse(`Provider init failed: ${error instanceof Error ? error.message : String(error)}`, 500, req);
  }

  try {
    const result = streamText({
      model,
      system: buildSystemPrompt(body.context),
      messages,
      maxOutputTokens: 8192,
      temperature: 0.7,
    });

    // Use TransformStream so the writable side runs in a detached async
    // context.  ReadableStream({ async start }) silently drops data on some
    // edge runtimes; TransformStream is the proven pattern for Vercel Edge.
    const encoder = new TextEncoder();
    const { readable, writable } = new TransformStream();

    // Fire-and-forget: pump textStream → writable, catch errors as visible text
    void (async () => {
      const writer = writable.getWriter();
      try {
        for await (const chunk of result.textStream) {
          await writer.write(encoder.encode(chunk));
        }
        // Append token usage metadata (hidden HTML comment — stripped by client)
        try {
          const usage = await result.usage;
          if (usage) {
            const meta = JSON.stringify({
              p: usage.inputTokens ?? 0,
              c: usage.outputTokens ?? 0,
              m: modelDef.id,
            });
            await writer.write(encoder.encode(`\n<!--USAGE:${meta}-->`));
          }
        } catch { /* usage unavailable — skip */ }
      } catch (err) {
        // AI SDK wraps provider errors in AI_RetryError — dig out the root cause
        const lastErr = (err as { lastError?: unknown }).lastError;
        const rootMsg = lastErr instanceof Error ? lastErr.message : undefined;
        const topMsg = err instanceof Error ? err.message : String(err);
        const raw = rootMsg || topMsg;
        const short = raw
          .replace(/Failed after \d+ attempt[s]?\.\s*Last error:\s*/i, "")
          .slice(0, 300);
        console.error("[chat-stream] AI provider error:", short);
        try {
          await writer.write(
            encoder.encode(`\n\n⚠️ **AI Error**: ${short || "Model không phản hồi — thử lại nhé."}`),
          );
        } catch { /* writer may already be closed */ }
      } finally {
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(readable, {
      status: 200,
      headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Stream failed.", 500, req);
  }
}

// Wrap with Upstash Redis sliding-window rate limit: 20 req / 60 s per IP
export default withRateLimitEdge(handler, "chat-stream", 20);
