import { describe, expect, it } from "vitest";
import { createEmptyContext } from "../../../../shared/designContext";
import type { DesignMdTemplateMeta } from "../templateRegistry";
import { matchTemplates, scoreTemplate } from "../templateMatcher";

const mockMeta: DesignMdTemplateMeta = {
  id: "dashboard-template",
  label: "Dashboard Template",
  category: "Developer",
  priority: "Technical",
  keywords: ["dashboard", "table", "button"],
};

describe("scoreTemplate", () => {
  it("scores prompt, docs, component, and bootstrap matches", () => {
    const context = createEmptyContext();
    context.prompt = "Build a developer dashboard with a table";
    context.docs = [{ filename: "prd.md", content: "Developer workflow", type: "md" }];
    context.components = [{ id: "1", name: "Button", type: "COMPONENT" }];
    context.bootstrapSuggestions = ["Button"];

    const match = scoreTemplate(context, mockMeta);

    expect(match.templateId).toBe("dashboard-template");
    expect(match.score).toBeGreaterThanOrEqual(85);
    expect(match.matchReason).toContain("prompt");
  });

  it("does not match one-letter template fragments against arbitrary prompt text", () => {
    const context = createEmptyContext();
    context.prompt = "Create BA workflow screens for automated agent management.";

    const match = scoreTemplate(context, {
      id: "bmw-m",
      label: "BMW M",
      category: "Automotive",
      priority: "Product",
      keywords: ["bmw", "m", "automotive", "product"],
    });

    expect(match.score).toBe(15);
    expect(match.matchReason).not.toContain("prompt matched");
  });
});

describe("matchTemplates", () => {
  it("returns exactly 3 templates sorted by score descending", () => {
    const context = createEmptyContext();
    context.prompt = "AI developer dashboard";
    context.components = [{ id: "1", name: "Button", type: "COMPONENT" }];

    const matches = matchTemplates(context);

    expect(matches).toHaveLength(3);
    expect(matches[0].score).toBeGreaterThanOrEqual(matches[1].score);
    expect(matches[1].score).toBeGreaterThanOrEqual(matches[2].score);
  });

  it("prefers product templates in bootstrap mode", () => {
    const context = createEmptyContext();
    context.prompt = "Create a consumer product site";

    const productMeta: DesignMdTemplateMeta = {
      id: "product",
      label: "Product",
      category: "Product",
      priority: "Product",
      keywords: ["product"],
    };
    const technicalMeta: DesignMdTemplateMeta = {
      id: "technical",
      label: "Technical",
      category: "Developer",
      priority: "Technical",
      keywords: ["developer"],
    };

    expect(scoreTemplate(context, productMeta).score).toBeGreaterThan(scoreTemplate(context, technicalMeta).score);
  });
});
