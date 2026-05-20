/**
 * signer — HMAC-SHA256 report signing tests.
 *
 * Verifies sign/verify round-trips, tamper detection, and that
 * a missing secret fails closed.
 */

import { describe, it, expect } from "vitest";
import { signReport, verifyReport } from "../signer.js";

const SECRET = "test-secret-32-bytes-long-padding!!";
const META = { auditId: "abc", score: 87 };

describe("signReport", () => {
  it("produces a base64 signature + metadata", () => {
    const sig = signReport("payload", META, SECRET);
    expect(sig.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(sig.algorithm).toBe("HMAC-SHA256");
    expect(sig.signedBy).toContain("Desygn A11y");
    expect(sig.verificationUrl).toContain("sig=");
  });

  it("is deterministic for same input + secret", () => {
    const a = signReport("payload", META, SECRET);
    const b = signReport("payload", META, SECRET);
    expect(a.signature).toBe(b.signature);
  });

  it("changes signature when payload changes", () => {
    const a = signReport("payload-1", META, SECRET);
    const b = signReport("payload-2", META, SECRET);
    expect(a.signature).not.toBe(b.signature);
  });

  it("is insensitive to metadata key order (canonical)", () => {
    const a = signReport("p", { score: 87, auditId: "abc" }, SECRET);
    const b = signReport("p", { auditId: "abc", score: 87 }, SECRET);
    expect(a.signature).toBe(b.signature);
  });

  it("throws when secret is missing", () => {
    expect(() => signReport("p", META, "")).toThrow(/REPORT_SIGNING_SECRET/);
  });

  it("accepts Buffer payloads", () => {
    const sig = signReport(Buffer.from("binary"), META, SECRET);
    expect(sig.signature).toBeTruthy();
  });
});

describe("verifyReport", () => {
  it("verifies a valid signature", () => {
    const { signature } = signReport("payload", META, SECRET);
    expect(verifyReport("payload", META, signature, SECRET)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const { signature } = signReport("payload", META, SECRET);
    expect(verifyReport("tampered", META, signature, SECRET)).toBe(false);
  });

  it("rejects tampered metadata", () => {
    const { signature } = signReport("payload", META, SECRET);
    expect(verifyReport("payload", { ...META, score: 99 }, signature, SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const { signature } = signReport("payload", META, SECRET);
    expect(verifyReport("payload", META, signature, "other-secret")).toBe(false);
  });

  it("returns false on missing secret (fails closed)", () => {
    const { signature } = signReport("payload", META, SECRET);
    expect(verifyReport("payload", META, signature, "")).toBe(false);
  });

  it("returns false on malformed signature", () => {
    expect(verifyReport("payload", META, "not-base64-!!", SECRET)).toBe(false);
  });
});
