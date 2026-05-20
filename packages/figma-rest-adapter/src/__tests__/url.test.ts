/**
 * parseFigmaUrl — extract fileKey + nodeId from Figma URLs.
 */

import { describe, it, expect } from "vitest";
import { parseFigmaUrl } from "../url.js";

describe("parseFigmaUrl", () => {
  it("parses a /file/ URL", () => {
    const r = parseFigmaUrl("https://www.figma.com/file/abc123/My-Design");
    expect(r.fileKey).toBe("abc123");
    expect(r.nodeId).toBeUndefined();
  });

  it("parses a /design/ URL", () => {
    const r = parseFigmaUrl("https://www.figma.com/design/xyz789/Dashboard");
    expect(r.fileKey).toBe("xyz789");
  });

  it("extracts node-id and converts dash to colon", () => {
    const r = parseFigmaUrl("https://www.figma.com/file/abc123/X?node-id=12-345");
    expect(r.fileKey).toBe("abc123");
    expect(r.nodeId).toBe("12:345");
  });

  it("handles node-id already in colon form", () => {
    const r = parseFigmaUrl("https://www.figma.com/design/abc/Y?node-id=1%3A2");
    // %3A decodes to ':' which stays ':'
    expect(r.nodeId).toBe("1:2");
  });

  it("throws on a non-Figma URL", () => {
    expect(() => parseFigmaUrl("https://example.com/foo")).toThrow(/Invalid Figma URL/);
  });

  it("throws on garbage input", () => {
    expect(() => parseFigmaUrl("not a url")).toThrow();
  });
});
