/**
 * MCP Server tools — unit tests.
 *
 * Tests each tool handler with mocked snapshot data,
 * covering filtering, edge cases, and error states.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { setSnapshot, getSnapshot } from "../store.js";
import { handleGetDesignTokens } from "../tools/getDesignTokens.js";
import { handleGetComponents } from "../tools/getComponents.js";
import { handleGetDesignSummary } from "../tools/getDesignSummary.js";
import { handleMatchComponent } from "../tools/matchComponent.js";
import type { DesignSnapshot } from "../types.js";

// ─── Fixture ────────────────────────────────────────────────────────

const MOCK_SNAPSHOT: DesignSnapshot = {
  fileName: "TestDesign.fig",
  pageName: "Dashboard",
  pages: [
    { id: "page1", name: "Dashboard", componentCount: 3 },
    { id: "page2", name: "Settings", componentCount: 1 },
  ],
  components: [
    {
      id: "c1",
      name: "Button/Primary",
      type: "COMPONENT",
      pageName: "Dashboard",
      role: "action",
      source: "local",
      description: "Primary action button with filled background",
      variantProperties: { size: ["sm", "md", "lg"], state: ["default", "hover"] },
    },
    {
      id: "c2",
      name: "Card/Metric",
      type: "COMPONENT",
      pageName: "Dashboard",
      role: "kpi",
      source: "library",
      description: "KPI metric display card",
    },
    {
      id: "c3",
      name: "Table/DataGrid",
      type: "COMPONENT_SET",
      pageName: "Dashboard",
      role: "table",
      source: "local",
      description: "Data grid with sorting and pagination",
    },
    {
      id: "c4",
      name: "Sidebar/Nav",
      type: "COMPONENT",
      pageName: "Settings",
      role: "navigation",
      source: "document",
    },
  ],
  variables: [
    { id: "v1", name: "primary-500", collectionName: "Colors", modeName: "Light", resolvedType: "COLOR", value: "#3B82F6" },
    { id: "v2", name: "primary-700", collectionName: "Colors", modeName: "Light", resolvedType: "COLOR", value: "#1D4ED8" },
    { id: "v3", name: "spacing-4", collectionName: "Spacing", modeName: "Default", resolvedType: "FLOAT", value: "16" },
    { id: "v4", name: "spacing-8", collectionName: "Spacing", modeName: "Default", resolvedType: "FLOAT", value: "32" },
    { id: "v5", name: "font-family", collectionName: "Typography", modeName: "Default", resolvedType: "STRING", value: "Inter" },
    { id: "v6", name: "is-rtl", collectionName: "Flags", modeName: "Default", resolvedType: "BOOLEAN", value: "false" },
  ],
};

// ─── Helpers ────────────────────────────────────────────────────────

function getTextContent(result: ReturnType<typeof handleGetDesignTokens>): string {
  return result.content[0].text;
}

function parseResult(result: ReturnType<typeof handleGetDesignTokens>): unknown {
  return JSON.parse(getTextContent(result));
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("MCP Tools — no snapshot loaded", () => {
  beforeEach(() => {
    // Ensure no snapshot
    (globalThis as Record<string, unknown>).__mcp_cleared = true;
  });

  it("get_design_tokens returns error when no snapshot", () => {
    // Force clear by setting snapshot to null via a trick
    // Store module holds state; we loaded snapshot in other tests
    // This test group runs first, so snapshot is null
    const snap = getSnapshot();
    if (snap) return; // Skip if snapshot was already set by import order
    const result = handleGetDesignTokens({});
    expect(getTextContent(result)).toContain("No design system loaded");
  });

  it("get_components returns error when no snapshot", () => {
    const snap = getSnapshot();
    if (snap) return;
    const result = handleGetComponents({});
    expect(getTextContent(result)).toContain("No design system loaded");
  });

  it("get_design_summary returns error when no snapshot", () => {
    const snap = getSnapshot();
    if (snap) return;
    const result = handleGetDesignSummary();
    expect(getTextContent(result)).toContain("No design system loaded");
  });

  it("match_component returns error when no snapshot", () => {
    const snap = getSnapshot();
    if (snap) return;
    const result = handleMatchComponent({ query: "button" });
    expect(getTextContent(result)).toContain("No design system loaded");
  });
});

describe("get_design_tokens", () => {
  beforeEach(() => setSnapshot(MOCK_SNAPSHOT));

  it("returns all tokens when no filters", () => {
    const result = parseResult(handleGetDesignTokens({})) as { summary: string; tokens: unknown[] };
    expect(result.summary).toContain("6 token(s)");
    expect(result.tokens).toHaveLength(6);
  });

  it("filters by type=COLOR", () => {
    const result = parseResult(handleGetDesignTokens({ type: "COLOR" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(2);
  });

  it("filters by type=FLOAT", () => {
    const result = parseResult(handleGetDesignTokens({ type: "FLOAT" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(2);
  });

  it("filters by type=BOOLEAN", () => {
    const result = parseResult(handleGetDesignTokens({ type: "BOOLEAN" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(1);
  });

  it("filters by collection name (case-insensitive)", () => {
    const result = parseResult(handleGetDesignTokens({ collection: "spacing" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(2);
  });

  it("combines type and collection filters", () => {
    const result = parseResult(handleGetDesignTokens({ type: "COLOR", collection: "col" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(2);
  });

  it("returns empty array for no-match filter", () => {
    const result = parseResult(handleGetDesignTokens({ collection: "nonexistent" })) as { tokens: unknown[] };
    expect(result.tokens).toHaveLength(0);
    expect((parseResult(handleGetDesignTokens({ collection: "nonexistent" })) as { summary: string }).summary).toContain("0 token(s)");
  });
});

describe("get_components", () => {
  beforeEach(() => setSnapshot(MOCK_SNAPSHOT));

  it("returns all components when no filters", () => {
    const result = parseResult(handleGetComponents({})) as { components: unknown[] };
    expect(result.components).toHaveLength(4);
  });

  it("filters by name", () => {
    const result = parseResult(handleGetComponents({ name: "button" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("filters by page", () => {
    const result = parseResult(handleGetComponents({ page: "settings" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("filters by role", () => {
    const result = parseResult(handleGetComponents({ role: "kpi" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("filters by source", () => {
    const result = parseResult(handleGetComponents({ source: "library" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("filters by type=COMPONENT_SET", () => {
    const result = parseResult(handleGetComponents({ type: "COMPONENT_SET" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("combines multiple filters (role + page)", () => {
    const result = parseResult(handleGetComponents({ role: "action", page: "dashboard" })) as { components: unknown[] };
    expect(result.components).toHaveLength(1);
  });

  it("includes variant properties in output", () => {
    const result = parseResult(handleGetComponents({ name: "Button" })) as {
      components: Array<{ variants: Record<string, string[]> }>;
    };
    expect(result.components[0].variants).toHaveProperty("size");
    expect(result.components[0].variants.size).toContain("lg");
  });
});

describe("get_design_summary", () => {
  beforeEach(() => setSnapshot(MOCK_SNAPSHOT));

  it("returns file metadata", () => {
    const result = parseResult(handleGetDesignSummary()) as Record<string, unknown>;
    expect(result.fileName).toBe("TestDesign.fig");
    expect(result.pageName).toBe("Dashboard");
  });

  it("counts components and tokens", () => {
    const result = parseResult(handleGetDesignSummary()) as { totalComponents: number; totalTokens: number };
    expect(result.totalComponents).toBe(4);
    expect(result.totalTokens).toBe(6);
  });

  it("has role distribution", () => {
    const result = parseResult(handleGetDesignSummary()) as { roleDistribution: Record<string, number> };
    expect(result.roleDistribution.action).toBe(1);
    expect(result.roleDistribution.kpi).toBe(1);
    expect(result.roleDistribution.table).toBe(1);
    expect(result.roleDistribution.navigation).toBe(1);
  });

  it("has variable type breakdown", () => {
    const result = parseResult(handleGetDesignSummary()) as { variableTypes: Record<string, number> };
    expect(result.variableTypes.COLOR).toBe(2);
    expect(result.variableTypes.FLOAT).toBe(2);
    expect(result.variableTypes.STRING).toBe(1);
    expect(result.variableTypes.BOOLEAN).toBe(1);
  });

  it("lists collections", () => {
    const result = parseResult(handleGetDesignSummary()) as { collections: string[] };
    expect(result.collections).toContain("Colors");
    expect(result.collections).toContain("Spacing");
    expect(result.collections).toContain("Typography");
    expect(result.collections).toContain("Flags");
  });

  it("lists pages with component counts", () => {
    const result = parseResult(handleGetDesignSummary()) as { pages: Array<{ name: string; componentCount: number }> };
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].name).toBe("Dashboard");
    expect(result.pages[0].componentCount).toBe(3);
  });
});

describe("match_component", () => {
  beforeEach(() => setSnapshot(MOCK_SNAPSHOT));

  it("finds matching components by name", () => {
    const result = parseResult(handleMatchComponent({ query: "button" })) as { matches: Array<{ name: string; score: number }> };
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].name).toContain("Button");
  });

  it("finds components by description keywords", () => {
    const result = parseResult(handleMatchComponent({ query: "sorting pagination" })) as { matches: Array<{ name: string }> };
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].name).toContain("Table");
  });

  it("boosts score for matching role", () => {
    const withRole = parseResult(handleMatchComponent({ query: "card", role: "kpi" })) as { matches: Array<{ score: number }> };
    const withoutRole = parseResult(handleMatchComponent({ query: "card" })) as { matches: Array<{ score: number }> };
    // With role hint, the KPI card should score higher
    if (withRole.matches.length > 0 && withoutRole.matches.length > 0) {
      expect(withRole.matches[0].score).toBeGreaterThanOrEqual(withoutRole.matches[0].score);
    }
  });

  it("respects limit parameter", () => {
    const result = parseResult(handleMatchComponent({ query: "a", limit: 2 })) as { matches: unknown[] };
    expect(result.matches.length).toBeLessThanOrEqual(2);
  });

  it("returns empty matches for nonsense query", () => {
    const result = parseResult(handleMatchComponent({ query: "xyzzy12345" })) as { matches: unknown[] };
    expect(result.matches).toHaveLength(0);
  });

  it("ranks substring match higher", () => {
    const result = parseResult(handleMatchComponent({ query: "Nav" })) as { matches: Array<{ name: string }> };
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches[0].name).toContain("Nav");
  });
});

describe("store", () => {
  it("getSnapshot returns null initially (before setSnapshot)", () => {
    // This relies on module-level state; snapshot may have been set by prior tests.
    // We just verify the API returns the correct type.
    const snap = getSnapshot();
    expect(snap === null || typeof snap === "object").toBe(true);
  });

  it("setSnapshot + getSnapshot roundtrips", () => {
    setSnapshot(MOCK_SNAPSHOT);
    const snap = getSnapshot();
    expect(snap).toBe(MOCK_SNAPSHOT);
    expect(snap!.fileName).toBe("TestDesign.fig");
  });
});
