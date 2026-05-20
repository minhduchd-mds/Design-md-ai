/**
 * MCP server types — mirrors shared/types.ts design system interfaces.
 *
 * Duplicated here to keep the MCP server package self-contained
 * (no dependency on the monorepo's shared/ workspace).
 */

export interface DesignComponent {
  id: string;
  nodeId?: string;
  componentKey?: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  pageName: string;
  source?: "local" | "document" | "library" | "instance" | "suggested";
  role?: "navigation" | "kpi" | "chart" | "table" | "form" | "modal" | "card" | "list" | "action" | "content" | "unknown";
  description?: string;
  variantProperties?: Record<string, string[]>;
}

export interface DesignVariable {
  id: string;
  name: string;
  collectionName: string;
  modeName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  value: string;
}

export interface DesignPage {
  id: string;
  name: string;
  componentCount: number;
}

export interface DesignSnapshot {
  fileName: string;
  pageName: string;
  pages: DesignPage[];
  components: DesignComponent[];
  variables: DesignVariable[];
}
