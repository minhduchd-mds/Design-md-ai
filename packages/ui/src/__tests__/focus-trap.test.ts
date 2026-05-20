/**
 * focus-trap — pure helper tests (no DOM needed).
 */

import { describe, it, expect } from "vitest";
import { FOCUSABLE_SELECTOR, nextFocusIndex, isCloseKey } from "../primitives/focus-trap.js";

describe("nextFocusIndex", () => {
  it("Tab advances to the next index", () => {
    expect(nextFocusIndex(0, 3, false)).toBe(1);
    expect(nextFocusIndex(1, 3, false)).toBe(2);
  });

  it("Tab wraps from last to first", () => {
    expect(nextFocusIndex(2, 3, false)).toBe(0);
  });

  it("Shift+Tab goes to the previous index", () => {
    expect(nextFocusIndex(2, 3, true)).toBe(1);
  });

  it("Shift+Tab wraps from first to last", () => {
    expect(nextFocusIndex(0, 3, true)).toBe(2);
  });

  it("wraps to first on Tab when current is unknown (-1)", () => {
    expect(nextFocusIndex(-1, 3, false)).toBe(0);
  });

  it("wraps to last on Shift+Tab when current is unknown (-1)", () => {
    expect(nextFocusIndex(-1, 3, true)).toBe(2);
  });

  it("returns -1 when there are no focusable elements", () => {
    expect(nextFocusIndex(0, 0, false)).toBe(-1);
    expect(nextFocusIndex(0, 0, true)).toBe(-1);
  });
});

describe("isCloseKey", () => {
  it("matches Escape variants", () => {
    expect(isCloseKey("Escape")).toBe(true);
    expect(isCloseKey("Esc")).toBe(true);
  });

  it("does not match other keys", () => {
    expect(isCloseKey("Enter")).toBe(false);
    expect(isCloseKey("Tab")).toBe(false);
  });
});

describe("FOCUSABLE_SELECTOR", () => {
  it("excludes disabled controls and tabindex=-1", () => {
    expect(FOCUSABLE_SELECTOR).toContain("button:not([disabled])");
    expect(FOCUSABLE_SELECTOR).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
