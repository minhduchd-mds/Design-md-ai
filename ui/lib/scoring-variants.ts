import type { SerializedNode, ScanIssue } from "../../shared/types";

export interface VariantsResult {
  score: number;
  issues: ScanIssue[];
}

// ── Size Variant Detection ──

const SIZE_KEYWORDS = ["small", "medium", "large", "sm", "md", "lg", "xl", "xxl", "xs", "compact", "default", "mini"];

function hasSizeVariant(node: SerializedNode): boolean {
  if (!node.availableVariants) return false;
  for (const [key, values] of Object.entries(node.availableVariants)) {
    const keyLower = key.toLowerCase();
    if (keyLower.includes("size") || keyLower === "scale") return true;
    // Check if values look like sizes
    if (values.some((v) => SIZE_KEYWORDS.includes(v.toLowerCase()))) return true;
  }
  return false;
}

// ── Responsive Coverage ──

interface VariantCoverage {
  totalInstances: number;
  withSizeVariant: number;
  withStateVariant: number;
  totalProperties: number;
  crypticProperties: number;
  missingResponsive: { name: string; nodeId: string }[];
}

function analyzeVariantCoverage(node: SerializedNode): VariantCoverage {
  const coverage: VariantCoverage = {
    totalInstances: 0,
    withSizeVariant: 0,
    withStateVariant: 0,
    totalProperties: 0,
    crypticProperties: 0,
    missingResponsive: [],
  };

  function walk(n: SerializedNode) {
    if (n.isInstance && n.availableVariants) {
      coverage.totalInstances++;

      const props = Object.keys(n.availableVariants);
      coverage.totalProperties += props.length;

      // Check for size variant
      if (hasSizeVariant(n)) {
        coverage.withSizeVariant++;
      } else {
        // Only flag components that look like they should have sizes
        const name = (n.componentName ?? n.name).toLowerCase();
        const shouldHaveSize =
          /button|input|badge|avatar|icon|chip|tag|card/i.test(name) && props.length > 0;
        if (shouldHaveSize) {
          coverage.missingResponsive.push({ name: n.componentName ?? n.name, nodeId: n.id });
        }
      }

      // Check for state variant
      const hasState = props.some(
        (k) => k.toLowerCase().includes("state") || k.toLowerCase().includes("status"),
      );
      if (hasState) coverage.withStateVariant++;

      // Check for cryptic property names
      for (const key of props) {
        if (/^Property\s*\d+$/i.test(key)) {
          coverage.crypticProperties++;
        }
      }
    }

    if (n.children) n.children.forEach(walk);
  }

  walk(node);
  return coverage;
}

// ── Main Scoring ──

export function scoreVariants(node: SerializedNode): VariantsResult {
  const issues: ScanIssue[] = [];
  const coverage = analyzeVariantCoverage(node);

  let score = 70; // base

  // Bonus: root component itself has variants
  if (node.availableVariants && Object.keys(node.availableVariants).length > 0) {
    const propCount = Object.keys(node.availableVariants).length;
    if (propCount >= 2) score += 5;
  }

  if (coverage.totalInstances === 0) {
    return { score: Math.max(0, Math.min(100, score)), issues };
  }

  // Size variant coverage
  const sizeRatio = coverage.withSizeVariant / coverage.totalInstances;
  if (sizeRatio >= 0.8) {
    score += 10;
  } else if (sizeRatio >= 0.5) {
    score += 5;
  }

  // Flag components missing size variants
  for (const missing of coverage.missingResponsive.slice(0, 5)) {
    issues.push({
      id: `variants-no-size-${missing.nodeId}`,
      category: "variants",
      severity: "info",
      message: `"${missing.name}" has no Size variant. Responsive designs benefit from size variants (Small/Medium/Large).`,
      path: node.name,
      suggestion: `Add a "Size" variant property to "${missing.name}" in Figma.`,
      nodeId: missing.nodeId,
    });
  }

  // State variant coverage
  const stateRatio = coverage.withStateVariant / coverage.totalInstances;
  if (stateRatio >= 0.8) {
    score += 10;
  } else if (stateRatio >= 0.5) {
    score += 5;
  }

  // Property naming quality
  if (coverage.totalProperties > 0) {
    const crypticRatio = coverage.crypticProperties / coverage.totalProperties;
    if (crypticRatio === 0) {
      score += 10;
    } else if (crypticRatio <= 0.2) {
      score += 5;
    } else {
      score -= 5;
      issues.push({
        id: "variants-cryptic-properties",
        category: "variants",
        severity: "warning",
        message: `${coverage.crypticProperties} of ${coverage.totalProperties} variant properties have generic names ("Property 1"). AI can't determine their purpose.`,
        path: node.name,
        suggestion: "Rename generic property names to semantic names (e.g. Size, State, Type).",
      });
    }
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    issues,
  };
}
