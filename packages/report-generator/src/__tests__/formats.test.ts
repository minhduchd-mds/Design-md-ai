/**
 * formats — Markdown / SARIF / CSV output tests.
 */

import { describe, it, expect } from "vitest";
import { generateMarkdown } from "../markdown.js";
import { generateSarif } from "../sarif.js";
import { generateCsv } from "../csv.js";
import type { AuditResult, AuditIssue } from "@desygn/audit-engine";

function issue(overrides: Partial<AuditIssue> = {}): AuditIssue {
  return {
    id: "i1",
    ruleId: "contrast.text",
    wcagCriterion: "1.4.3",
    category: "contrast",
    severity: "serious",
    nodeId: "n1",
    nodeName: "Body Text",
    nodeType: "TEXT",
    pageName: "Home",
    message: "Low contrast",
    expected: "≥ 4.5:1",
    observed: "3.0:1",
    ...overrides,
  };
}

function result(issues: AuditIssue[]): AuditResult {
  return {
    id: "audit-1",
    score: 87,
    issues,
    summary: {
      critical: issues.filter((i) => i.severity === "critical").length,
      serious: issues.filter((i) => i.severity === "serious").length,
      moderate: issues.filter((i) => i.severity === "moderate").length,
      minor: issues.filter((i) => i.severity === "minor").length,
      total: issues.length,
      byCategory: {
        contrast: issues.length,
        "touch-target": 0,
        aria: 0,
        keyboard: 0,
        heading: 0,
        motion: 0,
        semantic: 0,
      },
    },
    durationMs: 1234,
    wcagVersion: "2.2",
    wcagLevel: "AA",
    nodeCount: 10,
  };
}

describe("generateMarkdown", () => {
  it("includes score and WCAG version", () => {
    const md = generateMarkdown(result([issue()]));
    expect(md).toContain("87/100");
    expect(md).toContain("2.2 AA");
  });

  it("renders summary table counts", () => {
    const md = generateMarkdown(result([issue({ severity: "serious" })]));
    expect(md).toContain("| Serious | 1 |");
  });

  it("includes watermark only when requested", () => {
    const withMark = generateMarkdown(result([issue()]), { watermark: true });
    const without = generateMarkdown(result([issue()]), { watermark: false });
    expect(withMark).toContain("Powered by");
    expect(without).not.toContain("Powered by");
  });

  it("uses custom company name in heading", () => {
    const md = generateMarkdown(result([issue()]), { branding: { companyName: "Acme" } });
    expect(md).toContain("# Acme — Accessibility Audit Report");
  });

  it("renders fix suggestion steps", () => {
    const md = generateMarkdown(result([
      issue({ fixSuggestion: { summary: "Fix it", steps: ["Step A", "Step B"], autoFixable: false } }),
    ]));
    expect(md).toContain("Fix it");
    expect(md).toContain("Step A");
  });
});

describe("generateSarif", () => {
  it("produces valid SARIF 2.1.0 envelope", () => {
    const sarif = generateSarif(result([issue()]));
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.$schema).toContain("sarif");
    expect(sarif.runs).toHaveLength(1);
  });

  it("declares the tool driver", () => {
    const sarif = generateSarif(result([issue()]));
    expect(sarif.runs[0].tool.driver.name).toBe("Desygn A11y");
  });

  it("emits one result per issue", () => {
    const sarif = generateSarif(result([issue({ id: "a" }), issue({ id: "b" })]));
    expect(sarif.runs[0].results).toHaveLength(2);
  });

  it("dedupes rules in the driver", () => {
    const sarif = generateSarif(result([
      issue({ id: "a", ruleId: "contrast.text" }),
      issue({ id: "b", ruleId: "contrast.text" }),
    ]));
    expect(sarif.runs[0].tool.driver.rules).toHaveLength(1);
  });

  it("maps serious/critical to error level", () => {
    const sarif = generateSarif(result([issue({ severity: "critical" })]));
    expect(sarif.runs[0].results[0].level).toBe("error");
  });

  it("maps minor to note level", () => {
    const sarif = generateSarif(result([issue({ severity: "minor" })]));
    expect(sarif.runs[0].results[0].level).toBe("note");
  });
});

describe("generateCsv", () => {
  it("emits a header row", () => {
    const csv = generateCsv(result([]));
    expect(csv.split("\r\n")[0]).toContain("issue_id");
  });

  it("emits one data row per issue", () => {
    const csv = generateCsv(result([issue(), issue({ id: "i2" })]));
    expect(csv.split("\r\n")).toHaveLength(3); // header + 2
  });

  it("escapes fields containing commas", () => {
    const csv = generateCsv(result([issue({ message: "a, b, c" })]));
    expect(csv).toContain('"a, b, c"');
  });

  it("escapes double quotes by doubling", () => {
    const csv = generateCsv(result([issue({ message: 'say "hi"' })]));
    expect(csv).toContain('"say ""hi"""');
  });
});
