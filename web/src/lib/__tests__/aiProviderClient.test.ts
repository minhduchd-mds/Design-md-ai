import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIProviderClient, createAIProviderClient } from "../aiProviderClient";

describe("AIProviderClient", () => {
  let client: AIProviderClient;

  beforeEach(() => {
    client = new AIProviderClient();
    vi.restoreAllMocks();
  });

  describe("configure", () => {
    it("stores credentials", () => {
      client.configure({ groqApiKey: "gsk_test123" });
      expect(client.isConfigured("groq")).toBe(true);
      expect(client.isConfigured("openai")).toBe(false);
    });

    it("merges credentials on multiple calls", () => {
      client.configure({ groqApiKey: "gsk_1" });
      client.configure({ openaiApiKey: "sk_2" });
      expect(client.isConfigured("groq")).toBe(true);
      expect(client.isConfigured("openai")).toBe(true);
    });
  });

  describe("getConfiguredProviders", () => {
    it("returns empty when no providers configured", () => {
      expect(client.getConfiguredProviders()).toEqual([]);
    });

    it("returns all configured providers", () => {
      client.configure({
        groqApiKey: "gsk_x",
        openaiApiKey: "sk_x",
        anthropicApiKey: "ant_x",
        localEndpoint: "http://localhost:11434",
      });
      expect(client.getConfiguredProviders()).toEqual(["groq", "openai", "anthropic", "local"]);
    });
  });

  describe("isConfigured", () => {
    it("returns false for unknown provider", () => {
      expect(client.isConfigured("unknown")).toBe(false);
    });

    it("returns true for configured local endpoint", () => {
      client.configure({ localEndpoint: "http://localhost:11434/v1" });
      expect(client.isConfigured("local")).toBe(true);
    });
  });

  describe("complete", () => {
    it("throws if provider not configured", async () => {
      await expect(
        client.complete({
          provider: "groq",
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: "hi" }],
        }),
      ).rejects.toThrow('Provider "groq" not configured');
    });

    it("makes API call and returns response", async () => {
      client.configure({ groqApiKey: "gsk_test" });

      const mockResponse = {
        choices: [{ message: { content: "Hello!" }, finish_reason: "stop" }],
        model: "llama-3.1-8b-instant",
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }));

      const result = await client.complete({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "hi" }],
      });

      expect(result.content).toBe("Hello!");
      expect(result.provider).toBe("groq");
      expect(result.tokensUsed.total).toBe(8);
      expect(result.finishReason).toBe("stop");
    });

    it("retries on 500 error", async () => {
      client.configure({ groqApiKey: "gsk_test" });

      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: "Server Error", text: () => Promise.resolve("err") })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: "OK" }, finish_reason: "stop" }],
            model: "test",
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        });

      vi.stubGlobal("fetch", fetchMock);

      const result = await client.complete({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "hi" }],
      });

      expect(result.content).toBe("OK");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry on 401", async () => {
      client.configure({ groqApiKey: "bad_key" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: () => Promise.resolve("401 Unauthorized"),
      }));

      await expect(
        client.complete({
          provider: "groq",
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: "hi" }],
        }),
      ).rejects.toThrow("401");
    });
  });

  describe("healthCheck", () => {
    it("returns down for unconfigured provider", async () => {
      const health = await client.healthCheck("groq");
      expect(health.status).toBe("down");
      expect(health.provider).toBe("groq");
    });

    it("returns healthy on successful response", async () => {
      client.configure({ groqApiKey: "gsk_test" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

      const health = await client.healthCheck("groq");
      expect(health.status).toBe("healthy");
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getStats", () => {
    it("tracks request count and tokens", async () => {
      client.configure({ groqApiKey: "gsk_test" });

      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: "x" }, finish_reason: "stop" }],
          model: "test",
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      }));

      await client.complete({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "test" }],
      });

      const stats = client.getStats();
      expect(stats.requestCount).toBe(1);
      expect(stats.totalTokens).toBe(15);
    });

    it("resets stats", async () => {
      client.configure({ groqApiKey: "gsk_test" });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          choices: [{ message: { content: "x" }, finish_reason: "stop" }],
          model: "test",
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      }));

      await client.complete({
        provider: "groq",
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: "test" }],
      });

      client.resetStats();
      expect(client.getStats().requestCount).toBe(0);
      expect(client.getStats().totalTokens).toBe(0);
    });
  });

  describe("factory", () => {
    it("creates client without credentials", () => {
      const c = createAIProviderClient();
      expect(c.getConfiguredProviders()).toEqual([]);
    });

    it("creates client with credentials", () => {
      const c = createAIProviderClient({ groqApiKey: "gsk_x" });
      expect(c.isConfigured("groq")).toBe(true);
    });
  });
});
