/**
 * Integration — full audit pipeline end-to-end.
 *
 * Proves the three packages compose into the core product flow:
 *
 *   Figma document JSON
 *     → transformFigmaToAuditNodes  (@desygn/figma-rest-adapter)
 *     → createDefaultEngine().run    (@desygn/audit-engine)
 *     → generateMarkdown / Sarif     (@desygn/report-generator)
 *     → signReport                   (@desygn/report-generator)
 *
 * Uses a hand-built fixture (no network) with deliberate violations so
 * the assertions are deterministic.
 */

import { describe, it, expect } from "vitest";
import { createDefaultEngine } from "@desygn/audit-engine";
import { transformFigmaToAuditNodes } from "@desygn/figma-rest-adapter";
import { generateMarkdown } from "../markdown.js";
import { generateSarif } from "../sarif.js";
import { signReport, verifyReport } from "../signer.js";

const SECRET = "integration-test-secret-key-padding!";

// A Figma document with deliberate a11y violations:
//  - low-contrast text (dark gray on white ≈ 3.5:1, fails normal AA 4.5)
//  - a tiny interactive rectangle (fails touch-target + semantic)
//  - a heading that skips H1 → H3
const FIXTURE = {
  type: "DOCUMENT",
  children: [
    {
      id: "0:1",
      name: "Home",
      type: "CANVAS",
      backgroundColor: { r: 1, g: 1, b: 1 }, // white page
      children: [
        {
          id: "1:1",
          name: "Body copy",
          type: "TEXT",
          characters: "Hard to read",
          style: { fontSize: 14, fontWeight: 400 },
          // mid-gray (#888) on white ≈ 3.5:1
          fills: [{ type: "SOLID", color: { r: 0.53, g: 0.53, b: 0.53 } }],
          absoluteBoundingBox: { width: 200, height: 20 },
        },
        {
          id: "1:2",
          name: "close button",
          type: "RECTANGLE",
          absoluteBoundingBox: { width: 16, height: 16 }, // too small
          fills: [{ type: "SOLID", color: { r: 0.1, g: 0.1, b: 0.1 } }],
        },
        {
          id: "1:3",
          name: "H3 Subsection",
          type: "TEXT",
          characters: "Subsection",
          style: { fontSize: 20 },
          fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
        },
      ],
    },
  ],
};

describe("audit pipeline integration", () => {
  it("transforms, audits, and reports a Figma document end-to-end", async () => {
    // 1. Transform Figma JSON → AuditNode[]
    const nodes = transformFigmaToAuditNodes(FIXTURE);
    expect(nodes.length).toBeGreaterThan(0);

    // The body text should have a computed contrast ratio (gray on white)
    const body = nodes.find((n) => n.id === "1:1");
    expect(body?.contrastRatio).toBeDefined();
    expect(body!.contrastRatio!).toBeLessThan(4.5);

    // 2. Audit with the 7 default rules
    const engine = createDefaultEngine();
    const result = await engine.run({ nodes, options: { wcagVersion: "2.2", wcagLevel: "AA" } });

    // Should detect violations and score below perfect
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
    expect(result.nodeCount).toBe(nodes.length);

    // Specifically: contrast issue on body text
    expect(result.issues.some((i) => i.ruleId === "contrast.text" && i.nodeId === "1:1")).toBe(true);
    // Touch-target issue on tiny "close button" (interactive via name)
    expect(result.issues.some((i) => i.category === "touch-target")).toBe(true);

    // 3. Markdown report contains the score
    const md = generateMarkdown(result, { watermark: true });
    expect(md).toContain(`${result.score}/100`);
    expect(md).toContain("Powered by");

    // 4. SARIF report is well-formed
    const sarif = generateSarif(result);
    expect(sarif.version).toBe("2.1.0");
    expect(sarif.runs[0].results.length).toBe(result.issues.length);

    // 5. Sign the markdown report and verify it round-trips
    const metadata = { auditId: result.id, score: result.score };
    const sig = signReport(md, metadata, SECRET);
    expect(verifyReport(md, metadata, sig.signature, SECRET)).toBe(true);

    // Tampering breaks verification
    expect(verifyReport(md + " tampered", metadata, sig.signature, SECRET)).toBe(false);
  });

  it("produces a clean report for a compliant document", async () => {
    const cleanDoc = {
      type: "DOCUMENT",
      children: [
        {
          id: "0:1",
          name: "Clean",
          type: "CANVAS",
          backgroundColor: { r: 1, g: 1, b: 1 },
          children: [
            {
              id: "2:1",
              name: "Heading",
              type: "TEXT",
              characters: "Title",
              style: { fontSize: 42, fontWeight: 700 },
              fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }], // black on white = 21:1
            },
          ],
        },
      ],
    };

    const nodes = transformFigmaToAuditNodes(cleanDoc);
    const result = await createDefaultEngine().run({
      nodes,
      options: { wcagVersion: "2.2", wcagLevel: "AA" },
    });

    // No contrast issues for black-on-white heading
    expect(result.issues.some((i) => i.ruleId === "contrast.text")).toBe(false);
  });
});
