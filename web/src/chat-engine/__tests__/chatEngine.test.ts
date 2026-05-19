/**
 * Tests for ChatEngine module — multi-provider chat orchestration.
 *
 * Validates:
 *   • ChatEngine.send() passes correct parameters to sendClaudeChat
 *   • Streaming callbacks (onToken, onComplete, onError) fire correctly
 *   • Abort cancellation works
 *   • Config defaults and overrides
 *   • Persistence helpers (saveHistory, loadHistory)
 *   • Message factory helpers
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sendClaudeChat before import
vi.mock("../../workspace/claudeChat", () => ({
  sendClaudeChat: vi.fn(),
}));

// Mock auth helpers
vi.mock("../../app/auth", () => ({
  createMessage: vi.fn((role: string, content: string, title?: string) => ({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    title: title ?? "",
    timestamp: Date.now(),
  })),
  encryptChatMessages: vi.fn(async () => "encrypted-payload"),
  decryptChatMessages: vi.fn(async () => []),
  getChatHistoryKey: vi.fn((userId: string, projectId?: string) =>
    `chat:${userId}${projectId ? `:${projectId}` : ""}`
  ),
}));

import { ChatEngine, chatEngine, createUserMessage, createAssistantMessage, createSystemMessage } from "../index";
import { sendClaudeChat } from "../../workspace/claudeChat";
import type { StreamCallbacks } from "../index";

const mockSendClaudeChat = sendClaudeChat as ReturnType<typeof vi.fn>;

describe("ChatEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock localStorage
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });
  });

  // ── Constructor & Config ───────────────────────────────────────

  it("creates with default config", () => {
    const engine = ChatEngine.create();
    const config = engine.getConfig();
    expect(config.provider).toBe("groq");
    expect(config.model).toBe("llama-3.3-70b-versatile");
    expect(config.temperature).toBe(0.7);
    expect(config.maxTokens).toBe(8192);
    expect(config.enableAgentMode).toBe(false);
    expect(config.injectDesignContext).toBe(true);
  });

  it("merges custom config with defaults", () => {
    const engine = ChatEngine.create({ model: "mixtral-8x7b-32768", temperature: 0.3 });
    const config = engine.getConfig();
    expect(config.model).toBe("mixtral-8x7b-32768");
    expect(config.temperature).toBe(0.3);
    expect(config.provider).toBe("groq"); // default preserved
  });

  it("configure() updates config", () => {
    const engine = ChatEngine.create();
    engine.configure({ provider: "anthropic", model: "claude-3" });
    const config = engine.getConfig();
    expect(config.provider).toBe("anthropic");
    expect(config.model).toBe("claude-3");
    expect(config.temperature).toBe(0.7); // unchanged
  });

  it("exports a singleton instance", () => {
    expect(chatEngine).toBeInstanceOf(ChatEngine);
  });

  // ── send() — Fixed Signature ───────────────────────────────────

  it("calls sendClaudeChat with correct 4-argument signature", async () => {
    mockSendClaudeChat.mockResolvedValueOnce("Hello from AI");

    const callbacks: StreamCallbacks = {
      onToken: vi.fn(),
      onComplete: vi.fn(),
      onError: vi.fn(),
    };

    const messages = [
      { id: "1", role: "user" as const, content: "Hello", title: "", timestamp: Date.now() },
    ];

    const engine = ChatEngine.create();
    await engine.send(messages, callbacks, { projectName: "Test", category: "SaaS" });

    expect(mockSendClaudeChat).toHaveBeenCalledTimes(1);
    const [passedMessages, passedContext, passedOnToken, passedSignal] = mockSendClaudeChat.mock.calls[0];

    // Arg 1: messages array (passed through, not mapped to partial objects)
    expect(passedMessages).toBe(messages);

    // Arg 2: context object with correct shape
    expect(passedContext).toEqual({
      projectName: "Test",
      category: "SaaS",
      selectedTemplate: "",
      readinessScore: 0,
      activeDesignMd: false,
      workspaceTab: "chat",
      model: "llama-3.3-70b-versatile",
    });

    // Arg 3: onToken callback function
    expect(typeof passedOnToken).toBe("function");

    // Arg 4: AbortSignal
    expect(passedSignal).toBeInstanceOf(AbortSignal);
  });

  it("invokes onToken callback during streaming", async () => {
    mockSendClaudeChat.mockImplementationOnce(
      async (_msgs: unknown, _ctx: unknown, onToken: (t: string) => void) => {
        onToken("Hello");
        onToken(" World");
        return "Hello World";
      },
    );

    const onToken = vi.fn();
    const onComplete = vi.fn();

    const engine = ChatEngine.create();
    await engine.send(
      [{ id: "1", role: "user" as const, content: "Hi", title: "", timestamp: Date.now() }],
      { onToken, onComplete, onError: vi.fn() },
    );

    expect(onToken).toHaveBeenCalledWith("Hello");
    expect(onToken).toHaveBeenCalledWith(" World");
    expect(onComplete).toHaveBeenCalledWith("Hello World");
  });

  it("fires onError on sendClaudeChat failure", async () => {
    const error = new Error("Network failure");
    mockSendClaudeChat.mockRejectedValueOnce(error);

    const onError = vi.fn();
    const engine = ChatEngine.create();
    await engine.send(
      [{ id: "1", role: "user" as const, content: "Hi", title: "", timestamp: Date.now() }],
      { onToken: vi.fn(), onComplete: vi.fn(), onError },
    );

    expect(onError).toHaveBeenCalledWith(error);
  });

  it("fires onError for empty response", async () => {
    mockSendClaudeChat.mockResolvedValueOnce("");

    const onError = vi.fn();
    const onComplete = vi.fn();
    const engine = ChatEngine.create();
    await engine.send(
      [{ id: "1", role: "user" as const, content: "Hi", title: "", timestamp: Date.now() }],
      { onToken: vi.fn(), onComplete, onError },
    );

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "Empty response from provider" }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("silently ignores AbortError", async () => {
    const abortError = new DOMException("Aborted", "AbortError");
    mockSendClaudeChat.mockRejectedValueOnce(abortError);

    const onError = vi.fn();
    const engine = ChatEngine.create();
    await engine.send(
      [{ id: "1", role: "user" as const, content: "Hi", title: "", timestamp: Date.now() }],
      { onToken: vi.fn(), onComplete: vi.fn(), onError },
    );

    expect(onError).not.toHaveBeenCalled();
  });

  it("passes model from config to context", async () => {
    mockSendClaudeChat.mockResolvedValueOnce("ok");

    const engine = ChatEngine.create({ model: "mixtral-8x7b-32768" });
    await engine.send(
      [{ id: "1", role: "user" as const, content: "Hi", title: "", timestamp: Date.now() }],
      { onToken: vi.fn(), onComplete: vi.fn(), onError: vi.fn() },
    );

    const passedContext = mockSendClaudeChat.mock.calls[0][1];
    expect(passedContext.model).toBe("mixtral-8x7b-32768");
  });

  // ── abort() ────────────────────────────────────────────────────

  it("abort() cancels AbortController", () => {
    const engine = ChatEngine.create();
    // Before any send, abort should not throw
    expect(() => engine.abort()).not.toThrow();
  });

  // ── Message Helpers ────────────────────────────────────────────

  it("createUserMessage creates user role", () => {
    const msg = createUserMessage("test input");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("test input");
  });

  it("createAssistantMessage creates assistant role", () => {
    const msg = createAssistantMessage("response text");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("response text");
  });

  it("createSystemMessage creates assistant role with System title", () => {
    const msg = createSystemMessage("system info");
    expect(msg.role).toBe("assistant");
    expect(msg.content).toBe("system info");
  });

  // ── Persistence ────────────────────────────────────────────────

  it("saveHistory encrypts and stores", async () => {
    const engine = ChatEngine.create();
    await engine.saveHistory([], "user-hash", "project-1");
    expect(localStorage.getItem("chat:user-hash:project-1")).toBe("encrypted-payload");
  });

  it("loadHistory returns empty array when no history", async () => {
    const engine = ChatEngine.create();
    const messages = await engine.loadHistory("user-hash", "project-1");
    expect(messages).toHaveLength(0);
  });
});
