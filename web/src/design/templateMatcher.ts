import type { DesignContext, TemplateMatch } from "../../../shared/designContext";
import { DESIGN_MD_TEMPLATES, type DesignMdTemplateMeta } from "./templateRegistry";

function includesIgnoreCase(source: string, value: string): boolean {
  return source.toLowerCase().includes(value.toLowerCase());
}

function keywordOverlap(left: string[], right: string[]): string[] {
  const normalizedRight = new Set(right.map((item) => item.toLowerCase()));
  return left.filter((item) => normalizedRight.has(item.toLowerCase()));
}

function isUsableKeyword(keyword: string): boolean {
  return keyword.length >= 3 || ["ai", "ba", "ui", "ux"].includes(keyword.toLowerCase());
}

export function scoreTemplate(context: DesignContext, meta: DesignMdTemplateMeta): TemplateMatch {
  const reasons: string[] = [];
  let score = 0;
  const prompt = context.prompt.toLowerCase();
  const docs = context.docs.map((doc) => doc.content.toLowerCase()).join("\n");

  const promptKeywords = meta.keywords.filter((keyword) => isUsableKeyword(keyword) && includesIgnoreCase(prompt, keyword));
  if (promptKeywords.length > 0) {
    score += 20;
    reasons.push(`prompt matched ${promptKeywords.slice(0, 3).join(", ")}`);
  }

  if (includesIgnoreCase(prompt, meta.category)) {
    score += 20;
    reasons.push(`prompt category matched ${meta.category}`);
  }

  if (includesIgnoreCase(docs, meta.category)) {
    score += 15;
    reasons.push(`documents mention ${meta.category}`);
  }

  if (context.components.length > 0 && meta.priority === "Technical") {
    score += 15;
    reasons.push("technical template fits scanned components");
  }

  if (context.components.length === 0 && meta.priority === "Product") {
    score += 15;
    reasons.push("product template fits bootstrap mode");
  }

  const bootstrapMatches = keywordOverlap(meta.keywords, context.bootstrapSuggestions);
  if (bootstrapMatches.length > 0) {
    score += 15;
    reasons.push(`bootstrap matched ${bootstrapMatches.slice(0, 3).join(", ")}`);
  }

  return {
    templateId: meta.id,
    score: Math.min(100, score),
    matchReason: reasons.length > 0 ? reasons.join("; ") : "No strong match; ranked by registry fallback.",
  };
}

export function matchTemplates(context: DesignContext): TemplateMatch[] {
  return DESIGN_MD_TEMPLATES.map((meta) => scoreTemplate(context, meta))
    .sort((left, right) => right.score - left.score || left.templateId.localeCompare(right.templateId))
    .slice(0, 3);
}
