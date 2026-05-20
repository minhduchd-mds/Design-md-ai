/**
 * focus-trap — Pure helpers for Dialog focus management.
 *
 * Kept separate from the component so the index-wrapping math (the part
 * worth testing) is a pure function, testable without a DOM.
 */

/** CSS selector matching natively focusable, non-disabled elements. */
export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Given the currently focused index within a list of focusable elements,
 * return the index to focus next for a Tab / Shift+Tab press, wrapping
 * around at both ends. Returns -1 when there are no focusable elements.
 */
export function nextFocusIndex(current: number, total: number, shiftKey: boolean): number {
  if (total <= 0) return -1;
  if (shiftKey) {
    // Shift+Tab: wrap from first (or unknown) back to last
    return current <= 0 ? total - 1 : current - 1;
  }
  // Tab: wrap from last (or unknown) to first
  return current >= total - 1 ? 0 : current + 1;
}

/** True if a keyboard event should close the dialog (Escape). */
export function isCloseKey(key: string): boolean {
  return key === "Escape" || key === "Esc";
}
