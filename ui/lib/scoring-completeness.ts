import type { SerializedNode, ScanIssue } from "../../shared/types";

export interface CompletenessResult {
  score: number;
  issues: ScanIssue[];
}

// Required interactive states for components
const REQUIRED_STATES = ["default", "hover", "disabled"];
const INTERACTIVE_KEYWORDS = ["button", "input", "link", "checkbox", "toggle", "switch", "tab", "select", "radio"];

function isLikelyInteractive(name: string): boolean {
  const lower = name.toLowerCase();
  return INTERACTIVE_KEYWORDS.some((kw) => lower.includes(kw));
}

function checkComponentStates(node: SerializedNode, rootPath: string, issues: ScanIssue[]) {
  function walk(n: SerializedNode, path: string) {
    // Check instances with availableVariants (from ComponentSet)
    if (n.isInstance && n.availableVariants) {
      const compName = n.componentName ?? n.name;
      const interactive = isLikelyInteractive(compName);

      // Find state-like property
      const stateKey = Object.keys(n.availableVariants).find((k) => k.toLowerCase().includes("state"));

      if (stateKey) {
        const availableStates = n.availableVariants[stateKey].map((s) => s.toLowerCase());

        // Check for missing required states
        const missingStates = REQUIRED_STATES.filter((req) => !availableStates.some((av) => av.includes(req)));

        if (missingStates.length > 0 && interactive) {
          issues.push({
            id: `completeness-missing-states-${n.id}`,
            category: "completeness",
            severity: "warning",
            message: `"${compName}" is missing states: ${missingStates.join(", ")}. AI will improvise ${missingStates.join("/")} behavior without design guidance.`,
            path,
            suggestion: `Add ${missingStates.join(", ")} variants to the "${compName}" Component Set in Figma.`,
            nodeId: n.id,
          });
        }

        // Check for focus state (important for accessibility)
        if (interactive && !availableStates.some((s) => s.includes("focus"))) {
          issues.push({
            id: `completeness-no-focus-${n.id}`,
            category: "completeness",
            severity: "info",
            message: `"${compName}" has no Focus state. Keyboard users won't see a designed focus indicator.`,
            path,
            suggestion: "Add a Focus variant for accessibility compliance.",
            nodeId: n.id,
          });
        }
      } else if (interactive) {
        // Interactive component without any State property
        issues.push({
          id: `completeness-no-state-prop-${n.id}`,
          category: "completeness",
          severity: "warning",
          message: `"${compName}" looks interactive but has no "State" variant property. AI can't generate hover/disabled states.`,
          path,
          suggestion: 'Add a "State" variant property with at least Default, Hover, and Disabled values.',
          nodeId: n.id,
        });
      }

      // Check for cryptic property names ("Property 1")
      for (const key of Object.keys(n.availableVariants)) {
        if (/^Property\s*\d+$/i.test(key)) {
          issues.push({
            id: `completeness-cryptic-prop-${n.id}-${key}`,
            category: "completeness",
            severity: "info",
            message: `"${compName}" has a variant property "${key}" — AI can't determine its purpose from a generic name.`,
            path,
            suggestion: `Rename "${key}" to something semantic (e.g. "Size", "Type", "State").`,
            nodeId: n.id,
          });
        }
      }
    }

    if (n.children) {
      for (const child of n.children) {
        walk(child, `${path} > ${child.name}`);
      }
    }
  }

  walk(node, rootPath);
}

export function scoreCompleteness(node: SerializedNode): CompletenessResult {
  const issues: ScanIssue[] = [];

  // Component state completeness checks
  checkComponentStates(node, node.name, issues);

  // Score: start high, penalize for missing states
  let score = 90;
  const warnings = issues.filter((i) => i.severity === "warning").length;
  const infos = issues.filter((i) => i.severity === "info").length;
  score -= warnings * 10;
  score -= infos * 3;

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}
