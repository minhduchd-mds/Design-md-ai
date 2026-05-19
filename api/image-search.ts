/**
 * /api/image-search — lightweight image search proxy.
 *
 * Uses Unsplash API if UNSPLASH_ACCESS_KEY is set (50 req/hr free tier),
 * otherwise falls back to curated Lorem Picsum URLs (no API key needed).
 *
 * Query params:
 *   q      — search keyword (required)
 *   count  — number of results (1-6, default 3)
 */
import { buildCorsHeaders } from "./lib/cors";

export const config = { runtime: "edge", maxDuration: 10 };

interface UnsplashResult {
  id: string;
  urls: { regular: string; small: string; thumb: string };
  alt_description: string | null;
  user: { name: string };
  links: { html: string };
}

interface ImageResult {
  url: string;
  thumb: string;
  alt: string;
  credit: string;
  source: "unsplash" | "picsum";
}

export default async function handler(req: Request): Promise<Response> {
  const cors = buildCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: cors });
  }

  const url = new URL(req.url);
  const query = url.searchParams.get("q")?.trim();
  const count = Math.min(6, Math.max(1, Number(url.searchParams.get("count")) || 3));

  if (!query) {
    return new Response(JSON.stringify({ error: "Query parameter 'q' is required." }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;

  let results: ImageResult[];

  if (unsplashKey) {
    // ── Unsplash API (real keyword search) ────────────────────────
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
        { headers: { Authorization: `Client-ID ${unsplashKey}` } },
      );
      if (!res.ok) throw new Error(`Unsplash ${res.status}`);
      const data = (await res.json()) as { results: UnsplashResult[] };
      results = data.results.map((r) => ({
        url: r.urls.regular,
        thumb: r.urls.thumb,
        alt: r.alt_description ?? query,
        credit: `Photo by ${r.user.name} on Unsplash`,
        source: "unsplash" as const,
      }));
    } catch {
      // Fallback to picsum on error
      results = picsumFallback(query, count);
    }
  } else {
    // ── Picsum fallback (no API key needed) ───────────────────────
    results = picsumFallback(query, count);
  }

  return new Response(JSON.stringify({ query, results }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}

function picsumFallback(keyword: string, count: number): ImageResult[] {
  const seeds = [keyword, `${keyword}-2`, `${keyword}-3`, `${keyword}-4`, `${keyword}-5`, `${keyword}-6`];
  return seeds.slice(0, count).map((seed, i) => ({
    url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/800/500`,
    thumb: `https://picsum.photos/seed/${encodeURIComponent(seed)}/200/130`,
    alt: `${keyword} ${i + 1}`,
    credit: "Lorem Picsum",
    source: "picsum" as const,
  }));
}
