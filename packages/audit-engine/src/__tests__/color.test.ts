/**
 * color — WCAG contrast math tests, validated against known reference values.
 */

import { describe, it, expect } from "vitest";
import {
  hexToRgb,
  figmaChannelToByte,
  relativeLuminance,
  contrastRatio,
  contrastRatioHex,
  isLargeText,
  requiredContrast,
} from "../color.js";

describe("hexToRgb", () => {
  it("parses 6-digit hex", () => {
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("parses without leading hash", () => {
    expect(hexToRgb("ff0000")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("parses 3-digit shorthand", () => {
    expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
    expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
  });

  it("parses 8-digit hex (ignores alpha)", () => {
    expect(hexToRgb("#ff000080")).toEqual({ r: 255, g: 0, b: 0 });
  });

  it("returns null for invalid hex", () => {
    expect(hexToRgb("not-a-color")).toBeNull();
    expect(hexToRgb("#12")).toBeNull();
    expect(hexToRgb("#gggggg")).toBeNull();
  });
});

describe("figmaChannelToByte", () => {
  it("converts 0-1 float to 0-255", () => {
    expect(figmaChannelToByte(0)).toBe(0);
    expect(figmaChannelToByte(1)).toBe(255);
    expect(figmaChannelToByte(0.5)).toBe(128);
  });

  it("clamps out-of-range values", () => {
    expect(figmaChannelToByte(-0.5)).toBe(0);
    expect(figmaChannelToByte(2)).toBe(255);
  });
});

describe("relativeLuminance", () => {
  it("is 0 for black", () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBe(0);
  });

  it("is 1 for white", () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it("weights green most heavily", () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 });
    const red = relativeLuminance({ r: 255, g: 0, b: 0 });
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 });
    expect(green).toBeGreaterThan(red);
    expect(red).toBeGreaterThan(blue);
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white (maximum)", () => {
    expect(contrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBeCloseTo(21, 1);
  });

  it("is 1:1 for identical colors (minimum)", () => {
    expect(contrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 })).toBeCloseTo(1, 5);
  });

  it("is symmetric (order independent)", () => {
    const a = { r: 50, g: 100, b: 150 };
    const b = { r: 200, g: 200, b: 200 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });

  it("matches known AA boundary: #767676 on white ≈ 4.54", () => {
    const ratio = contrastRatio({ r: 0x76, g: 0x76, b: 0x76 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratio).toBeLessThan(4.6);
  });
});

describe("contrastRatioHex", () => {
  it("computes from hex strings", () => {
    expect(contrastRatioHex("#000", "#fff")).toBeCloseTo(21, 1);
  });

  it("returns null for invalid input", () => {
    // note: "bad" is valid 3-digit hex (#bbaadd) — use a non-hex string
    expect(contrastRatioHex("xyz", "#fff")).toBeNull();
    expect(contrastRatioHex("#fff", "nope!!")).toBeNull();
  });
});

describe("isLargeText", () => {
  it("treats ≥24px normal weight as large", () => {
    expect(isLargeText(24, 400)).toBe(true);
    expect(isLargeText(23, 400)).toBe(false);
  });

  it("treats ≥18.66px bold as large", () => {
    expect(isLargeText(19, 700)).toBe(true);
    expect(isLargeText(18, 700)).toBe(false);
  });

  it("defaults to normal weight", () => {
    expect(isLargeText(20)).toBe(false);
  });
});

describe("requiredContrast", () => {
  it("AA normal = 4.5, AA large = 3.0", () => {
    expect(requiredContrast("AA", false)).toBe(4.5);
    expect(requiredContrast("AA", true)).toBe(3.0);
  });

  it("AAA normal = 7.0, AAA large = 4.5", () => {
    expect(requiredContrast("AAA", false)).toBe(7.0);
    expect(requiredContrast("AAA", true)).toBe(4.5);
  });
});
