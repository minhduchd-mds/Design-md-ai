/** Build a "Parent > Child > Node" path string for issue reporting */
export function buildPath(ancestors: string[], name: string): string {
  return [...ancestors, name].join(" > ");
}

/** Convert {r, g, b} (0-255) to lowercase hex string like "#1a2b3c" */
export function colorToHex(color: { r: number; g: number; b: number }): string {
  const r = color.r.toString(16).padStart(2, "0");
  const g = color.g.toString(16).padStart(2, "0");
  const b = color.b.toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}
