/**
 * PII Detection Benchmarks
 *
 * Covers:
 *   • Scan short text (50 chars) for PII
 *   • Scan long text (5000 chars) for PII
 *   • Scan text containing Vietnamese CCCD numbers
 *   • Redact PII from text
 */

import { PIIScanner, createPIIScanner, createVietnamesePIIScanner } from "../web/src/lib/piiDetection.js";
import { bench, type BenchResult } from "./bench.js";

// ── Test fixtures ─────────────────────────────────────────────

const SHORT_TEXT_NO_PII = "Design system spacing tokens updated to 4px base.";

const SHORT_TEXT_WITH_PII = "Contact john@example.com or call +84912345678 for details.";

/** Generate ~5000 char text with scattered PII */
function buildLongText(): string {
  const paragraph =
    "The design system has been updated with new spacing tokens. " +
    "Typography now uses Inter font across all components. " +
    "Color palette expanded to include semantic tokens for success, warning and error states. " +
    "Component library version 3.2.1 released with accessibility improvements. ";

  const piiBits = [
    "Contact: alice@designsystem.io for questions. ",
    "Legacy API token: api_key=sk-live-abc123xyz456def789ghi012jkl345mno678pq. ",
    "Support: +1-555-867-5309. ",
    "Server: 192.168.1.100. ",
    "SSN on file: 123-45-6789. ",
    "Card ending: 4111111111111111. ",
  ];

  const parts: string[] = [];
  let charCount = 0;
  let piiIdx = 0;
  while (charCount < 5000) {
    parts.push(paragraph);
    charCount += paragraph.length;
    if (charCount % 600 < paragraph.length && piiIdx < piiBits.length) {
      parts.push(piiBits[piiIdx++]);
      charCount += piiBits[piiIdx - 1].length;
    }
  }
  return parts.join("").slice(0, 5000);
}

const LONG_TEXT = buildLongText();

const VIETNAMESE_CCCD_TEXT =
  "Họ tên: Nguyễn Văn An. Số CCCD: 001201012345. Ngày sinh: 01/01/1990. " +
  "Điện thoại: 0912345678. Email: nguyenvanan@gmail.com. " +
  "Số CMND cũ: 123456789. Địa chỉ: 12 Lê Lợi, Q1, TP.HCM.";

export function runPIIBenchmarks(): BenchResult[] {
  const results: BenchResult[] = [];

  const scanner = createPIIScanner();
  const vnScanner = createVietnamesePIIScanner();

  // ── Benchmark 1: Scan short text (no PII) ────────────────────
  try {
    results.push(
      bench(
        "PII: scan short text (50 chars, no PII)",
        () => {
          scanner.scan(SHORT_TEXT_NO_PII);
        },
        1000,
      ),
    );
  } catch (err) {
    console.error("PII short-text benchmark failed:", err);
  }

  // ── Benchmark 2: Scan short text (with PII) ───────────────────
  try {
    results.push(
      bench(
        "PII: scan short text (with PII)",
        () => {
          scanner.scan(SHORT_TEXT_WITH_PII);
        },
        1000,
      ),
    );
  } catch (err) {
    console.error("PII short-text-pii benchmark failed:", err);
  }

  // ── Benchmark 3: Scan long text (5000 chars) ─────────────────
  try {
    results.push(
      bench(
        "PII: scan long text (5000 chars)",
        () => {
          scanner.scan(LONG_TEXT);
        },
        500,
      ),
    );
  } catch (err) {
    console.error("PII long-text benchmark failed:", err);
  }

  // ── Benchmark 4: Scan Vietnamese CCCD text ───────────────────
  try {
    results.push(
      bench(
        "PII: scan Vietnamese CCCD text",
        () => {
          vnScanner.scan(VIETNAMESE_CCCD_TEXT);
        },
        1000,
      ),
    );
  } catch (err) {
    console.error("PII Vietnamese benchmark failed:", err);
  }

  // ── Benchmark 5: Redact PII from text ────────────────────────
  try {
    // Pre-scan to get matches; benchmark only the redact step
    const scanResult = scanner.scan(LONG_TEXT);
    results.push(
      bench(
        "PII: redact PII from long text",
        () => {
          scanner.redact(LONG_TEXT, scanResult.matches);
        },
        500,
      ),
    );
  } catch (err) {
    console.error("PII redact benchmark failed:", err);
  }

  return results;
}
