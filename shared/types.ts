// ── Scoring dimensions & weights (shared between scanner + UI) ──

import type { ViewportType } from "./viewport";
export type { ViewportType } from "./viewport";

export type ScoringDimension = "naming" | "structure" | "tokens" | "meta" | "completeness" | "variants";

export const SCORE_WEIGHTS: Record<ScoringDimension, number> = {
  naming: 0.18,
  structure: 0.22,
  tokens: 0.18,
  meta: 0.12,
  completeness: 0.15,
  variants: 0.15,
};

/** Standard return type for all scoring modules */
export interface ScoringResult {
  score: number;
  issues: ScanIssue[];
}

// ── Plugin Profile (v1: Skill-aware Prompt) ──

export interface ComponentRef {
  name: string;
  atomicLevel?: "atom" | "molecule" | "organism";
  nodeId?: string;
}

export interface PluginProfile {
  id: string;
  name: string; // e.g. "Superbrand Design System"
  stack: string; // e.g. "React + TypeScript + Storybook 8"
  layout: string; // e.g. "Container 997px, Main fluid + Sidebar 348px"
  tokens: Record<string, string>; // { "color-brand-magenta": "#E20074" }
  components: ComponentRef[];
  guidelines: string; // Freitext aus SKILL.md
}

// ── Node serialization (plugin -> UI -> API) ──

export interface SerializedNode {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  layoutMode?: "HORIZONTAL" | "VERTICAL";
  layoutSizingHorizontal?: string;
  layoutSizingVertical?: string;
  itemSpacing?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  fills?: SerializedPaint[];
  strokes?: SerializedPaint[];
  cornerRadius?: number | number[];
  opacity?: number;
  characters?: string;
  fontSize?: number;
  fontName?: { family: string; style: string };
  fontWeight?: number;
  lineHeight?: number | string;
  letterSpacing?: number;
  textAlignHorizontal?: string;
  textDecoration?: string;
  textCase?: string;
  isComponent?: boolean;
  isInstance?: boolean;
  componentName?: string;
  variantProperties?: Record<string, string>;
  componentPropertyDefinitions?: SerializedPropertyDef[];
  availableVariants?: Record<string, string[]>;
  componentDescription?: string;
  constraints?: { horizontal: string; vertical: string };
  effects?: SerializedEffect[];
  layoutGrids?: SerializedLayoutGrid[];
  // Step 1.2: Stroke metadata
  strokeWeight?: number;
  strokeAlign?: "CENTER" | "INSIDE" | "OUTSIDE";
  // Step 1.3: Min/Max constraints
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  // Step 1.5: Text truncation
  textAutoResize?: string;
  textTruncation?: string;
  maxLines?: number;
  // Step 1.6: Overflow clipping
  clipsContent?: boolean;
  // Step 1.1: Instance component properties (all types, not just variants)
  componentProperties?: Record<string, { type: string; value: string | boolean }>;
  children?: SerializedNode[];

  // ── v3: Accessibility & Interaction Metadata ──
  /** ARIA role inferred from component name/type */
  inferredRole?: string;
  /** Touch target size compliance (WCAG 2.2 — 24×24 minimum) */
  touchTargetCompliant?: boolean;
  /** Color contrast ratio against parent background */
  contrastRatio?: number;
  /** Whether node has interaction/hover states defined */
  hasInteractions?: boolean;
  /** Responsive behavior hints */
  responsiveBehavior?: "fixed" | "fluid" | "adaptive";
}

export interface SerializedPropertyDef {
  name: string;
  type: "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP";
  values?: string[];
  defaultValue?: string | boolean;
}

export interface SerializedPaint {
  type: string;
  color?: { r: number; g: number; b: number };
  opacity?: number;
  boundToVariable?: boolean;
  variableName?: string;
  // Step 1.4: Gradient data
  gradientStops?: { color: { r: number; g: number; b: number; a: number }; position: number }[];
  gradientAngle?: number;
}

export interface SerializedEffect {
  type: "DROP_SHADOW" | "INNER_SHADOW" | "LAYER_BLUR" | "BACKGROUND_BLUR";
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

export interface SerializedLayoutGrid {
  pattern: "COLUMNS" | "ROWS" | "GRID";
  count?: number;
  gutterSize?: number;
  alignment?: string;
  offset?: number;
  sectionSize?: number;
}

// ── Plugin <-> UI messages ──

export interface RenameEntry {
  nodeId: string;
  oldName: string;
  newName: string;
  path: string;
}

export interface DesignSystemComponentInfo {
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

export interface DesignSystemVariableInfo {
  id: string;
  name: string;
  collectionName: string;
  modeName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  value: string;
}

export interface DesignSystemPageInfo {
  id: string;
  name: string;
  componentCount: number;
}

export interface DesignSystemSyncDiagnostics {
  localRegistryComponents: number;
  localRegistryComponentSets: number;
  libraryComponents: number;
  libraryComponentSets: number;
  documentComponents: number;
  documentComponentSets: number;
  instances: number;
  resolvedInstanceComponents: number;
  errors: string[];
}

export interface DesignSystemSnapshot {
  fileName: string;
  pageName: string;
  pages: DesignSystemPageInfo[];
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  diagnostics?: DesignSystemSyncDiagnostics;
}

export interface FigmaProjectFrameRequest {
  projectName: string;
  industry: string;
  style: string;
  presetName: string;
  layoutTemplate: string;
  components: DesignSystemComponentInfo[];
  variables: DesignSystemVariableInfo[];
  templateComponentMappings?: Record<string, string[]>;
}

export type PluginMessage =
  // Selection
  | { type: "selection-change"; node: SerializedNode | null; name: string; selectionCount?: number; resolvedFromComponentSet?: boolean; componentSetName?: string }
  | { type: "no-selection" }
  | { type: "request-selection" }
  // Rename fixes
  | { type: "request-renames" }
  | { type: "renames-result"; entries: RenameEntry[] }
  | { type: "apply-renames"; entries: RenameEntry[] }
  | { type: "renames-applied"; count: number }
  // Responsive variant detection
  | { type: "request-variants" }
  | { type: "variants-result"; variants: ViewportVariant[] }
  // Resize
  | { type: "resize"; width: number; height: number }
  // Click-to-select
  | { type: "select-node"; nodeId: string; notify?: string }
  // Bulk delete
  | { type: "delete-nodes"; nodeIds: string[] }
  | { type: "nodes-deleted"; count: number }
  // Convert divider frames to lines
  | { type: "convert-dividers"; nodeIds: string[] }
  | { type: "dividers-converted"; count: number }
  // Profile management (v1)
  | { type: "load-profiles" }
  | { type: "profiles-loaded"; profiles: PluginProfile[]; activeId: string | null }
  | { type: "save-profile"; profile: PluginProfile }
  | { type: "profile-saved"; profiles: PluginProfile[] }
  | { type: "set-active-profile"; profileId: string | null }
  | { type: "delete-profile"; profileId: string }
  // Figma import (v2)
  | { type: "get-figma-sources" }
  | { type: "figma-sources-result"; sources: FigmaImportSource[] }
  | { type: "import-figma-tokens"; sourceIds: string[] }
  | { type: "figma-tokens-result"; tokens: Record<string, string>; components: string[]; fileName: string }
  | { type: "get-figma-color-variables" }
  | { type: "figma-color-variables-result"; tokens: Record<string, string>; fileName: string; count: number }
  | { type: "get-design-system-snapshot" }
  | { type: "design-system-snapshot-result"; snapshot: DesignSystemSnapshot }
  | { type: "create-figma-project-frame"; project: FigmaProjectFrameRequest }
  | { type: "figma-project-frame-result"; nodeId?: string; created: boolean; instanceCount: number; placeholderCount: number; message: string }
  // Batch Mode (v3)
  | { type: "request-batch-selection" }
  | { type: "batch-selection-result"; nodes: SerializedNode[] }
  // Auto Layout Fix (v3)
  | { type: "request-autolayout-analysis" }
  | { type: "autolayout-analysis-result"; candidates: AutoLayoutCandidate[]; skipped: AutoLayoutSkipped[] }
  | { type: "apply-autolayout"; nodeIds: string[] }
  | { type: "autolayout-applied"; count: number }
  // Accessibility Audit (v3)
  | { type: "request-a11y-audit" }
  | { type: "a11y-audit-result"; audit: AccessibilityAudit }
  // Evidence Memory Sync (v3)
  | { type: "request-evidence-sync"; content: string; source: string }
  | { type: "evidence-sync-result"; evidenceId: string; stored: boolean };

export interface FigmaImportSource {
  id: string;
  name: string;
  type: "local-variables" | "local-styles" | "local-components" | "library";
  count: number; // number of items
  detail?: string; // e.g. "32 colors, 8 spacing"
}

export interface ViewportVariant {
  nodeId: string;
  name: string;
  width: number;
  height: number;
  viewportType: ViewportType;
  node?: SerializedNode;
}

// ── v2: Gap Detection & Atomic Detection ──

export type AtomicLevel = "atom" | "molecule" | "organism" | "unclassified";

export interface DependencyNode {
  name: string;
  level: AtomicLevel;
  nodeId?: string;
  children: DependencyNode[];
}

export interface AtomicInfo {
  name: string;
  nodeId: string;
  level: AtomicLevel;
  isComponentized: boolean; // true = has component/instance children
  componentCount: number;
  instanceCount: number; // displayed count (components or structural elements)
  depth: number;
  subComponents: string[];
  significantFrames: string[]; // structural frame names (when not componentized)
  dependencyTree: DependencyNode | null;
  variantProperties?: Record<string, string>; // e.g. { Priority: "Primary", Variant: "Filled" }
}

export interface ExportPlanItem {
  step: number;
  name: string;
  level: AtomicLevel;
  context: string; // e.g. "no context needed" or "uses: <Button>, <Badge>"
  nodeId?: string; // master component node ID for navigation
}

// ── API: Scan result ──

export type Severity = "critical" | "warning" | "info";

export interface ColorMapping {
  hex: string;
  tokenName: string | null; // null = unknown/unmapped
  count: number;
  nodeId?: string; // first node using this color — for click-to-select
}

export interface ScanResult {
  score: number;
  categories: ScanCategory[];
  issues: ScanIssue[];
  promptCompact?: string;
  colorMappings?: ColorMapping[];
  atomicInfo?: AtomicInfo;
  exportPlan?: ExportPlanItem[];
}

export interface ScanCategory {
  id: ScoringDimension;
  label: string;
  score: number;
  status: "red" | "yellow" | "green";
}

export interface ScanIssue {
  id: string;
  category: ScoringDimension;
  severity: Severity;
  message: string;
  path: string;
  suggestion?: string;
  nodeId?: string;
}

// ── v3: Auto Layout Fix ──

export interface AutoLayoutCandidate {
  nodeId: string;
  name: string;
  depth: number;
  direction: "HORIZONTAL" | "VERTICAL";
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  alignment: "MIN" | "CENTER" | "MAX" | "SPACE_BETWEEN";
  childCount: number;
  confidence: number; // 0-1
}

export interface AutoLayoutSkipped {
  nodeId: string;
  name: string;
  reason: string;
}

// ── v3: Batch Mode ──

export interface BatchItemResult {
  name: string;
  nodeId: string;
  score: number;
  atomicLevel: AtomicLevel;
  scanResult: ScanResult;
}

export interface BatchScanResult {
  items: BatchItemResult[];
  exportPlan: ExportPlanItem[];
  batchPromptCompact?: string;
  averageScore: number;
}

// ── v3: Accessibility Audit ──

export interface AccessibilityAudit {
  score: number; // 0-100
  violations: AccessibilityViolation[];
  touchTargets: { compliant: number; total: number };
  contrastIssues: number;
  missingRoles: number;
  wcagLevel: "A" | "AA" | "AAA" | "fail";
}

export interface AccessibilityViolation {
  nodeId: string;
  nodeName: string;
  rule: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  message: string;
  wcagCriteria: string;
}
