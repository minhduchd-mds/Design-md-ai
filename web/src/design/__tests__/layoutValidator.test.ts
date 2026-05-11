import { describe, expect, it } from "vitest";
import { createEmptyContext } from "../../../../shared/designContext";
import { computeValidationReport, validateComponents, validateNaming } from "../layoutValidator";

describe("layoutValidator", () => {
  it("detects missing required components for a template category", () => {
    const context = createEmptyContext();
    context.components = [{ id: "1", name: "Button", type: "COMPONENT" }];

    const result = validateComponents(context, "ba-agent-workflow");

    expect(result.missing.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("scores valid component naming", () => {
    const context = createEmptyContext();
    context.components = [{ id: "1", name: "ButtonPrimary", type: "COMPONENT" }];

    expect(validateNaming(context).score).toBe(100);
  });

  it("computes a weighted validation report", () => {
    const context = createEmptyContext();
    context.components = [
      {
        id: "1",
        name: "Button",
        type: "COMPONENT",
        fills: [{ type: "SOLID", variableName: "color-primary", boundToVariable: true }],
      },
    ];

    const report = computeValidationReport(context, "ba-agent-workflow");

    expect(report.readinessScore).toBeGreaterThanOrEqual(0);
    expect(report.canProceed).toBe(report.readinessScore >= 60);
  });
});
