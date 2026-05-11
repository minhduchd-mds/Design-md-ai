import type { DesignContext } from "../../../shared/designContext";
import { sanitize } from "../../../shared/sanitize";
import { loadDesignMdTemplate } from "./templateRegistry";

export interface Screen {
  name: string;
  markdown: string;
  components: string[];
  colorTokens: string[];
}

interface ClaudeResponse {
  content?: Array<{ type?: string; text?: string }>;
}

const SCREEN_NAMES = ["Login / Onboarding", "Main Dashboard", "Detail / Item View", "Form / Create / Edit", "Settings / Profile"];

function extractComponentNames(markdown: string): string[] {
  return Array.from(
    new Set(
      markdown
        .split("\n")
        .map((line) => line.match(/^\|\s*([^|]+?)\s*\|/)?.[1]?.trim())
        .filter((value): value is string => !!value && !/^component$/i.test(value) && !/^-+$/.test(value)),
    ),
  );
}

function extractColorTokens(markdown: string): string[] {
  return Array.from(new Set(markdown.match(/--[a-z0-9-]+/gi) ?? []));
}

function createSkeletonScreen(name: string, context: DesignContext): Screen {
  const components = context.components.map((component) => component.componentName || component.name).filter(Boolean).slice(0, 5);
  const markdown = `## Screen: ${name}

### Purpose
Define the ${name} experience for the selected project.

### Layout
- Grid: ${context.layoutPattern?.columns ?? 1}
- Nav: ${context.layoutPattern?.navPosition ?? "none"}
- Key regions: Header, content, primary action, feedback state

### Components
| Component | Variant | Props |
|-----------|---------|-------|
${(components.length > 0 ? components : ["Button", "Card", "Input"]).map((component) => `| ${component} | Default | TBD |`).join("\n")}

### Color tokens
- --color-primary: Primary actions
- --color-surface: Page and panel surfaces
- --color-border: Separators and controls

### Spacing
- Use an 8px base spacing scale.
- Keep form rows and action groups stable across breakpoints.

### Interactions
- Show loading, empty, error, success, and disabled states.
- Keep destructive actions behind confirmation.
`;

  return {
    name,
    markdown,
    components,
    colorTokens: extractColorTokens(markdown),
  };
}

export function parseScreensFromMarkdown(markdown: string): Screen[] {
  return markdown
    .split(/(?=^## Screen:\s+)/gm)
    .map((section) => section.trim())
    .filter((section) => section.startsWith("## Screen:"))
    .map((section) => {
      const name = section.match(/^## Screen:\s+(.+)$/m)?.[1]?.trim() ?? "Untitled";
      return {
        name,
        markdown: section,
        components: extractComponentNames(section),
        colorTokens: extractColorTokens(section),
      };
    });
}

async function buildGenerationPrompt(context: DesignContext): Promise<string> {
  const template = context.selectedTemplateId ? await loadDesignMdTemplate(context.selectedTemplateId) : null;
  const selectedTemplate = template?.label ?? context.selectedTemplateId ?? "Unselected";
  const components = context.components.map((component) => component.componentName || component.name).join(", ");
  const docs = sanitize(context.docs.map((doc) => doc.content).join("\n")).slice(0, 2000);

  return `Generate a complete DESIGN.md specification for a ${selectedTemplate} project.

Project context:
- Prompt: ${context.prompt}
- Available components: ${components}
- Template: ${selectedTemplate}
- Bootstrap suggestions: ${context.bootstrapSuggestions.join(", ")}
- Layout pattern detected: ${JSON.stringify(context.layoutPattern)}
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

async function callClaudeForScreens(context: DesignContext): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("VITE_ANTHROPIC_API_KEY is not configured.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system:
        "You are a senior UI/UX designer creating DESIGN.md specifications for AI coding agents. Generate precise, structured markdown that Claude Code, Cursor, and Windsurf can follow directly without ambiguity.",
      messages: [{ role: "user", content: await buildGenerationPrompt(context) }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Screen generation failed with ${response.status}.`);
  }

  const result = (await response.json()) as ClaudeResponse;
  const text = result.content?.find((item) => item.type === "text" || item.text)?.text;
  if (!text) throw new Error("Screen generation returned no text content.");
  return text;
}

export async function generateScreens(context: DesignContext): Promise<Screen[]> {
  try {
    const markdown = await callClaudeForScreens(context);
    const screens = parseScreensFromMarkdown(markdown);
    return screens.length === 5 ? screens : SCREEN_NAMES.map((name) => createSkeletonScreen(name, context));
  } catch {
    return SCREEN_NAMES.map((name) => createSkeletonScreen(name, context));
  }
}
