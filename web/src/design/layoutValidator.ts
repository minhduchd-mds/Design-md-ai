import type { DesignContext, ValidationReport } from "../../../shared/designContext";
import type { SerializedNode, SerializedPaint } from "../../../shared/types";
import { DESIGN_MD_TEMPLATES, type DesignMdTemplateCategory } from "./templateRegistry";

interface CategoryRequirements {
  components: string[];
  tokens: string[];
}

const CATEGORY_REQUIREMENTS: Record<DesignMdTemplateCategory, CategoryRequirements> = {
  AI: {
    components: ["Input", "Button", "Message", "Avatar", "Spinner"],
    tokens: ["--color-primary", "--color-surface"],
  },
  Automotive: {
    components: ["Hero", "Gallery", "Card", "Button", "SpecTable"],
    tokens: ["--color-primary", "--color-surface", "--color-accent"],
  },
  Commerce: {
    components: ["Card", "Button", "Badge", "Input", "Modal", "Toast"],
    tokens: ["--color-primary", "--color-success", "--color-danger"],
  },
  Developer: {
    components: ["Button", "Card", "Table", "Nav", "Badge", "CodeBlock"],
    tokens: ["--color-primary", "--color-surface", "--color-border"],
  },
  Finance: {
    components: ["Table", "Card", "Badge", "Chart", "Button", "Input"],
    tokens: ["--color-primary", "--color-success", "--color-danger"],
  },
  Media: {
    components: ["Card", "Gallery", "Player", "Nav", "Button"],
    tokens: ["--color-primary", "--color-surface", "--color-accent"],
  },
  Product: {
    components: ["Hero", "Button", "Card", "Nav", "Modal"],
    tokens: ["--color-primary", "--color-surface", "--color-border"],
  },
  Workspace: {
    components: ["Nav", "Table", "Card", "Button", "Input", "Modal"],
    tokens: ["--color-primary", "--color-surface", "--color-border"],
  },
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getTemplateCategory(templateId: string): DesignMdTemplateCategory {
  return DESIGN_MD_TEMPLATES.find((template) => template.id === templateId)?.category ?? "Product";
}

function collectComponentNames(nodes: SerializedNode[]): string[] {
  const names: string[] = [];
  const walk = (node: SerializedNode) => {
    names.push(node.componentName || node.name);
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return names;
}

function collectPaints(nodes: SerializedNode[]): SerializedPaint[] {
  const paints: SerializedPaint[] = [];
  const walk = (node: SerializedNode) => {
    paints.push(...(node.fills ?? []), ...(node.strokes ?? []));
    node.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return paints;
}

function hasRequiredComponent(availableNames: string[], required: string): boolean {
  const target = normalize(required);
  return availableNames.some((name) => normalize(name).includes(target));
}

export function validateComponents(context: DesignContext, templateId: string): { missing: string[]; score: number } {
  const required = CATEGORY_REQUIREMENTS[getTemplateCategory(templateId)].components;
  const availableNames = collectComponentNames(context.components);
  const missing = required.filter((component) => !hasRequiredComponent(availableNames, component));
  const score = required.length === 0 ? 100 : Math.round(((required.length - missing.length) / required.length) * 100);
  return { missing, score };
}

export function validateColorTokens(context: DesignContext, templateId: string): { gaps: string[]; score: number } {
  const required = CATEGORY_REQUIREMENTS[getTemplateCategory(templateId)].tokens;
  const paints = collectPaints(context.components);
  const variableNames = paints.map((paint) => paint.variableName ?? "").filter(Boolean);
  const gaps = required.filter((token) => {
    const target = normalize(token);
    return !variableNames.some((name) => normalize(name).includes(target.replace(/^color/, "")) || target.includes(normalize(name)));
  });
  const score = required.length === 0 ? 100 : Math.round(((required.length - gaps.length) / required.length) * 100);
  return { gaps, score };
}

export function validateNaming(context: DesignContext): { score: number; issues: string[] } {
  const names = collectComponentNames(context.components);
  if (names.length === 0) return { score: 0, issues: ["No components available for naming validation."] };

  const issues = names.filter((name) => !/^[A-Z][A-Za-z0-9/ -]*$/.test(name) || name.trim().length < 3);
  return {
    score: Math.round(((names.length - issues.length) / names.length) * 100),
    issues,
  };
}

export function computeValidationReport(context: DesignContext, templateId: string): ValidationReport {
  const componentResult = validateComponents(context, templateId);
  const tokenResult = validateColorTokens(context, templateId);
  const namingResult = validateNaming(context);
  const readinessScore = Math.round(componentResult.score * 0.5 + tokenResult.score * 0.3 + namingResult.score * 0.2);

  return {
    missingComponents: componentResult.missing,
    missingTokens: tokenResult.gaps,
    componentScore: componentResult.score,
    tokenScore: tokenResult.score,
    namingScore: namingResult.score,
    readinessScore,
    canProceed: readinessScore >= 60,
  };
}
