import { describe, it, expect } from "vitest";
import {
  canHugContent,
  decideChildSizing,
  detectPrimaryAlignment,
  detectCounterAlignment,
  gapVariance,
  type AlignmentChild,
  type ChildSizingInput,
} from "../autolayout";

const NO_PAD = { top: 0, right: 0, bottom: 0, left: 0 };

describe("canHugContent", () => {
  it("treats TEXT as huggable", () => {
    expect(canHugContent("TEXT", false)).toBe(true);
  });

  it("treats INSTANCE as huggable", () => {
    expect(canHugContent("INSTANCE", false)).toBe(true);
  });

  it("treats Frames with children as huggable", () => {
    expect(canHugContent("FRAME", true)).toBe(true);
    expect(canHugContent("COMPONENT", true)).toBe(true);
  });

  it("treats empty Frames as non-huggable (would collapse to 0)", () => {
    expect(canHugContent("FRAME", false)).toBe(false);
  });

  it("treats shape primitives as non-huggable", () => {
    expect(canHugContent("RECTANGLE", false)).toBe(false);
    expect(canHugContent("ELLIPSE", false)).toBe(false);
    expect(canHugContent("VECTOR", false)).toBe(false);
  });
});

describe("decideChildSizing — VERTICAL Auto Layout (cross-axis = horizontal)", () => {
  const inner = { w: 200, h: 400 };

  it("FILL when child width ≈ frame inner width", () => {
    const child: ChildSizingInput = { width: 200, height: 30, type: "FRAME", hasChildren: true };
    const r = decideChildSizing(child, "VERTICAL", inner.w, inner.h);
    expect(r.horizontal).toBe("FILL");
    expect(r.vertical).toBe("HUG");
  });

  it("FILL within tolerance (4px under)", () => {
    const child: ChildSizingInput = { width: 197, height: 30, type: "FRAME", hasChildren: true };
    expect(decideChildSizing(child, "VERTICAL", inner.w, inner.h).horizontal).toBe("FILL");
  });

  it("HUG when child narrower than inner width", () => {
    const child: ChildSizingInput = { width: 100, height: 30, type: "FRAME", hasChildren: true };
    expect(decideChildSizing(child, "VERTICAL", inner.w, inner.h).horizontal).toBe("HUG");
  });

  it("FIXED on empty rectangle (would collapse if HUG)", () => {
    const child: ChildSizingInput = { width: 80, height: 80, type: "RECTANGLE", hasChildren: false };
    const r = decideChildSizing(child, "VERTICAL", inner.w, inner.h);
    expect(r.horizontal).toBe("FIXED");
    expect(r.vertical).toBe("FIXED");
  });

  it("FILL still wins even for shape primitives matching parent width", () => {
    // A full-width Rectangle (e.g. background) should become FILL on cross-axis.
    const child: ChildSizingInput = { width: 200, height: 4, type: "RECTANGLE", hasChildren: false };
    const r = decideChildSizing(child, "VERTICAL", inner.w, inner.h);
    expect(r.horizontal).toBe("FILL");
    expect(r.vertical).toBe("FIXED");
  });

  it("TEXT child gets HUG main + correct cross", () => {
    const text: ChildSizingInput = { width: 80, height: 20, type: "TEXT", hasChildren: false };
    const r = decideChildSizing(text, "VERTICAL", inner.w, inner.h);
    expect(r.horizontal).toBe("HUG");
    expect(r.vertical).toBe("HUG");
  });
});

describe("decideChildSizing — HORIZONTAL Auto Layout (cross-axis = vertical)", () => {
  it("FILL when child height ≈ frame inner height", () => {
    const child: ChildSizingInput = { width: 100, height: 50, type: "FRAME", hasChildren: true };
    const r = decideChildSizing(child, "HORIZONTAL", 600, 50);
    expect(r.vertical).toBe("FILL");
    expect(r.horizontal).toBe("HUG");
  });

  it("HUG when child shorter than inner height", () => {
    const child: ChildSizingInput = { width: 100, height: 30, type: "FRAME", hasChildren: true };
    expect(decideChildSizing(child, "HORIZONTAL", 600, 50).vertical).toBe("HUG");
  });
});

describe("detectPrimaryAlignment — HORIZONTAL", () => {
  it("MIN when first child at left padding", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 80, y: 0, width: 60, height: 40 },
    ];
    expect(detectPrimaryAlignment(children, "HORIZONTAL", 400, NO_PAD)).toBe("MIN");
  });

  it("MAX when last child ends at right edge minus padding", () => {
    const children: AlignmentChild[] = [
      { x: 200, y: 0, width: 60, height: 40 },
      { x: 280, y: 0, width: 120, height: 40 }, // 280+120 = 400 = frameMain
    ];
    expect(detectPrimaryAlignment(children, "HORIZONTAL", 400, NO_PAD)).toBe("MAX");
  });

  it("SPACE_BETWEEN when first at start, last at end, n≥3", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 170, y: 0, width: 60, height: 40 },
      { x: 340, y: 0, width: 60, height: 40 }, // 340+60 = 400
    ];
    expect(detectPrimaryAlignment(children, "HORIZONTAL", 400, NO_PAD)).toBe("SPACE_BETWEEN");
  });

  it("SPACE_BETWEEN with 2 children resolves to MIN (ambiguous)", () => {
    // Only 2 children at first/last positions: not space-between, just MIN+MAX
    // which we resolve to MIN per the n>=3 guard.
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 340, y: 0, width: 60, height: 40 },
    ];
    expect(detectPrimaryAlignment(children, "HORIZONTAL", 400, NO_PAD)).toBe("MIN");
  });

  it("CENTER when content bounding box centered", () => {
    // Two children, total content width 140, frame 400 → content midline at 200
    const children: AlignmentChild[] = [
      { x: 130, y: 0, width: 60, height: 40 },
      { x: 210, y: 0, width: 60, height: 40 },
    ];
    expect(detectPrimaryAlignment(children, "HORIZONTAL", 400, NO_PAD)).toBe("CENTER");
  });

  it("respects padding for MIN detection", () => {
    const children: AlignmentChild[] = [
      { x: 16, y: 0, width: 60, height: 40 },
      { x: 96, y: 0, width: 60, height: 40 },
    ];
    expect(
      detectPrimaryAlignment(children, "HORIZONTAL", 400, { ...NO_PAD, left: 16 }),
    ).toBe("MIN");
  });
});

describe("detectPrimaryAlignment — VERTICAL", () => {
  it("MIN when first child at top padding", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 60, width: 100, height: 40 },
    ];
    expect(detectPrimaryAlignment(children, "VERTICAL", 400, NO_PAD)).toBe("MIN");
  });
});

describe("detectCounterAlignment", () => {
  it("MIN when all children top-aligned (HORIZONTAL direction)", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 80, y: 0, width: 60, height: 60 },
    ];
    expect(detectCounterAlignment(children, "HORIZONTAL", 100, NO_PAD)).toBe("MIN");
  });

  it("CENTER when children vertically centered (HORIZONTAL direction)", () => {
    // frameCross=100; child A height=40 at y=30 → center 50; child B height=60 at y=20 → center 50
    const children: AlignmentChild[] = [
      { x: 0, y: 30, width: 60, height: 40 },
      { x: 80, y: 20, width: 60, height: 60 },
    ];
    expect(detectCounterAlignment(children, "HORIZONTAL", 100, NO_PAD)).toBe("CENTER");
  });

  it("MAX when all children bottom-aligned (HORIZONTAL direction)", () => {
    // frameCross=100; child ends at 100
    const children: AlignmentChild[] = [
      { x: 0, y: 60, width: 60, height: 40 },
      { x: 80, y: 40, width: 60, height: 60 },
    ];
    expect(detectCounterAlignment(children, "HORIZONTAL", 100, NO_PAD)).toBe("MAX");
  });

  it("MIN when children left-aligned (VERTICAL direction)", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 60, width: 80, height: 40 },
    ];
    expect(detectCounterAlignment(children, "VERTICAL", 200, NO_PAD)).toBe("MIN");
  });

  it("CENTER when children horizontally centered (VERTICAL direction)", () => {
    // frameCross=200; child A width=100 at x=50 → center 100; child B width=80 at x=60 → center 100
    const children: AlignmentChild[] = [
      { x: 50, y: 0, width: 100, height: 40 },
      { x: 60, y: 60, width: 80, height: 40 },
    ];
    expect(detectCounterAlignment(children, "VERTICAL", 200, NO_PAD)).toBe("CENTER");
  });

  it("respects padding when detecting MIN", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 12, width: 60, height: 40 },
      { x: 80, y: 12, width: 60, height: 40 },
    ];
    expect(
      detectCounterAlignment(children, "HORIZONTAL", 100, { ...NO_PAD, top: 12 }),
    ).toBe("MIN");
  });
});

describe("gapVariance", () => {
  it("returns 0 for fewer than 3 children", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 80, y: 0, width: 60, height: 40 },
    ];
    expect(gapVariance(children, "HORIZONTAL")).toBe(0);
  });

  it("returns 0 when gaps are exactly equal", () => {
    // Three children with 20px gaps each
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 60, height: 40 },
      { x: 80, y: 0, width: 60, height: 40 },
      { x: 160, y: 0, width: 60, height: 40 },
    ];
    expect(gapVariance(children, "HORIZONTAL")).toBe(0);
  });

  it("returns large variance for value-pinned-right pattern", () => {
    // icon next to label (gap 8), value pushed far right (gap 196)
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 24, height: 32 },
      { x: 32, y: 0, width: 100, height: 32 },
      { x: 328, y: 0, width: 32, height: 32 },
    ];
    expect(gapVariance(children, "HORIZONTAL")).toBeGreaterThan(8);
  });

  it("works on vertical direction", () => {
    const children: AlignmentChild[] = [
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 50, width: 100, height: 40 },
      { x: 0, y: 200, width: 100, height: 40 },
    ];
    // gaps: 10, 110 → variance 100
    expect(gapVariance(children, "VERTICAL")).toBe(100);
  });
});
