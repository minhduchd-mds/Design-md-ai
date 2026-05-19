import { describe, it, expect } from "vitest";
import {
  defineAgent,
  defineCheck,
  defineCriterion,
  definePlugin,
} from "../helpers";

describe("@desygn/sdk — helpers", () => {
  // ────────────────────────────────────────────────────────────────────
  // defineCriterion
  // ────────────────────────────────────────────────────────────────────

  describe("defineCriterion", () => {
    it("returns the criterion when valid", () => {
      const c = defineCriterion({
        id: "test.spacing",
        name: "Spacing",
        description: "Spacing rules",
        category: "tokens",
        severity: "medium",
        source: "custom",
        tags: ["spacing"],
      });
      expect(c.id).toBe("test.spacing");
      expect(c.tags).toEqual(["spacing"]);
    });

    it("throws on missing required fields", () => {
      expect(() =>
        defineCriterion({
          id: "test.spacing",
          // missing name/description/severity/source/category
        } as unknown as Parameters<typeof defineCriterion>[0]),
      ).toThrow(/Invalid criterion/);
    });

    it("throws on invalid severity", () => {
      expect(() =>
        defineCriterion({
          id: "test.spacing",
          name: "x",
          description: "y",
          category: "tokens",
          severity: "ULTRA-CRITICAL" as never,
          source: "custom",
          tags: [],
        }),
      ).toThrow(/Invalid criterion/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // defineCheck
  // ────────────────────────────────────────────────────────────────────

  describe("defineCheck", () => {
    it("returns the check when valid", () => {
      const ch = defineCheck({
        criterionId: "test.x",
        check: () => ({ checkId: "test.x", status: "pass", score: 1 }),
      });
      expect(ch.criterionId).toBe("test.x");
    });

    it("throws when criterionId is missing", () => {
      expect(() =>
        defineCheck({
          criterionId: "",
          check: () => ({ checkId: "x", status: "pass", score: 1 }),
        }),
      ).toThrow(/criterionId is required/);
    });

    it("throws when check is not a function", () => {
      expect(() =>
        defineCheck({
          criterionId: "test.x",
          check: "not-a-function" as never,
        }),
      ).toThrow(/check must be a function/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // defineAgent
  // ────────────────────────────────────────────────────────────────────

  describe("defineAgent", () => {
    it("returns the agent when valid", () => {
      const a = defineAgent({
        id: "myorg.my-agent",
        name: "My Agent",
        role: "audit",
        execute: async () => ({ success: true, output: {} }),
      });
      expect(a.id).toBe("myorg.my-agent");
    });

    it("throws when id is not namespaced", () => {
      expect(() =>
        defineAgent({
          id: "no-namespace",
          name: "X",
          role: "audit",
          execute: async () => ({ success: true, output: {} }),
        }),
      ).toThrow(/must be namespaced/);
    });

    it("throws when execute is not a function", () => {
      expect(() =>
        defineAgent({
          id: "myorg.x",
          name: "X",
          role: "audit",
          execute: "broken" as never,
        }),
      ).toThrow(/execute must be a function/);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // definePlugin
  // ────────────────────────────────────────────────────────────────────

  describe("definePlugin", () => {
    it("returns the plugin when valid (no contributions)", () => {
      const p = definePlugin({
        id: "myorg.empty",
        name: "Empty",
        version: "1.0.0",
        description: "x",
        author: "x",
        contributes: {},
      });
      expect(p.id).toBe("myorg.empty");
    });

    it("validates nested criteria", () => {
      expect(() =>
        definePlugin({
          id: "myorg.bad",
          name: "Bad",
          version: "1.0.0",
          description: "x",
          author: "x",
          contributes: {
            criteria: [
              {
                id: "myorg.bad-criterion",
                // missing required fields
              } as unknown as Parameters<typeof defineCriterion>[0],
            ],
          },
        }),
      ).toThrow(/Invalid criterion/);
    });

    it("throws on invalid semver", () => {
      expect(() =>
        definePlugin({
          id: "myorg.x",
          name: "X",
          version: "not-semver",
          description: "x",
          author: "x",
          contributes: {},
        }),
      ).toThrow(/valid semver/);
    });

    it("throws when id is not namespaced", () => {
      expect(() =>
        definePlugin({
          id: "nodot",
          name: "X",
          version: "1.0.0",
          description: "x",
          author: "x",
          contributes: {},
        }),
      ).toThrow(/must be namespaced/);
    });
  });
});
