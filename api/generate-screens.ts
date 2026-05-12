import OpenAI from "openai";

export const config = { api: { bodyParser: true } };

interface DesignContextPayload {
  components?: Array<{ name?: string; componentName?: string }>;
  docs?: Array<{ content: string }>;
  prompt?: string;
  bootstrapSuggestions?: string[];
  selectedTemplateId?: string | null;
  layoutPattern?: unknown;
}

interface GenerateScreensBody {
  context?: DesignContextPayload;
  selectedTemplateLabel?: string;
}

interface VercelRequest {
  method?: string;
  body?: GenerateScreensBody;
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

const systemPrompt =
  "You are a senior UI/UX designer creating DESIGN.md specifications for AI coding agents (GPT, Claude Code, Cursor, Windsurf). Generate precise, structured markdown. Be specific about component variants, props, and token names. Do not add preamble or explanation - output ONLY the markdown specification.";

function setCors(response: VercelResponse): void {
  Object.entries(corsHeaders).forEach(([key, value]) => response.setHeader(key, value));
}

function sanitize(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[^\x20-\x7E\n\r\t\u00C0-\u024F\u4E00-\u9FFF]/g, "")
    .trim()
    .slice(0, 10000);
}

function buildGenerationPrompt(context: DesignContextPayload, selectedTemplateLabel: string): string {
  const components = (context.components ?? []).map((component) => component.componentName || component.name).filter(Boolean).join(", ");
  const docs = sanitize((context.docs ?? []).map((doc) => doc.content).join("\n")).slice(0, 2000);

  return `Generate a complete DESIGN.md specification for a ${selectedTemplateLabel} project.

Project context:
- Prompt: ${sanitize(context.prompt ?? "")}
- Available components: ${components || "None (use bootstrap suggestions)"}
- Template: ${selectedTemplateLabel}
- Bootstrap suggestions: ${(context.bootstrapSuggestions ?? []).join(", ")}
- Layout pattern detected: ${JSON.stringify(context.layoutPattern ?? null)}
- BA documentation summary: ${docs}

Generate specifications for exactly these 5 screens:
1. Login / Onboarding
2. Main Dashboard
3. Detail / Item View
4. Form / Create / Edit
5. Settings / Profile

For EACH screen use this exact structure:

## Screen: [Screen Name]

### Purpose
[1 sentence]

### Layout
- Grid: [columns]
- Nav: [position]
- Key regions: [list]

### Components
| Component | Variant | Props |
|-----------|---------|-------|
[rows]

### Color tokens
[list of --token-name: purpose]

### Spacing
[key spacing rules]

### Interactions
[key user interactions]`;
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "OPENAI_API_KEY is not configured." });
    return;
  }

  try {
    const context = request.body?.context ?? {};
    const selectedTemplateLabel = sanitize(request.body?.selectedTemplateLabel ?? context.selectedTemplateId ?? "Unselected");
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildGenerationPrompt(context, selectedTemplateLabel) },
      ],
    });

    response.status(200).json({ markdown: completion.choices[0]?.message.content ?? "" });
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "Screen generation failed." });
  }
}
