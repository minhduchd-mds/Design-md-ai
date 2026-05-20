/**
 * color — WCAG 2.x color contrast math.
 *
 * Pure functions implementing the official WCAG relative-luminance and
 * contrast-ratio formulas:
 *   https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 *   https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 *
 * Reference values (sanity):
 *   - #000000 vs #FFFFFF → 21:1 (maximum)
 *   - #FFFFFF vs #FFFFFF → 1:1 (minimum)
 *   - #767676 vs #FFFFFF → ~4.54:1 (smallest gray passing AA normal text)
 */

export interface Rgb {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/** Parse a hex color (#rgb, #rrggbb, #rrggbbaa) to RGB. Returns null if invalid. */
export function hexToRgb(hex: string): Rgb | null {
  const cleaned = hex.trim().replace(/^#/, "");

  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    return {
      r: parseInt(cleaned[0] + cleaned[0], 16),
      g: parseInt(cleaned[1] + cleaned[1], 16),
      b: parseInt(cleaned[2] + cleaned[2], 16),
    };
  }

  if (/^[0-9a-fA-F]{6}$/.test(cleaned) || /^[0-9a-fA-F]{8}$/.test(cleaned)) {
    return {
      r: parseInt(cleaned.slice(0, 2), 16),
      g: parseInt(cleaned.slice(2, 4), 16),
      b: parseInt(cleaned.slice(4, 6), 16),
    };
  }

  return null;
}

/** Convert a Figma color channel (0-1 float) to 0-255. */
export function figmaChannelToByte(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

/** Linearize one sRGB channel (0-255) per WCAG. */
function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0 = black, 1 = white). */
export function relativeLuminance(rgb: Rgb): number {
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colors. Range 1:1 .. 21:1. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const lumA = relativeLuminance(a);
  const lumB = relativeLuminance(b);
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Convenience: contrast ratio from two hex strings. Returns null if either is invalid. */
export function contrastRatioHex(fg: string, bg: string): number | null {
  const a = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!a || !b) return null;
  return contrastRatio(a, b);
}

/**
 * WCAG "large text" definition: ≥ 18pt, or ≥ 14pt bold.
 * 1pt ≈ 1.333px, so 18pt ≈ 24px and 14pt ≈ 18.66px.
 */
export function isLargeText(fontSizePx: number, fontWeight: number = 400): boolean {
  const isBold = fontWeight >= 700;
  if (isBold) return fontSizePx >= 18.66;
  return fontSizePx >= 24;
}

/** Minimum required contrast ratio for the given level + text size. */
export function requiredContrast(level: "AA" | "AAA", largeText: boolean): number {
  if (level === "AAA") return largeText ? 4.5 : 7.0;
  return largeText ? 3.0 : 4.5;
}
