/**
 * figma-import/components — Read components from Figma document.
 *
 * Discovers components from local registries, team libraries,
 * document pages, and resolved instances. Deduplicates by key.
 */

import type {
  DesignSystemComponentInfo,
  DesignSystemPageInfo,
  DesignSystemSyncDiagnostics,
} from "../../../shared/types";

function getNodePageName(node: BaseNode): string {
  let parent = node.parent;
  while (parent) {
    if (parent.type === "PAGE") return parent.name;
    parent = parent.parent;
  }
  return figma.currentPage.name;
}

export function createDiagnostics(): DesignSystemSyncDiagnostics {
  return {
    localRegistryComponents: 0,
    localRegistryComponentSets: 0,
    libraryComponents: 0,
    libraryComponentSets: 0,
    documentComponents: 0,
    documentComponentSets: 0,
    instances: 0,
    resolvedInstanceComponents: 0,
    errors: [],
  };
}

export function inferComponentRole(name: string): DesignSystemComponentInfo["role"] {
  const value = name.toLowerCase();
  if (/nav|menu|sidebar|breadcrumb|tab|header|topbar/.test(value)) return "navigation";
  if (/kpi|metric|stat|summary/.test(value)) return "kpi";
  if (/chart|graph|plot|analytics/.test(value)) return "chart";
  if (/table|row|cell|pagination|grid/.test(value)) return "table";
  if (/form|field|input|select|checkbox|radio|switch|textarea|search|filter/.test(value)) return "form";
  if (/modal|dialog|drawer|popover|toast|alert/.test(value)) return "modal";
  if (/card|tile|panel/.test(value)) return "card";
  if (/list|item|feed|activity|notification/.test(value)) return "list";
  if (/button|cta|action|toolbar/.test(value)) return "action";
  if (/hero|footer|content|section|article|text/.test(value)) return "content";
  return "unknown";
}

export async function readAllFileComponents(diagnostics: DesignSystemSyncDiagnostics): Promise<DesignSystemComponentInfo[]> {
  await figma.loadAllPagesAsync();
  figma.skipInvisibleInstanceChildren = true;

  const results = new Map<string, DesignSystemComponentInfo>();

  function addComponentNode(node: ComponentNode | ComponentSetNode, pageName = getNodePageName(node), source: DesignSystemComponentInfo["source"] = "local") {
    const componentSet = node.type === "COMPONENT_SET" ? node : node.parent?.type === "COMPONENT_SET" ? node.parent : null;
    const sourceNode = componentSet ?? node;
    const key = sourceNode.key || sourceNode.id;
    if (results.has(key)) return;

    const info: DesignSystemComponentInfo = {
      id: sourceNode.id,
      nodeId: sourceNode.id,
      componentKey: sourceNode.key || undefined,
      name: sourceNode.name,
      type: sourceNode.type,
      pageName: getNodePageName(sourceNode) || pageName,
      source,
      role: inferComponentRole(sourceNode.name),
    };

    if ("description" in sourceNode && sourceNode.description?.trim()) {
      info.description = sourceNode.description.trim();
    }

    if (componentSet) {
      const definitions = componentSet.componentPropertyDefinitions;
      const variantProperties: Record<string, string[]> = {};
      for (const [name, def] of Object.entries(definitions)) {
        if (def.type === "VARIANT" && "variantOptions" in def && def.variantOptions) {
          variantProperties[name] = [...def.variantOptions];
        }
      }
      if (Object.keys(variantProperties).length > 0) {
        info.variantProperties = variantProperties;
      }
    }

    results.set(key, info);
  }

  type FigmaWithComponentRegistries = typeof figma & {
    getLocalComponentsAsync?: () => Promise<ComponentNode[]>;
    getLocalComponentSetsAsync?: () => Promise<ComponentSetNode[]>;
    teamLibrary?: typeof figma.teamLibrary & {
      getAvailableComponentsAsync?: () => Promise<Array<{ key: string; name: string; description?: string; libraryName?: string }>>;
      getAvailableComponentSetsAsync?: () => Promise<Array<{ key: string; name: string; description?: string; libraryName?: string }>>;
    };
  };
  const figmaWithRegistries = figma as FigmaWithComponentRegistries;

  try {
    const localComponents = await figmaWithRegistries.getLocalComponentsAsync?.();
    diagnostics.localRegistryComponents = localComponents?.length ?? 0;
    for (const node of localComponents ?? []) {
      addComponentNode(node);
    }
  } catch (e) {
    diagnostics.errors.push(`local components registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read local component registry:", e);
  }

  try {
    const localComponentSets = await figmaWithRegistries.getLocalComponentSetsAsync?.();
    diagnostics.localRegistryComponentSets = localComponentSets?.length ?? 0;
    for (const node of localComponentSets ?? []) {
      addComponentNode(node);
    }
  } catch (e) {
    diagnostics.errors.push(`local component set registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read local component set registry:", e);
  }

  try {
    const libraryComponents = await figmaWithRegistries.teamLibrary?.getAvailableComponentsAsync?.();
    diagnostics.libraryComponents = libraryComponents?.length ?? 0;
    for (const component of libraryComponents ?? []) {
      results.set(`library-component:${component.key}`, {
        id: component.key,
        componentKey: component.key,
        name: component.name,
        type: "COMPONENT",
        pageName: component.libraryName ? `Library: ${component.libraryName}` : "Library",
        source: "library",
        role: inferComponentRole(component.name),
        description: component.description,
      });
    }
  } catch (e) {
    diagnostics.errors.push(`library components registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read available library components:", e);
  }

  try {
    const libraryComponentSets = await figmaWithRegistries.teamLibrary?.getAvailableComponentSetsAsync?.();
    diagnostics.libraryComponentSets = libraryComponentSets?.length ?? 0;
    for (const componentSet of libraryComponentSets ?? []) {
      results.set(`library-component-set:${componentSet.key}`, {
        id: componentSet.key,
        componentKey: componentSet.key,
        name: componentSet.name,
        type: "COMPONENT_SET",
        pageName: componentSet.libraryName ? `Library: ${componentSet.libraryName}` : "Library",
        source: "library",
        role: inferComponentRole(componentSet.name),
        description: componentSet.description,
      });
    }
  } catch (e) {
    diagnostics.errors.push(`library component sets registry: ${e instanceof Error ? e.message : String(e)}`);
    console.warn("Could not read available library component sets:", e);
  }

  const allInstances: InstanceNode[] = [];
  for (const page of figma.root.children) {
    try {
      await page.loadAsync();
      const pageComponents = page.findAllWithCriteria({ types: ["COMPONENT", "COMPONENT_SET"] });
      for (const node of pageComponents) {
        if (node.type === "COMPONENT") diagnostics.documentComponents++;
        if (node.type === "COMPONENT_SET") diagnostics.documentComponentSets++;
        addComponentNode(node, page.name, "document");
      }
      allInstances.push(...page.findAllWithCriteria({ types: ["INSTANCE"] }));
    } catch (e) {
      diagnostics.errors.push(`page "${page.name}": ${e instanceof Error ? e.message : String(e)}`);
      console.warn(`Could not scan page "${page.name}":`, e);
    }
  }

  diagnostics.instances = allInstances.length;
  for (const instance of allInstances) {
    try {
      const mainComponent = await instance.getMainComponentAsync();
      if (mainComponent) {
        diagnostics.resolvedInstanceComponents++;
        addComponentNode(mainComponent, getNodePageName(instance), "instance");
      } else if ((instance as InstanceNode & { componentName?: string }).componentName) {
        const cName = (instance as InstanceNode & { componentName?: string }).componentName!;
        results.set(`instance:${cName}:${getNodePageName(instance)}`, {
          id: instance.id,
          nodeId: instance.id,
          name: cName,
          type: "COMPONENT",
          pageName: getNodePageName(instance),
          source: "instance",
          role: inferComponentRole(cName),
        });
      }
    } catch {
      if ((instance as InstanceNode & { componentName?: string }).componentName) {
        const cName = (instance as InstanceNode & { componentName?: string }).componentName!;
        results.set(`instance:${cName}:${getNodePageName(instance)}`, {
          id: instance.id,
          nodeId: instance.id,
          name: cName,
          type: "COMPONENT",
          pageName: getNodePageName(instance),
          source: "instance",
          role: inferComponentRole(cName),
        });
      }
    }
  }

  return Array.from(results.values()).sort((a, b) => `${a.pageName}/${a.name}`.localeCompare(`${b.pageName}/${b.name}`));
}

export function summarizeAllPages(components: DesignSystemComponentInfo[]): DesignSystemPageInfo[] {
  const componentCountByPage = components.reduce((counts, component) => {
    counts.set(component.pageName, (counts.get(component.pageName) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());

  return figma.root.children
    .map((page) => ({
      id: page.id,
      name: page.name,
      componentCount: componentCountByPage.get(page.name) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
