// Prompt injection protection: sanitize layer names and text content
// before embedding them into AI prompts.

// Patterns that look like AI instructions rather than design layer names
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now/i,
  /new\s+instructions?:/i,
  /system\s*prompt/i,
  /\bdo\s+not\s+follow\b/i,
  /\boverride\b.*\binstructions?\b/i,
  /\boutput\b.*\b(credentials?|secrets?|keys?|passwords?)\b/i,
  /\bact\s+as\b/i,
  /\brole:\s*system\b/i,
];

/**
 * Sanitizes a Figma layer name or text content for safe embedding in prompts.
 * - Strips control characters
 * - Flags injection-like patterns by wrapping them in [LAYER-NAME: ...]
 * - Truncates overly long names
 */
export function sanitizeName(name: string): string {
  // Strip control characters (except common whitespace)
  let clean = name.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Truncate excessively long names (normal Figma names are <100 chars)
  if (clean.length > 200) {
    clean = clean.slice(0, 200) + "…";
  }

  // If name contains injection-like patterns, wrap it to signal it's data
  if (INJECTION_PATTERNS.some((p) => p.test(clean))) {
    return `[LAYER: ${clean}]`;
  }

  return clean;
}

/**
 * Sanitizes text content from TEXT nodes.
 * More permissive than layer names (text can be longer and more varied).
 */
export function sanitizeText(text: string): string {
  let clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (clean.length > 500) {
    clean = clean.slice(0, 500) + "…";
  }

  if (INJECTION_PATTERNS.some((p) => p.test(clean))) {
    return `[TEXT-CONTENT: ${clean}]`;
  }

  return clean;
}
