import type { SerializedNode } from "./types";

export interface TemplateMatch {
  templateId: string;
  score: number;
  matchReason: string;
}

export interface DocSource {
  filename: string;
  content: string;
  type: "md" | "txt" | "zip-entry";
}

export interface LayoutPattern {
  columns: 1 | 2 | 3 | "sidebar";
  navPosition: "top" | "left" | "none";
  cardStyle: "list" | "grid" | "table" | "kanban";
  colorScheme: "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
}

export interface ValidationReport {
  missingComponents: string[];
  missingTokens: string[];
  componentScore: number;
  tokenScore: number;
  namingScore: number;
  readinessScore: number;
  canProceed: boolean;
}

export interface Screen {
  name: string;
  markdown: string;
  components: string[];
  colorTokens: string[];
}

export interface DesignContext {
  components: SerializedNode[];
  variableCount: number;
  pageCount: number;
  docs: DocSource[];
  prompt: string;
  bootstrapSuggestions: string[];
  templateMatches: TemplateMatch[];
  selectedTemplateId: string | null;
  layoutPattern: LayoutPattern | null;
  validationReport: ValidationReport | null;
}

export function createEmptyContext(): DesignContext {
  return {
    components: [],
    variableCount: 0,
    pageCount: 0,
    docs: [],
    prompt: "",
    bootstrapSuggestions: [],
    templateMatches: [],
    selectedTemplateId: null,
    layoutPattern: null,
    validationReport: null,
  };
}
