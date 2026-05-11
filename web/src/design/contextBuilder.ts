import JSZip from "jszip";
import type { SerializedNode } from "../../../shared/types";
import type { DesignContext, DocSource } from "../../../shared/designContext";
import { createEmptyContext } from "../../../shared/designContext";
import { sanitize } from "../../../shared/sanitize";

const BOOTSTRAP_SYSTEM_PROMPT =
  'You are a UI design system expert. The user is starting a new project with no existing components. Based on their project description and any BA documentation provided, suggest the minimal component set needed. Return ONLY a JSON array of component names, no explanation. Example: ["Button","Input","Card","Modal","Toast","Nav","Table"] Limit to 12 components maximum.';

export interface InputSources {
  pluginScanResult: SerializedNode[] | null;
  variableCount?: number;
  pageCount?: number;
  uploadedFiles: File[];
  textPrompt: string;
}

interface BootstrapResponse {
  content?: Array<{ type?: string; text?: string }>;
}

function getFileType(fileName: string): "md" | "txt" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".txt")) return "txt";
  return null;
}

async function readTextFile(file: File, type: "md" | "txt"): Promise<DocSource> {
  return {
    filename: file.name,
    content: await file.text(),
    type,
  };
}

async function parseZipFile(file: File): Promise<DocSource[]> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => {
    if (entry.dir) return false;
    const type = getFileType(entry.name);
    return type === "md" || type === "txt";
  });

  return Promise.all(
    entries.map(async (entry) => ({
      filename: entry.name,
      content: await entry.async("text"),
      type: "zip-entry" as const,
    })),
  );
}

export async function parseFileSources(files: File[]): Promise<DocSource[]> {
  const docs: DocSource[] = [];

  for (const file of files) {
    const type = getFileType(file.name);
    if (type) {
      docs.push(await readTextFile(file, type));
      continue;
    }

    if (file.name.toLowerCase().endsWith(".zip") || file.type === "application/zip") {
      docs.push(...(await parseZipFile(file)));
    }
  }

  return docs;
}

function parseBootstrapSuggestions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").map((item) => sanitize(item)).filter(Boolean).slice(0, 12);
  } catch {
    return [];
  }
}

async function fetchBootstrapSuggestions(prompt: string, docs: DocSource[]): Promise<string[]> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  const userContent = sanitize(
    [
      prompt,
      ...docs.map((doc) => `${doc.filename}\n${doc.content}`),
    ].join("\n\n"),
  );

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
      system: BOOTSTRAP_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!response.ok) return [];

  const result = (await response.json()) as BootstrapResponse;
  const text = result.content?.find((item) => item.type === "text" || item.text)?.text ?? "";
  return parseBootstrapSuggestions(text);
}

export async function buildContext(sources: InputSources): Promise<DesignContext> {
  const context = createEmptyContext();
  context.components = sources.pluginScanResult ?? [];
  context.variableCount = sources.variableCount ?? 0;
  context.pageCount = sources.pageCount ?? 0;
  context.docs = await parseFileSources(sources.uploadedFiles);
  context.prompt = sanitize(sources.textPrompt);

  if (context.components.length === 0) {
    context.bootstrapSuggestions = await fetchBootstrapSuggestions(context.prompt, context.docs);
  }

  return context;
}
