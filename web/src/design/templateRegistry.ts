export interface DesignMdTemplate {
  id: string;
  label: string;
  markdown: string;
  readme?: string;
}

export interface DesignMdTemplateMeta {
  id: string;
  label: string;
}

const designModules = import.meta.glob("../design-md-templates/*/DESIGN.md", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;

function folderName(path: string): string {
  return path.split("/").at(-2) ?? "template";
}

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "template";
}

function formatLabel(value: string): string {
  return value
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/\bAi\b/g, "AI")
    .replace(/\bBmw\b/g, "BMW")
    .replace(/\bIbm\b/g, "IBM")
    .replace(/\bX AI\b/g, "xAI");
}

const templatePathById = new Map<string, string>();

export const DESIGN_MD_TEMPLATES: DesignMdTemplateMeta[] = Object.keys(designModules)
  .map((path) => {
    const folder = folderName(path);
    const id = normalizeId(folder);
    templatePathById.set(id, path);
    return { id, label: formatLabel(folder) };
  })
  .sort((left, right) => left.label.localeCompare(right.label));

export function hasDesignMdTemplate(id: string): boolean {
  return templatePathById.has(id);
}

export async function loadDesignMdTemplate(id: string): Promise<DesignMdTemplate | null> {
  const path = templatePathById.get(id);
  if (!path) return null;

  const markdown = await designModules[path]();
  const meta = DESIGN_MD_TEMPLATES.find((template) => template.id === id);

  return {
    id,
    label: meta?.label ?? formatLabel(folderName(path)),
    markdown,
  };
}
