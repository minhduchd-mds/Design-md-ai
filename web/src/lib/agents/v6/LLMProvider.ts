/**
 * LLMProvider — Abstraction layer for LLM integration in Agent Fleet v6.
 *
 * Tier 2 implementation: provides a unified interface that agents use to call
 * LLMs. Ships with a stub provider (returns deterministic responses) and a
 * Groq provider (uses the existing chat-stream API).
 *
 * Usage in agents:
 *   const response = await ctx.llm.complete({ prompt, maxTokens: 2048 });
 *
 * Roadmap:
 *   - E-1: Plug into RefactorAgent for smarter refactors
 *   - E-2: Plug into TestGenAgent for meaningful test bodies
 *   - E-3: Plug into CodeFixAgent for LLM-guided fixes
 *   - E-4: Plug into HumanCommandAgent for intent classification
 */

// ── Types ──────────────────────────────────────────────────────────

export interface LLMRequest {
  /** System prompt (sets agent persona/constraints) */
  system?: string;
  /** User prompt (the actual task) */
  prompt: string;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Temperature (0 = deterministic, 1 = creative) */
  temperature?: number;
  /** Model override (provider-specific) */
  model?: string;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

export interface LLMResponse {
  /** Generated text */
  text: string;
  /** Tokens consumed (input + output) */
  tokensUsed: number;
  /** Estimated cost in USD */
  costUsd: number;
  /** Model that actually ran */
  model: string;
  /** Finish reason */
  finishReason: "stop" | "length" | "error";
}

export interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (response: LLMResponse) => void;
  onError: (error: Error) => void;
}

export interface LLMProvider {
  readonly name: string;
  readonly isAvailable: boolean;

  /** Single-shot completion */
  complete(request: LLMRequest): Promise<LLMResponse>;

  /** Streaming completion */
  stream(request: LLMRequest, callbacks: LLMStreamCallbacks): Promise<void>;

  /** Estimate cost before calling (for budget gating) */
  estimateCost(promptTokens: number, maxOutputTokens: number): number;
}

// ── Stub Provider (Tier 2 default — no LLM calls) ─────────────────

export class StubLLMProvider implements LLMProvider {
  readonly name = "stub";
  readonly isAvailable = true;

  async complete(request: LLMRequest): Promise<LLMResponse> {
    // Return a deterministic placeholder — agents fall back to their v0 logic
    return {
      text: `[LLM stub] No LLM configured. Agent should use deterministic fallback for: "${request.prompt.slice(0, 100)}"`,
      tokensUsed: 0,
      costUsd: 0,
      model: "stub",
      finishReason: "stop",
    };
  }

  async stream(request: LLMRequest, callbacks: LLMStreamCallbacks): Promise<void> {
    const response = await this.complete(request);
    callbacks.onToken(response.text);
    callbacks.onComplete(response);
  }

  estimateCost(): number {
    return 0;
  }
}

// ── Groq Provider (uses existing /api/chat-stream) ─────────────────

export class GroqLLMProvider implements LLMProvider {
  readonly name = "groq";
  private readonly apiBase: string;

  constructor(apiBase = "") {
    this.apiBase = apiBase;
  }

  get isAvailable(): boolean {
    return typeof fetch !== "undefined";
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model ?? "llama-3.3-70b-versatile";
    const body = {
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        { role: "user", content: request.prompt },
      ],
      context: {
        model,
        workspaceTab: "code",
        projectName: "agent-task",
        category: "SaaS",
        selectedTemplate: "",
        readinessScore: 0,
        activeDesignMd: false,
      },
    };

    const res = await fetch(`${this.apiBase}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: request.signal,
    });

    if (!res.ok) {
      throw new Error(`Groq API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { message?: string };
    const text = data.message?.trim() ?? "";
    const tokensUsed = Math.ceil(text.length / 4) + Math.ceil(request.prompt.length / 4);

    return {
      text,
      tokensUsed,
      costUsd: this.estimateCost(Math.ceil(request.prompt.length / 4), Math.ceil(text.length / 4)),
      model,
      finishReason: "stop",
    };
  }

  async stream(request: LLMRequest, callbacks: LLMStreamCallbacks): Promise<void> {
    const model = request.model ?? "llama-3.3-70b-versatile";
    const body = {
      messages: [
        ...(request.system ? [{ role: "system", content: request.system }] : []),
        { role: "user", content: request.prompt },
      ],
      context: {
        model,
        workspaceTab: "code",
        projectName: "agent-task",
        category: "SaaS",
        selectedTemplate: "",
        readinessScore: 0,
        activeDesignMd: false,
      },
    };

    try {
      const res = await fetch(`${this.apiBase}/api/chat-stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: request.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Groq stream error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        callbacks.onToken(chunk);
      }

      callbacks.onComplete({
        text: fullText,
        tokensUsed: Math.ceil(fullText.length / 4) + Math.ceil(request.prompt.length / 4),
        costUsd: this.estimateCost(Math.ceil(request.prompt.length / 4), Math.ceil(fullText.length / 4)),
        model,
        finishReason: "stop",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      callbacks.onError(err as Error);
    }
  }

  /** Groq pricing: ~$0.59/M input, ~$0.79/M output for Llama 3.3 70B */
  estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * 0.00000059) + (outputTokens * 0.00000079);
  }
}

// ── Factory ─────────────────────────────────────────────────────────

/** Create the best available LLM provider */
export function createLLMProvider(apiBase = ""): LLMProvider {
  if (typeof fetch !== "undefined") {
    return new GroqLLMProvider(apiBase);
  }
  return new StubLLMProvider();
}

// ── Singleton ───────────────────────────────────────────────────────

export const defaultLLMProvider: LLMProvider = new StubLLMProvider();
