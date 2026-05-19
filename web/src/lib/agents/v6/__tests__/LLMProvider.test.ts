/**
 * Tests for LLMProvider — Tier 2 LLM abstraction layer.
 */

import { describe, it, expect, vi } from "vitest";
import {
  StubLLMProvider,
  GroqLLMProvider,
  createLLMProvider,
  defaultLLMProvider,
} from "../LLMProvider";
import type { LLMStreamCallbacks } from "../LLMProvider";

describe("StubLLMProvider", () => {
  const stub = new StubLLMProvider();

  it("has correct name", () => {
    expect(stub.name).toBe("stub");
  });

  it("is always available", () => {
    expect(stub.isAvailable).toBe(true);
  });

  it("complete returns deterministic stub response", async () => {
    const res = await stub.complete({ prompt: "hello world" });
    expect(res.text).toContain("[LLM stub]");
    expect(res.text).toContain("hello world");
    expect(res.tokensUsed).toBe(0);
    expect(res.costUsd).toBe(0);
    expect(res.model).toBe("stub");
    expect(res.finishReason).toBe("stop");
  });

  it("complete truncates long prompts in response", async () => {
    const longPrompt = "x".repeat(200);
    const res = await stub.complete({ prompt: longPrompt });
    expect(res.text.length).toBeLessThan(200);
  });

  it("stream fires onToken and onComplete", async () => {
    const onToken = vi.fn();
    const onComplete = vi.fn();
    const callbacks: LLMStreamCallbacks = { onToken, onComplete, onError: vi.fn() };

    await stub.stream({ prompt: "test" }, callbacks);

    expect(onToken).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].model).toBe("stub");
  });

  it("estimateCost returns 0", () => {
    expect(stub.estimateCost(1000, 1000)).toBe(0);
  });
});

describe("GroqLLMProvider", () => {
  it("has correct name", () => {
    const provider = new GroqLLMProvider();
    expect(provider.name).toBe("groq");
  });

  it("isAvailable is true when fetch exists", () => {
    const provider = new GroqLLMProvider();
    expect(provider.isAvailable).toBe(true);
  });

  it("estimateCost calculates based on token counts", () => {
    const provider = new GroqLLMProvider();
    const cost = provider.estimateCost(1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(0.01); // Groq is cheap
  });

  it("estimateCost scales with token count", () => {
    const provider = new GroqLLMProvider();
    const small = provider.estimateCost(100, 100);
    const large = provider.estimateCost(10000, 10000);
    expect(large).toBeGreaterThan(small);
  });

  it("accepts custom apiBase", () => {
    const provider = new GroqLLMProvider("https://custom.api");
    expect(provider.name).toBe("groq");
  });
});

describe("createLLMProvider", () => {
  it("returns GroqLLMProvider when fetch is available", () => {
    const provider = createLLMProvider();
    expect(provider.name).toBe("groq");
  });

  it("passes apiBase to provider", () => {
    const provider = createLLMProvider("/custom");
    expect(provider.isAvailable).toBe(true);
  });
});

describe("defaultLLMProvider", () => {
  it("uses the best available provider (Groq when fetch exists)", () => {
    // In Node/Vitest environments, fetch is available → GroqLLMProvider
    // In environments without fetch → StubLLMProvider
    expect(["stub", "groq"]).toContain(defaultLLMProvider.name);
    expect(defaultLLMProvider.isAvailable).toBe(true);
  });
});
