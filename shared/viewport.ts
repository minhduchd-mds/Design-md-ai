export type ViewportType = "mobile" | "tablet" | "desktop" | "unknown";

/**
 * Classify a frame width into a viewport bucket.
 * Cascade: `<= X` thresholds, no gaps. Zero/negative → "unknown".
 */
export function detectViewport(width: number): ViewportType {
  if (width <= 0) return "unknown";
  if (width <= 428) return "mobile";
  if (width <= 1024) return "tablet";
  return "desktop";
}
