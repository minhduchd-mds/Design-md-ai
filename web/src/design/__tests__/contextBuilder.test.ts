import { describe, expect, it, vi } from "vitest";
import { buildContext, parseFileSources } from "../contextBuilder";

describe("parseFileSources", () => {
  it("reads markdown files into doc sources", async () => {
    const file = new File(["# PRD\nContent"], "prd.md", { type: "text/markdown" });

    await expect(parseFileSources([file])).resolves.toEqual([
      {
        filename: "prd.md",
        content: "# PRD\nContent",
        type: "md",
      },
    ]);
  });
});

describe("buildContext", () => {
  it("uses bootstrap suggestions when no components are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          content: [{ type: "text", text: '["Button","Input","Card"]' }],
        }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("VITE_ANTHROPIC_API_KEY", "test-key");

    const context = await buildContext({
      pluginScanResult: [],
      uploadedFiles: [],
      textPrompt: "Build a CRM dashboard",
    });

    expect(context.bootstrapSuggestions).toEqual(["Button", "Input", "Card"]);
    expect(fetchMock).toHaveBeenCalledOnce();

    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
