/**
 * Tests for QR code SVG generator.
 */

import { describe, it, expect } from "vitest";
import { generateQRCodeSVG } from "../qrCode";

describe("generateQRCodeSVG", () => {
  it("returns a valid SVG string", () => {
    const svg = generateQRCodeSVG("https://example.com");
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it("contains dark modules for non-empty input", () => {
    const svg = generateQRCodeSVG("hello");
    // Should have multiple rect elements for dark modules
    const rectCount = (svg.match(/<rect/g) || []).length;
    expect(rectCount).toBeGreaterThan(10); // background + many dark modules
  });

  it("scales output by moduleSize", () => {
    const small = generateQRCodeSVG("test", 2, 1);
    const large = generateQRCodeSVG("test", 6, 1);
    // Larger module size → larger viewBox
    const smallWidth = Number(small.match(/width="(\d+)"/)?.[1] ?? 0);
    const largeWidth = Number(large.match(/width="(\d+)"/)?.[1] ?? 0);
    expect(largeWidth).toBeGreaterThan(smallWidth);
  });

  it("handles short text (version 1)", () => {
    const svg = generateQRCodeSVG("Hi");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("handles longer URLs (version 2+)", () => {
    const url = "https://design-md-ai-yd6r.vercel.app/workspace?tab=chat&model=groq";
    const svg = generateQRCodeSVG(url);
    expect(svg).toContain("<svg");
    const rectCount = (svg.match(/<rect/g) || []).length;
    expect(rectCount).toBeGreaterThan(50);
  });

  it("includes white background with rounded corners", () => {
    const svg = generateQRCodeSVG("test");
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('rx="8"');
  });

  it("uses dark fill for modules", () => {
    const svg = generateQRCodeSVG("test");
    expect(svg).toContain('fill="#0f172a"');
  });
});
