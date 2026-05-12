import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

type MimeType = "image/png" | "image/jpeg" | "image/webp";
type Columns = 1 | 2 | 3 | "sidebar";

interface LayoutPattern {
  columns: Columns;
  navPosition: "top" | "left" | "none";
  cardStyle: "list" | "grid" | "table" | "kanban";
  colorScheme: "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
}

interface TemplateMeta {
  id: string;
  category: string;
  priority: string;
  keywords: string[];
}

interface TemplateMatch {
  templateId: string;
  score: number;
  matchReason: string;
}

interface AnalyzeImageBody {
  base64Image?: string;
  mimeType?: MimeType;
  contextSummary?: string;
  templateMeta?: TemplateMeta[];
}

interface VercelRequest {
  method?: string;
  body?: AnalyzeImageBody;
}

interface VercelResponse {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  end: () => void;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const visionSystemPrompt = `You are a UI layout analysis expert. Analyze the provided UI screenshot.
Return ONLY valid JSON with this exact schema:
{
  "columns": 1 or 2 or 3 or "sidebar",
  "navPosition": "top" or "left" or "none",
  "cardStyle": "list" or "grid" or "table" or "kanban",
  "colorScheme": "light" or "dark",
  "density": "compact" or "comfortable" or "spacious"
}`;

function setCors(response: VercelResponse): void {
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));
}

function isMimeType(value: unknown): value is MimeType {
  return value === "image/png" || value === "image/jpeg" || value === "image/webp";
}

function normalizeLayoutPattern(raw: unknown): LayoutPattern {
  const value = typeof raw === "object" && raw !== null ? raw as Partial<LayoutPattern> : {};
  const columns: LayoutPattern["columns"] = value.columns === 1 || value.columns === 2 || value.columns === 3 || value.columns === "sidebar" ? value.columns : 1;
  const navPosition: LayoutPattern["navPosition"] = value.navPosition === "top" || value.navPosition === "left" || value.navPosition === "none" ? value.navPosition : "none";
  const cardStyle: LayoutPattern["cardStyle"] = value.cardStyle === "list" || value.cardStyle === "grid" || value.cardStyle === "table" || value.cardStyle === "kanban" ? value.cardStyle : "list";
  const colorScheme: LayoutPattern["colorScheme"] = value.colorScheme === "dark" ? "dark" : "light";
  const density: LayoutPattern["density"] = value.density === "compact" || value.density === "comfortable" || value.density === "spacious" ? value.density : "comfortable";
  return { columns, navPosition, cardStyle, colorScheme, density };
}

function scoreTemplates(layoutPattern: LayoutPattern, contextSummary: string, templateMeta: TemplateMeta[]): TemplateMatch[] {
  const summary = contextSummary.toLowerCase();
  return templateMeta
    .map((template) => {
      const reasons: string[] = [];
      let score = 0;
      const keywords = template.keywords.map((keyword) => keyword.toLowerCase());

      if (layoutPattern.columns === "sidebar" && keywords.some((keyword) => keyword === "dashboard" || keyword === "admin")) {
        score += 25;
        reasons.push("sidebar dashboard/admin layout");
      }
      if (layoutPattern.cardStyle === "table" && keywords.some((keyword) => keyword === "table" || keyword === "data")) {
        score += 25;
        reasons.push("table/data layout");
      }
      if (layoutPattern.cardStyle === "grid" && keywords.some((keyword) => keyword === "gallery" || keyword === "products")) {
        score += 25;
        reasons.push("grid gallery/products layout");
      }
      if (layoutPattern.navPosition === "left" && (template.category === "Developer" || template.category === "AI")) {
        score += 20;
        reasons.push("left navigation fits technical UI");
      }

      const summaryMatches = keywords.filter((keyword) => keyword.length >= 3 && summary.includes(keyword)).slice(0, 3);
      if (summaryMatches.length > 0) {
        score += Math.min(30, summaryMatches.length * 10);
        reasons.push(`context matched ${summaryMatches.join(", ")}`);
      }

      return {
        templateId: template.id,
        score: Math.min(100, score),
        matchReason: reasons.slice(0, 2).join("; ") || "Vision fallback ranking.",
      };
    })
    .sort((left, right) => right.score - left.score || left.templateId.localeCompare(right.templateId))
    .slice(0, 3);
}

export default async function handler(request: VercelRequest, response: VercelResponse): Promise<void> {
  setCors(response);

  if (request.method === "OPTIONS") {
    response.status(200).end();
    return;
  }

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { base64Image, mimeType, contextSummary = "", templateMeta = [] } = request.body ?? {};
  if (!base64Image || !isMimeType(mimeType) || templateMeta.length === 0) {
    response.status(400).json({ error: "Invalid request body." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: visionSystemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            { type: "text", text: contextSummary },
          ],
        },
      ],
    });

    const layoutPattern = normalizeLayoutPattern(JSON.parse(completion.choices[0]?.message.content ?? "{}"));
    response.status(200).json({
      layoutPattern,
      top3: scoreTemplates(layoutPattern, contextSummary, templateMeta),
    });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Image analysis failed." });
  }
}
