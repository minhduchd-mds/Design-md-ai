/**
 * figma-import — Design system import from Figma.
 *
 * Split into modules:
 *   - variables.ts  — variable & color token reading
 *   - components.ts — component discovery across registries/pages
 */

import type {
  PluginMessage,
  DesignSystemVariableInfo,
  DesignSystemComponentInfo,
  DesignSystemSnapshot,
  FigmaImportSource,
} from "../../../shared/types";
import {
  normalizeTokenName,
  colorToHex,
  isColorValue,
  readAllLocalColorVariables,
  readDesignSystemVariables,
} from "./variables";
import {
  createDiagnostics,
  readAllFileComponents,
  summarizeAllPages,
} from "./components";

export async function sendDesignSystemSnapshot(): Promise<void> {
  let variables: DesignSystemVariableInfo[] = [];
  let components: DesignSystemComponentInfo[] = [];
  const diagnostics = createDiagnostics();

  try {
    variables = await readDesignSystemVariables();
  } catch (e) {
    console.warn("Could not read design system variables:", e);
  }

  try {
    components = await readAllFileComponents(diagnostics);
  } catch (e) {
    diagnostics.errors.push(`component sync: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read design system components:", e);
  }

  const snapshot: DesignSystemSnapshot = {
    fileName: figma.root.name,
    pageName: components.length > 0 ? "All pages" : figma.currentPage.name,
    pages: summarizeAllPages(components),
    components,
    variables,
    diagnostics,
  };

  figma.ui.postMessage({ type: "design-system-snapshot-result", snapshot } satisfies PluginMessage);
}

export async function importFigmaColorVariables(): Promise<void> {
  try {
    const tokens = await readAllLocalColorVariables();
    const msg: PluginMessage = {
      type: "figma-color-variables-result",
      tokens,
      fileName: figma.root.name,
      count: Object.keys(tokens).length,
    };
    figma.ui.postMessage(msg);
  } catch (e) {
    console.warn("Could not read color variables:", e);
    figma.ui.postMessage({ type: "figma-color-variables-result", tokens: {}, fileName: figma.root.name, count: 0 });
  }
}

export async function discoverFigmaSources(): Promise<void> {
  const sources: FigmaImportSource[] = [];

  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const variables = await figma.variables.getLocalVariablesAsync();

    const collStats = new Map<string, { colors: number; floats: number; strings: number }>();
    for (const coll of collections) {
      collStats.set(coll.id, { colors: 0, floats: 0, strings: 0 });
    }
    for (const v of variables) {
      const c = collStats.get(v.variableCollectionId);
      if (!c) continue;
      if (v.resolvedType === "COLOR") c.colors++;
      else if (v.resolvedType === "FLOAT") c.floats++;
      else if (v.resolvedType === "STRING") c.strings++;
    }

    for (const coll of collections) {
      const c = collStats.get(coll.id)!;
      const total = c.colors + c.floats + c.strings;
      if (total === 0) continue;
      const parts: string[] = [];
      if (c.colors > 0) parts.push(`${c.colors} colors`);
      if (c.floats > 0) parts.push(`${c.floats} numbers`);
      if (c.strings > 0) parts.push(`${c.strings} strings`);
      sources.push({ id: `vars:${coll.id}`, name: coll.name, type: "local-variables", count: total, detail: parts.join(", ") });
    }
  } catch (e) {
    console.warn("Could not read variables:", e);
  }

  try {
    const paintStyles = await figma.getLocalPaintStylesAsync();
    if (paintStyles.length > 0) {
      sources.push({ id: "styles:paint", name: "Color Styles", type: "local-styles", count: paintStyles.length, detail: `${paintStyles.length} paint styles` });
    }
  } catch (e) {
    console.warn("Could not read paint styles:", e);
  }

  sources.push({ id: "local:components", name: "Local Components", type: "local-components", count: 0, detail: "Components in this file" });

  const msg: PluginMessage = { type: "figma-sources-result", sources };
  figma.ui.postMessage(msg);
}

export async function importFigmaTokens(sourceIds: string[]): Promise<void> {
  const tokens: Record<string, string> = {};
  const componentNames: string[] = [];
  const selectedSet = new Set(sourceIds);

  try {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const collModeMap = new Map<string, string>();
    for (const coll of collections) {
      if (selectedSet.has(`vars:${coll.id}`) && coll.modes.length > 0) {
        collModeMap.set(coll.id, coll.modes[0].modeId);
      }
    }

    if (collModeMap.size > 0) {
      const variables = await figma.variables.getLocalVariablesAsync();
      for (const v of variables) {
        const modeId = collModeMap.get(v.variableCollectionId);
        if (!modeId) continue;
        const value = v.valuesByMode[modeId];
        if (value === undefined) continue;
        const name = normalizeTokenName(v.name);

        if (v.resolvedType === "COLOR" && isColorValue(value)) {
          tokens[name] = colorToHex(value);
        } else if (v.resolvedType === "FLOAT" && typeof value === "number") {
          tokens[name] = `${value}px`;
        } else if (v.resolvedType === "STRING" && typeof value === "string") {
          tokens[name] = value;
        }
      }
    }
  } catch (e) {
    console.warn("Could not read variables:", e);
  }

  if (selectedSet.has("styles:paint")) {
    try {
      const paintStyles = await figma.getLocalPaintStylesAsync();
      for (const style of paintStyles) {
        if (style.paints.length > 0 && style.paints[0].type === "SOLID") {
          const paint = style.paints[0] as SolidPaint;
          tokens[normalizeTokenName(style.name)] = colorToHex(paint.color);
        }
      }
    } catch (e) {
      console.warn("Could not read paint styles:", e);
    }
  }

  if (selectedSet.has("local:components")) {
    try {
      const seen = new Set<string>();
      const components = await readAllFileComponents(createDiagnostics());
      for (const comp of components) {
        const key = `${comp.pageName}/${comp.name}`;
        if (!seen.has(key)) {
          seen.add(key);
          componentNames.push(comp.name);
        }
      }
    } catch (e) {
      console.warn("Could not read components:", e);
    }
  }

  const fileName = figma.root.name;
  const msg: PluginMessage = { type: "figma-tokens-result", tokens, components: componentNames, fileName };
  figma.ui.postMessage(msg);
}

export async function handleFigmaImportMessage(msg: PluginMessage): Promise<boolean> {
  switch (msg.type) {
    case "get-figma-sources":
      try {
        await discoverFigmaSources();
      } catch (e) {
        console.warn("discoverFigmaSources failed:", e);
        figma.ui.postMessage({ type: "figma-sources-result", sources: [] });
      }
      return true;
    case "import-figma-tokens":
      try {
        await importFigmaTokens(msg.sourceIds);
      } catch (e) {
        console.warn("importFigmaTokens failed:", e);
        figma.ui.postMessage({ type: "figma-tokens-result", tokens: {}, components: [], fileName: figma.root.name });
      }
      return true;
    case "get-figma-color-variables":
      await importFigmaColorVariables();
      return true;
    case "get-design-system-snapshot":
      await sendDesignSystemSnapshot();
      return true;
    default:
      return false;
  }
}
