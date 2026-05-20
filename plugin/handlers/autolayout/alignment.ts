/**
 * autolayout/alignment — Alignment detection and child sizing decisions.
 *
 * Pure functions that determine primary/counter axis alignment and sizing
 * strategy. Exported for direct testing.
 */

export interface AlignmentChild {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PaddingBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const ALIGN_TOL = 2;
const ALIGN_CENTER_TOL = 4;

export function detectPrimaryAlignment(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
  frameMain: number,
  padding: PaddingBox,
): "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN" {
  if (children.length === 0) return "MIN";

  const isHoriz = direction === "HORIZONTAL";
  const padStart = isHoriz ? padding.left : padding.top;
  const padEnd = isHoriz ? padding.right : padding.bottom;

  const positions = children.map((c) => (isHoriz ? c.x : c.y));
  const sizes = children.map((c) => (isHoriz ? c.width : c.height));

  let firstIdx = 0;
  let lastIdx = 0;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] < positions[firstIdx]) firstIdx = i;
    if (positions[i] > positions[lastIdx]) lastIdx = i;
  }

  const firstAtStart = Math.abs(positions[firstIdx] - padStart) <= ALIGN_TOL;
  const lastAtEnd =
    Math.abs(positions[lastIdx] + sizes[lastIdx] - (frameMain - padEnd)) <= ALIGN_TOL;

  if (children.length >= 3 && firstAtStart && lastAtEnd) return "SPACE_BETWEEN";
  if (firstAtStart) return "MIN";
  if (lastAtEnd) return "MAX";

  const contentStart = positions[firstIdx];
  const contentEnd = positions[lastIdx] + sizes[lastIdx];
  const contentMid = (contentStart + contentEnd) / 2;
  const innerMid = padStart + (frameMain - padStart - padEnd) / 2;
  if (Math.abs(contentMid - innerMid) <= ALIGN_CENTER_TOL) return "CENTER";

  return "MIN";
}

export function detectCounterAlignment(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
  frameCross: number,
  padding: PaddingBox,
): "MIN" | "CENTER" | "MAX" {
  if (children.length === 0) return "MIN";

  const isHoriz = direction === "HORIZONTAL";
  const padStart = isHoriz ? padding.top : padding.left;
  const padEnd = isHoriz ? padding.bottom : padding.right;

  const positions = children.map((c) => (isHoriz ? c.y : c.x));
  const sizes = children.map((c) => (isHoriz ? c.height : c.width));

  if (positions.every((p) => Math.abs(p - padStart) <= ALIGN_TOL)) return "MIN";

  if (
    positions.every(
      (p, i) => Math.abs(p + sizes[i] - (frameCross - padEnd)) <= ALIGN_TOL,
    )
  ) {
    return "MAX";
  }

  const innerCenter = padStart + (frameCross - padStart - padEnd) / 2;
  if (
    positions.every(
      (p, i) => Math.abs(p + sizes[i] / 2 - innerCenter) <= ALIGN_CENTER_TOL,
    )
  ) {
    return "CENTER";
  }

  return "MIN";
}

// ── Child sizing decision ──

export function canHugContent(type: string, hasChildren: boolean): boolean {
  if (type === "TEXT") return true;
  if (type === "INSTANCE") return true;
  return hasChildren;
}

export interface ChildSizingInput {
  width: number;
  height: number;
  type: string;
  hasChildren: boolean;
}

const FILL_TOL = 4;

export function decideChildSizing(
  child: ChildSizingInput,
  direction: "HORIZONTAL" | "VERTICAL",
  innerWidth: number,
  innerHeight: number,
): { horizontal: "FILL" | "HUG" | "FIXED"; vertical: "FILL" | "HUG" | "FIXED" } {
  const canHug = canHugContent(child.type, child.hasChildren);
  const fallback: "HUG" | "FIXED" = canHug ? "HUG" : "FIXED";

  let horizontal: "FILL" | "HUG" | "FIXED";
  let vertical: "FILL" | "HUG" | "FIXED";

  if (direction === "HORIZONTAL") {
    horizontal = fallback;
    vertical = Math.abs(child.height - innerHeight) <= FILL_TOL ? "FILL" : fallback;
  } else {
    vertical = fallback;
    horizontal = Math.abs(child.width - innerWidth) <= FILL_TOL ? "FILL" : fallback;
  }

  return { horizontal, vertical };
}

// ── Gap variance ──

export function gapVariance(
  children: AlignmentChild[],
  direction: "HORIZONTAL" | "VERTICAL",
): number {
  if (children.length < 3) return 0;
  const sorted =
    direction === "HORIZONTAL"
      ? [...children].sort((a, b) => a.x - b.x)
      : [...children].sort((a, b) => a.y - b.y);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const g =
      direction === "HORIZONTAL"
        ? curr.x - (prev.x + prev.width)
        : curr.y - (prev.y + prev.height);
    gaps.push(Math.round(g));
  }
  return Math.max(...gaps) - Math.min(...gaps);
}
