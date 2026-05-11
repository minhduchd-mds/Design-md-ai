type Columns = 1 | 2 | 3 | "sidebar";
type NavPosition = "top" | "left" | "none";
type CardStyle = "list" | "grid" | "table" | "kanban";
type ColorScheme = "light" | "dark";
type Density = "compact" | "comfortable" | "spacious";

interface LayoutPattern {
  columns: Columns;
  navPosition: NavPosition;
  cardStyle: CardStyle;
  colorScheme: ColorScheme;
  density: Density;
}

interface TemplateMeta {
  id: string;
  category: string;
  priority: string;
  keywords: string[];
}

interface AnalyzeImageRequest {
  base64Image: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  contextSummary: string;
  templateMeta: TemplateMeta[];
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
};

const VISION_SYSTEM_PROMPT =
  'You are a UI layout analysis expert. Analyze the provided UI screenshot. Return ONLY valid JSON matching this exact schema, no explanation: { "columns": 1 | 2 | 3 | "sidebar", "navPosition": "top" | "left" | "none", "cardStyle": "list" | "grid" | "table" | "kanban", "colorScheme": "light" | "dark", "density": "compact" | "comfortable" | "spacious" }';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}

function stripDataUrl(value: string): string {
  const commaIndex = value.indexOf(",");
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function parseLayoutPattern(raw: string): LayoutPattern {
  const parsed = JSON.parse(raw) as Partial<LayoutPattern>;
  return {
    columns: parsed.columns ?? 1,
    navPosition: parsed.navPosition ?? "none",
    cardStyle: parsed.cardStyle ?? "list",
    colorScheme: parsed.colorScheme ?? "light",
    density: parsed.density ?? "comfortable",
  };
}

function keywordScore(contextSummary: string, meta: TemplateMeta): number {
  const text = contextSummary.toLowerCase();
  const matches = meta.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
  return Math.min(30, matches * 10);
}

function scoreTemplate(layoutPattern: LayoutPattern, contextSummary: string, meta: TemplateMeta) {
  let score = keywordScore(contextSummary, meta);
  const keywords = meta.keywords.map((keyword) => keyword.toLowerCase());

  if (layoutPattern.columns === "sidebar" && keywords.some((keyword) => keyword.includes("dashboard") || keyword.includes("admin"))) {
    score += 25;
  }
  if (layoutPattern.cardStyle === "table" && keywords.some((keyword) => keyword.includes("table") || keyword.includes("data"))) {
    score += 25;
  }
  if (layoutPattern.cardStyle === "grid" && keywords.some((keyword) => keyword.includes("gallery") || keyword.includes("products"))) {
    score += 25;
  }
  if (layoutPattern.navPosition === "left" && (meta.category === "Developer" || meta.category === "AI")) {
    score += 20;
  }

  return {
    templateId: meta.id,
    score: Math.min(100, score),
    matchReason: `Vision matched ${layoutPattern.columns} columns, ${layoutPattern.navPosition} nav, ${layoutPattern.cardStyle} cards.`,
  };
}

async function callClaudeVision(body: AnalyzeImageRequest, apiKey: string): Promise<LayoutPattern> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      system: VISION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.mimeType,
                data: stripDataUrl(body.base64Image),
              },
            },
            {
              type: "text",
              text: body.contextSummary,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Claude Vision failed with ${response.status}`);
  }

  const result = await response.json();
  const text = result.content?.find((item: { type?: string; text?: string }) => item.type === "text" || item.text)?.text;
  if (!text) throw new Error("Claude Vision returned no text content.");
  return parseLayoutPattern(text);
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "ANTHROPIC_API_KEY is not configured." }, 500);
  }

  try {
    const body = (await request.json()) as AnalyzeImageRequest;
    const layoutPattern = await callClaudeVision(body, apiKey);
    const top3 = body.templateMeta
      .map((meta) => scoreTemplate(layoutPattern, body.contextSummary, meta))
      .sort((left, right) => right.score - left.score || left.templateId.localeCompare(right.templateId))
      .slice(0, 3);

    return jsonResponse({ layoutPattern, top3 });
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : "Unknown error." }, 500);
  }
});
