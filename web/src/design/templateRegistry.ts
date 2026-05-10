export interface DesignMdTemplate {
  id: string;
  label: string;
  markdown: string;
  readme?: string;
}

const designModules = import.meta.glob("../design-md-templates/*/DESIGN.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const readmeModules = import.meta.glob("../design-md-templates/*/README.md", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

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

export const DESIGN_MD_TEMPLATES: DesignMdTemplate[] = Object.entries(designModules)
  .map(([path, markdown]) => {
    const folder = folderName(path);
    const readmePath = path.replace(/DESIGN\.md$/, "README.md");
    return {
      id: normalizeId(folder),
      label: formatLabel(folder),
      markdown,
      readme: readmeModules[readmePath],
    };
  })
  .sort((left, right) => left.label.localeCompare(right.label));
