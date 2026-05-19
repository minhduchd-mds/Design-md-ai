/**
 * sanitize — Input sanitization for prompt text.
 *
 * Two layers of defense:
 *   1. `stripHtmlAndControl()` — removes HTML tags and control characters (XSS prevention)
 *   2. `wrapUserInput()` — wraps user input in delimiters for prompt-injection defense
 *
 * IMPORTANT: `sanitize()` does NOT prevent prompt injection on its own.
 * It strips HTML/control chars and truncates. For prompt-injection defense,
 * use `wrapUserInput()` when embedding user text in system/AI prompts.
 */

const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const HTML_TAGS = /<[^>]*>/g;
const MAX_PROMPT_LENGTH = 10000;

/**
 * Strip HTML tags and control characters, then truncate.
 * This is XSS prevention, NOT prompt-injection prevention.
 */
export function sanitize(input: string): string {
  return input.replace(CONTROL_CHARS, "").replace(HTML_TAGS, "").trim().slice(0, MAX_PROMPT_LENGTH);
}

// ── Prompt-injection defense ─────────────────────────────

/** Common prompt-injection patterns (case-insensitive). */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /disregard\s+(all\s+)?(above|previous)/i,
  /you\s+are\s+now\s+(a|an)\b/i,
  /\bsystem\s*:\s*/i,
  /<\/?(system|prompt|instruction|context)>/i,
  /\bdo\s+not\s+follow\s+(the\s+)?(above|previous)/i,
  /\bnew\s+instructions?\s*:/i,
  /\boverride\s+(all\s+)?rules/i,
];

/**
 * Check if input contains common prompt-injection patterns.
 * Returns true if suspicious patterns are detected.
 */
export function containsInjectionPattern(input: string): boolean {
  return INJECTION_PATTERNS.some((re) => re.test(input));
}

/**
 * Wrap user input in XML-style delimiters for safe embedding in prompts.
 * This makes it harder for injected text to escape the user-input context.
 *
 * Usage in system prompt:
 *   `The user's design request is: ${wrapUserInput(sanitize(raw))}`
 */
export function wrapUserInput(sanitized: string): string {
  return `<user_input>${sanitized}</user_input>`;
}
