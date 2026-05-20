/**
 * project-frame/component-picker — Component selection and template section definitions.
 *
 * Pure functions for deduplicating, pattern-matching, and assigning components
 * to template layout sections (Dashboard, Landing page, etc.).
 */

import type { DesignSystemComponentInfo, FigmaProjectFrameRequest } from "../../../shared/types";

export function componentPickKey(component: DesignSystemComponentInfo): string {
  return component.componentKey ?? component.nodeId ?? `${component.source ?? "unknown"}:${component.pageName}:${component.name}`;
}

function dedupeComponents(components: DesignSystemComponentInfo[]): DesignSystemComponentInfo[] {
  const seen = new Set<string>();
  return components.filter(c => {
    const key = componentPickKey(c);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function pickComponents(
  components: DesignSystemComponentInfo[],
  pattern: RegExp,
  fallbackCount = 4,
  usedKeys = new Set<string>(),
): DesignSystemComponentInfo[] {
  const available = components.filter(c => !usedKeys.has(componentPickKey(c)));
  const realComponents = available.filter(c => c.source !== "suggested");
  const suggestedComponents = available.filter(c => c.source === "suggested");
  const matches = dedupeComponents([
    ...realComponents.filter(c => c.role ? pattern.test(c.role) : false),
    ...realComponents.filter(c => pattern.test(c.name)),
    ...suggestedComponents.filter(c => pattern.test(c.name) || (c.role ? pattern.test(c.role) : false)),
  ]);
  const selected = (matches.length > 0 ? matches : [...realComponents, ...suggestedComponents]).slice(0, fallbackCount);
  for (const c of selected) usedKeys.add(componentPickKey(c));
  return selected;
}

export function findMappedComponents(project: FigmaProjectFrameRequest, sectionTitle: string): DesignSystemComponentInfo[] {
  const mappedKeys = project.templateComponentMappings?.[sectionTitle] ?? [];
  if (mappedKeys.length === 0) return [];
  const componentsByKey = new Map(project.components.map(c => [componentPickKey(c), c]));
  return mappedKeys.map(k => componentsByKey.get(k)).filter((c): c is DesignSystemComponentInfo => !!c);
}

export function getSection(sections: { title: string; components: DesignSystemComponentInfo[] }[], title: string) {
  return sections.find(s => s.title === title) ?? { title, components: [] };
}

export function getTemplateSections(project: FigmaProjectFrameRequest): { title: string; components: DesignSystemComponentInfo[] }[] {
  const components = project.components;
  const usedKeys = new Set<string>();
  const pick = (title: string, pattern: RegExp, fallbackCount: number) => {
    const mapped = findMappedComponents(project, title).filter(c => !usedKeys.has(componentPickKey(c)));
    if (mapped.length > 0) {
      for (const c of mapped) usedKeys.add(componentPickKey(c));
      return mapped;
    }
    return pickComponents(components, pattern, fallbackCount, usedKeys);
  };

  switch (project.layoutTemplate) {
    case "Admin table":
      return [
        { title: "Header and filters", components: pick("Header and filters", /nav|header|filter|search|input|select|button/i, 6) },
        { title: "Table and pagination", components: pick("Table and pagination", /table|row|cell|pagination|checkbox|badge/i, 8) },
        { title: "Empty, loading, and error states", components: pick("Empty, loading, and error states", /empty|loading|skeleton|alert|toast|error/i, 4) },
      ];
    case "Settings":
      return [
        { title: "Settings navigation", components: pick("Settings navigation", /nav|tab|menu|sidebar/i, 4) },
        { title: "Form groups", components: pick("Form groups", /form|field|input|select|checkbox|radio|switch|button/i, 8) },
        { title: "Save and danger actions", components: pick("Save and danger actions", /button|alert|modal|dialog|toast/i, 5) },
      ];
    case "Landing page":
      return [
        { title: "Hero and primary CTA", components: pick("Hero and primary CTA", /hero|nav|button|badge|card/i, 6) },
        { title: "Feature grid", components: pick("Feature grid", /feature|card|tile|icon|badge/i, 8) },
        { title: "Pricing, proof, and footer", components: pick("Pricing, proof, and footer", /pricing|testimonial|logo|footer|card/i, 6) },
      ];
    case "Mobile app":
      return [
        { title: "Mobile shell", components: pick("Mobile shell", /mobile|nav|tab|bar|header/i, 4) },
        { title: "Content list", components: pick("Content list", /card|item|row|list|avatar|badge/i, 8) },
        { title: "Primary actions", components: pick("Primary actions", /button|input|modal|toast|empty/i, 6) },
      ];
    case "AI workspace":
      return [
        { title: "Conversation and sidebar", components: pick("Conversation and sidebar", /chat|conversation|message|sidebar|nav/i, 6) },
        { title: "Prompt composer", components: pick("Prompt composer", /prompt|input|textarea|button|select|model/i, 6) },
        { title: "Response, sources, and actions", components: pick("Response, sources, and actions", /response|source|citation|card|toolbar|button/i, 8) },
      ];
    case "Developer console":
      return [
        { title: "Console shell", components: pick("Console shell", /nav|sidebar|toolbar|command|menu/i, 6) },
        { title: "Resources and details", components: pick("Resources and details", /table|list|row|card|panel|detail/i, 8) },
        { title: "Logs and status", components: pick("Logs and status", /log|code|terminal|status|badge|alert/i, 6) },
      ];
    case "Dashboard":
    default:
      return [
        { title: "Navigation and header", components: pick("Navigation and header", /nav|header|menu|tab|button/i, 6) },
        { title: "KPI cards and charts", components: pick("KPI cards and charts", /metric|kpi|card|chart|graph|badge/i, 8) },
        { title: "Data table and activity", components: pick("Data table and activity", /table|row|list|activity|feed|avatar/i, 8) },
      ];
  }
}
