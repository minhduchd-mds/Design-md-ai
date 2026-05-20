/**
 * figma-import/variables — Read Figma design variables and color tokens.
 *
 * Handles variable collection discovery, color alias resolution,
 * and token export for the design system snapshot.
 */

import type { DesignSystemVariableInfo } from "../../../shared/types";

export function normalizeTokenName(name: string): string {
  return name.replace(/\//g, "-").toLowerCase();
}

export function colorToHex(color: { r: number; g: number; b: number }): string {
  return `#${Math.round(color.r * 255).toString(16).padStart(2, "0")}${Math.round(color.g * 255).toString(16).padStart(2, "0")}${Math.round(color.b * 255).toString(16).padStart(2, "0")}`;
}

export function isColorValue(value: unknown): value is { r: number; g: number; b: number; a: number } {
  return typeof value === "object" && value !== null && "r" in value && "g" in value && "b" in value;
}

export function isVariableAlias(value: unknown): value is { type: "VARIABLE_ALIAS"; id: string } {
  return typeof value === "object" && value !== null && "type" in value && (value as { type?: string }).type === "VARIABLE_ALIAS" && "id" in value;
}

export async function resolveColorVariableValue(
  value: unknown,
  modeIdByCollectionId: Map<string, string>,
  seen = new Set<string>(),
): Promise<string | null> {
  if (isColorValue(value)) {
    return colorToHex(value);
  }

  if (!isVariableAlias(value) || seen.has(value.id)) {
    return null;
  }

  seen.add(value.id);
  const target = await figma.variables.getVariableByIdAsync(value.id);
  if (!target) return null;
  const targetModeId = modeIdByCollectionId.get(target.variableCollectionId);
  if (!targetModeId) return null;
  return resolveColorVariableValue(target.valuesByMode[targetModeId], modeIdByCollectionId, seen);
}

export async function readAllLocalColorVariables(): Promise<Record<string, string>> {
  const tokens: Record<string, string> = {};
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const modeIdByCollectionId = new Map<string, string>();

  for (const coll of collections) {
    const preferredMode =
      coll.modes.find((mode) => mode.name.toLowerCase() === "light") ??
      coll.modes.find((mode) => /default|base/i.test(mode.name)) ??
      coll.modes[0];
    if (preferredMode) {
      modeIdByCollectionId.set(coll.id, preferredMode.modeId);
    }
  }

  const variables = await figma.variables.getLocalVariablesAsync("COLOR");
  for (const variable of variables) {
    const modeId = modeIdByCollectionId.get(variable.variableCollectionId);
    if (!modeId) continue;
    const hex = await resolveColorVariableValue(variable.valuesByMode[modeId], modeIdByCollectionId);
    if (hex) {
      tokens[normalizeTokenName(variable.name)] = hex;
    }
  }

  return tokens;
}

function variableValueToString(value: unknown, resolvedType: VariableResolvedDataType): string | null {
  if (resolvedType === "COLOR" && isColorValue(value)) {
    return colorToHex(value);
  }
  if (resolvedType === "FLOAT" && typeof value === "number") {
    return `${value}`;
  }
  if (resolvedType === "STRING" && typeof value === "string") {
    return value;
  }
  if (resolvedType === "BOOLEAN" && typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (isVariableAlias(value)) {
    return `alias:${value.id}`;
  }
  return null;
}

export async function readDesignSystemVariables(): Promise<DesignSystemVariableInfo[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));
  const variables = await figma.variables.getLocalVariablesAsync();
  const result: DesignSystemVariableInfo[] = [];

  for (const variable of variables) {
    const collection = collectionById.get(variable.variableCollectionId);
    if (!collection) continue;
    const preferredMode =
      collection.modes.find((mode) => mode.name.toLowerCase() === "light") ??
      collection.modes.find((mode) => /default|base/i.test(mode.name)) ??
      collection.modes[0];
    if (!preferredMode) continue;
    const rawValue = variable.valuesByMode[preferredMode.modeId];
    const value = variableValueToString(rawValue, variable.resolvedType);
    if (value === null) continue;

    result.push({
      id: variable.id,
      name: variable.name,
      collectionName: collection.name,
      modeName: preferredMode.name,
      resolvedType: variable.resolvedType,
      value,
    });
  }

  return result.sort((a, b) => `${a.collectionName}/${a.name}`.localeCompare(`${b.collectionName}/${b.name}`));
}
