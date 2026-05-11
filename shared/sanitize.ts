const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const HTML_TAGS = /<[^>]*>/g;
const MAX_PROMPT_LENGTH = 10000;

export function sanitize(input: string): string {
  return input.replace(CONTROL_CHARS, "").replace(HTML_TAGS, "").trim().slice(0, MAX_PROMPT_LENGTH);
}
