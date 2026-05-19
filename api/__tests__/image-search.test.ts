/**
 * Tests for /api/image-search endpoint.
 *
 * The handler is edge runtime (Request/Response), not Node (req/res).
 * Without UNSPLASH_ACCESS_KEY it returns Lorem Picsum fallback URLs.
 */

import { describe, it, expect, beforeEach } from "vitest";
import handler from "../image-search";

function makeRequest(qs: string, method = "GET"): Request {
  return new Request(`https://localhost/api/image-search${qs}`, {
    method,
    headers: { Origin: "https://localhost" },
  });
}

describe("/api/image-search", () => {
  beforeEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
  });

  it("returns 400 when query is missing", async () => {
    const res = await handler(makeRequest(""));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it("returns picsum fallback results for a keyword", async () => {
    const res = await handler(makeRequest("?q=ocean&count=3"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.query).toBe("ocean");
    expect(body.results).toHaveLength(3);
    expect(body.results[0].source).toBe("picsum");
    expect(body.results[0].url).toContain("picsum.photos/seed/ocean");
    expect(body.results[0].thumb).toContain("picsum.photos/seed/ocean");
    expect(body.results[0].alt).toBe("ocean 1");
  });

  it("clamps count between 1 and 6", async () => {
    const res = await handler(makeRequest("?q=cat&count=10"));
    const body = await res.json();
    expect(body.results.length).toBeLessThanOrEqual(6);
  });

  it("defaults count to 3 when not provided", async () => {
    const res = await handler(makeRequest("?q=forest"));
    const body = await res.json();
    expect(body.results).toHaveLength(3);
  });

  it("responds to OPTIONS with 200 for CORS preflight", async () => {
    const res = await handler(makeRequest("?q=test", "OPTIONS"));
    expect(res.status).toBe(200);
  });

  it("returns cache-control header for cacheability", async () => {
    const res = await handler(makeRequest("?q=sky"));
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});
