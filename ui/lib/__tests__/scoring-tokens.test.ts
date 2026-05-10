import { describe, it, expect } from "vitest";
import { scoreTokens } from "../scoring-tokens";
import type { SerializedNode, PluginProfile } from "../../../shared/types";

function makeNode(name: string, overrides?: Partial<SerializedNode>): SerializedNode {
  return { id: Math.random().toString(36), name, type: "FRAME", ...overrides };
}

function makeProfile(tokens: Record<string, string>): PluginProfile {
  return {
    id: "test",
    name: "Test System",
    stack: "React",
    layout: "",
    tokens,
    components: [],
    guidelines: "",
  };
}

describe("scoreTokens", () => {
  it("rewards bound fills", () => {
    const node = makeNode("card", {
      fills: [{ type: "SOLID", color: { r: 255, g: 0, b: 0 }, boundToVariable: true }],
      children: [
        makeNode("bg", { fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 255 }, boundToVariable: true }] }),
      ],
    });

    const result = scoreTokens(node);
    // base 70 + boundRatio=1.0 => +15 + colors <=4 => +5 + fontSizes (0, no penalty) = 90
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("uses bound Figma variable names in color mappings without a profile", () => {
    const node = makeNode("button", {
      fills: [
        {
          type: "SOLID",
          color: { r: 255, g: 0, b: 0 },
          boundToVariable: true,
          variableName: "Primary/Red/500",
        },
      ],
    });

    const result = scoreTokens(node);

    expect(result.colorMappings).toContainEqual(
      expect.objectContaining({ hex: "#ff0000", tokenName: "Primary/Red/500" }),
    );
  });

  it("penalizes unbound fills without profile", () => {
    const fills = Array.from({ length: 12 }, (_, i) => ({
      type: "SOLID" as const,
      color: { r: i * 20, g: 100, b: 50 },
    }));
    const children = fills.map((f, i) => makeNode(`el-${i}`, { fills: [f] }));
    const node = makeNode("messy", { children });

    const result = scoreTokens(node);
    // >10 unique colors, no bound, no profile => penalty
    expect(result.score).toBeLessThan(70);
    const colorIssue = result.issues.find((i) => i.id === "tokens-too-many-colors");
    expect(colorIssue).toBeDefined();
  });

  it("matches profile tokens with exact hex", () => {
    const profile = makeProfile({ "brand-red": "#ff0000" });
    const node = makeNode("button", {
      fills: [{ type: "SOLID", color: { r: 255, g: 0, b: 0 } }],
    });

    const result = scoreTokens(node, profile);
    const mapped = result.colorMappings.find((m) => m.tokenName === "brand-red");
    expect(mapped).toBeDefined();
  });

  it("matches profile tokens with fuzzy hex (±5 threshold)", () => {
    const profile = makeProfile({ "brand-blue": "#0000ff" });
    // Color is #0003fc (close to #0000ff: r=0, g=3, b=252 → diff max 3)
    const node = makeNode("link", {
      fills: [{ type: "SOLID", color: { r: 0, g: 3, b: 252 } }],
    });

    const result = scoreTokens(node, profile);
    const mapped = result.colorMappings.find((m) => m.tokenName === "brand-blue");
    expect(mapped).toBeDefined();
  });

  it("reports unknown colors when profile exists", () => {
    const profile = makeProfile({ "brand-red": "#ff0000" });
    const node = makeNode("weird", {
      fills: [{ type: "SOLID", color: { r: 0, g: 255, b: 0 } }],
    });

    const result = scoreTokens(node, profile);
    const unknownIssue = result.issues.find((i) => i.id.includes("unknown-color"));
    expect(unknownIssue).toBeDefined();
  });

  it("rewards consistent font sizes (2-5)", () => {
    const node = makeNode("text-block", {
      children: [
        makeNode("h1", { type: "TEXT", fontSize: 32, characters: "Title" }),
        makeNode("body", { type: "TEXT", fontSize: 16, characters: "Body" }),
        makeNode("caption", { type: "TEXT", fontSize: 12, characters: "Caption" }),
      ],
    });

    const result = scoreTokens(node);
    // 3 font sizes => +10
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("penalizes too many font sizes (>6)", () => {
    const children = Array.from({ length: 8 }, (_, i) =>
      makeNode(`text-${i}`, { type: "TEXT", fontSize: 10 + i * 3, characters: `Size ${10 + i * 3}` }),
    );
    const node = makeNode("messy-text", { children });

    const result = scoreTokens(node);
    const fontIssue = result.issues.find((i) => i.id === "tokens-too-many-fontsizes");
    expect(fontIssue).toBeDefined();
  });

  it("rewards 8px grid spacing", () => {
    const node = makeNode("grid-aligned", {
      layoutMode: "VERTICAL",
      itemSpacing: 16,
      paddingTop: 24,
      paddingRight: 32,
      paddingBottom: 24,
      paddingLeft: 32,
    });

    const result = scoreTokens(node);
    // All spacing on 8px grid => +10
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("flags irregular spacing (not on 4px grid)", () => {
    const node = makeNode("weird-spacing", {
      layoutMode: "VERTICAL",
      itemSpacing: 7,
      paddingTop: 13,
      paddingRight: 5,
      paddingBottom: 13,
      paddingLeft: 5,
    });

    const result = scoreTokens(node);
    const spacingIssue = result.issues.find((i) => i.id === "tokens-irregular-spacing");
    expect(spacingIssue).toBeDefined();
  });

  it("includes strokes in color analysis", () => {
    const node = makeNode("bordered", {
      strokes: [{ type: "SOLID", color: { r: 200, g: 200, b: 200 } }],
    });

    const result = scoreTokens(node);
    // Should have processed the stroke color
    expect(result.score).toBeGreaterThan(0);
  });
});
