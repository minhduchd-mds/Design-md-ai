/**
 * rules — unit tests for all 7 WCAG audit rules.
 *
 * Each rule is a pure function over AuditInput. Tests cover the
 * detect/pass boundary and severity assignment.
 */

import { describe, it, expect } from "vitest";
import { contrastRule } from "../rules/contrast.js";
import { touchTargetRule } from "../rules/touch-target.js";
import { ariaRule } from "../rules/aria.js";
import { keyboardRule } from "../rules/keyboard.js";
import { headingRule } from "../rules/heading.js";
import { motionRule } from "../rules/motion.js";
import { semanticRule } from "../rules/semantic.js";
import { DEFAULT_RULES } from "../rules/index.js";
import type { AuditInput, AuditNode } from "../types.js";

function input(nodes: AuditNode[], wcagLevel: "A" | "AA" | "AAA" = "AA"): AuditInput {
  return { nodes, options: { wcagVersion: "2.2", wcagLevel } };
}

async function run(rule: { evaluate: (i: AuditInput) => unknown }, i: AuditInput) {
  return (await rule.evaluate(i)) as { issues: unknown[] };
}

describe("DEFAULT_RULES", () => {
  it("exports exactly 7 rules", () => {
    expect(DEFAULT_RULES).toHaveLength(7);
  });

  it("each rule has a unique id", () => {
    const ids = DEFAULT_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(7);
  });

  it("each rule maps to a WCAG criterion", () => {
    for (const rule of DEFAULT_RULES) {
      expect(rule.wcagCriterion).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });
});

describe("contrastRule", () => {
  it("flags text below AA threshold (4.5)", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "Hello", contrastRatio: 3.0 },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("passes text at/above AA threshold", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "Hello", contrastRatio: 4.5 },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("uses 7:1 for AAA", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "Hello", contrastRatio: 5.0 },
    ], "AAA"));
    expect(r.issues).toHaveLength(1);
  });

  it("ignores nodes with no contrastRatio", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "Hello" },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("ignores empty text nodes", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "   ", contrastRatio: 1.0 },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("escalates to critical when far below threshold", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "x", contrastRatio: 2.0 },
    ]));
    expect((r.issues[0] as { severity: string }).severity).toBe("critical");
  });

  it("applies the lower large-text threshold (3:1 AA) for big fonts", async () => {
    // 3.5:1 fails normal (4.5) but passes large (3.0)
    const r = await run(contrastRule, input([
      { id: "t1", name: "Heading", type: "TEXT", text: "Big", contrastRatio: 3.5, fontSize: 32, fontWeight: 400 },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("treats 14pt+ bold as large text", async () => {
    // 19px bold → large → 3.0 threshold → 3.5 passes
    const r = await run(contrastRule, input([
      { id: "t1", name: "Bold", type: "TEXT", text: "Hi", contrastRatio: 3.5, fontSize: 19, fontWeight: 700 },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("still flags large text below the large threshold", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Heading", type: "TEXT", text: "Big", contrastRatio: 2.5, fontSize: 32 },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("reports 1.4.6 criterion under AAA", async () => {
    const r = await run(contrastRule, input([
      { id: "t1", name: "Body", type: "TEXT", text: "x", contrastRatio: 5.0 },
    ], "AAA"));
    expect((r.issues[0] as { wcagCriterion: string }).wcagCriterion).toBe("1.4.6");
  });
});

describe("touchTargetRule", () => {
  it("flags interactive element below 24px", async () => {
    const r = await run(touchTargetRule, input([
      { id: "b1", name: "Button", type: "INSTANCE", hasInteractions: true, width: 20, height: 20 },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("passes interactive element at 24px (AA)", async () => {
    const r = await run(touchTargetRule, input([
      { id: "b1", name: "Button", type: "INSTANCE", hasInteractions: true, width: 24, height: 24 },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("requires 44px for AAA", async () => {
    const r = await run(touchTargetRule, input([
      { id: "b1", name: "Button", type: "INSTANCE", hasInteractions: true, width: 30, height: 30 },
    ], "AAA"));
    expect(r.issues).toHaveLength(1);
  });

  it("ignores non-interactive nodes", async () => {
    const r = await run(touchTargetRule, input([
      { id: "b1", name: "Box", type: "RECTANGLE", hasInteractions: false, width: 5, height: 5 },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});

describe("ariaRule", () => {
  it("flags interactive element with no role", async () => {
    const r = await run(ariaRule, input([
      { id: "b1", name: "thing", type: "FRAME", hasInteractions: true, inferredRole: "unknown", text: "Click" },
    ]));
    expect(r.issues.some((i) => (i as { wcagCriterion: string }).wcagCriterion === "1.3.1")).toBe(true);
  });

  it("flags interactive element with no accessible name", async () => {
    const r = await run(ariaRule, input([
      { id: "b1", name: "", type: "FRAME", hasInteractions: true, inferredRole: "button" },
    ]));
    expect(r.issues.some((i) => (i as { severity: string }).severity === "critical")).toBe(true);
  });

  it("passes interactive element with role + name", async () => {
    const r = await run(ariaRule, input([
      { id: "b1", name: "Submit", type: "INSTANCE", hasInteractions: true, inferredRole: "button" },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});

describe("keyboardRule", () => {
  it("flags non-component interactive element", async () => {
    const r = await run(keyboardRule, input([
      { id: "b1", name: "btn", type: "FRAME", hasInteractions: true },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("passes component interactive element", async () => {
    const r = await run(keyboardRule, input([
      { id: "b1", name: "btn", type: "COMPONENT", hasInteractions: true },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});

describe("headingRule", () => {
  it("flags page with no H1", async () => {
    const r = await run(headingRule, input([
      { id: "h1", name: "Title", type: "TEXT", headingLevel: 2, pageName: "Home" },
    ]));
    expect(r.issues.some((i) => (i as { message: string }).message.includes("no H1"))).toBe(true);
  });

  it("flags skipped heading level (H1 → H3)", async () => {
    const r = await run(headingRule, input([
      { id: "h1", name: "A", type: "TEXT", headingLevel: 1, pageName: "Home" },
      { id: "h3", name: "B", type: "TEXT", headingLevel: 3, pageName: "Home" },
    ]));
    expect(r.issues.some((i) => (i as { message: string }).message.includes("skips"))).toBe(true);
  });

  it("passes well-formed hierarchy", async () => {
    const r = await run(headingRule, input([
      { id: "h1", name: "A", type: "TEXT", headingLevel: 1, pageName: "Home" },
      { id: "h2", name: "B", type: "TEXT", headingLevel: 2, pageName: "Home" },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("ignores non-heading nodes", async () => {
    const r = await run(headingRule, input([
      { id: "t1", name: "Body", type: "TEXT", pageName: "Home" },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});

describe("motionRule", () => {
  it("flags animated non-component", async () => {
    const r = await run(motionRule, input([
      { id: "m1", name: "Banner", type: "FRAME", hasMotion: true },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("passes animated component", async () => {
    const r = await run(motionRule, input([
      { id: "m1", name: "Banner", type: "COMPONENT", hasMotion: true },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("ignores static nodes", async () => {
    const r = await run(motionRule, input([
      { id: "m1", name: "Banner", type: "FRAME", hasMotion: false },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});

describe("semanticRule", () => {
  it("flags interactive RECTANGLE", async () => {
    const r = await run(semanticRule, input([
      { id: "s1", name: "fake-btn", type: "RECTANGLE", hasInteractions: true },
    ]));
    expect(r.issues).toHaveLength(1);
  });

  it("passes interactive COMPONENT", async () => {
    const r = await run(semanticRule, input([
      { id: "s1", name: "btn", type: "COMPONENT", hasInteractions: true },
    ]));
    expect(r.issues).toHaveLength(0);
  });

  it("ignores non-interactive shapes", async () => {
    const r = await run(semanticRule, input([
      { id: "s1", name: "decoration", type: "ELLIPSE", hasInteractions: false },
    ]));
    expect(r.issues).toHaveLength(0);
  });
});
