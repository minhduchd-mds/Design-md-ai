/**
 * variants — Pure className builders for UI primitives.
 *
 * Styling lives in `primitives.css` (shipped + imported once by the app).
 * Components are thin wrappers that apply these class strings, keeping the
 * style logic pure and unit-testable in a node environment (no jsdom).
 *
 * Naming: BEM-ish with a `dsg-` (Desygn) prefix.
 */

import { cn } from "../lib/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra?: string,
): string {
  return cn("dsg-btn", `dsg-btn--${variant}`, `dsg-btn--${size}`, extra);
}

export type InputState = "default" | "error";

export function inputClass(state: InputState = "default", extra?: string): string {
  return cn("dsg-input", state === "error" && "dsg-input--error", extra);
}

export type CardVariant = "default" | "elevated" | "outlined";

export function cardClass(variant: CardVariant = "default", extra?: string): string {
  return cn("dsg-card", `dsg-card--${variant}`, extra);
}

export type BadgeTone = "neutral" | "success" | "warning" | "error" | "info";

export function badgeClass(tone: BadgeTone = "neutral", extra?: string): string {
  return cn("dsg-badge", `dsg-badge--${tone}`, extra);
}

export type SpinnerSize = "sm" | "md" | "lg";

export function spinnerClass(size: SpinnerSize = "md", extra?: string): string {
  return cn("dsg-spinner", `dsg-spinner--${size}`, extra);
}

/** Map audit severity → badge tone, for reuse across the dashboard. */
export function severityToTone(severity: "critical" | "serious" | "moderate" | "minor"): BadgeTone {
  switch (severity) {
    case "critical":
      return "error";
    case "serious":
      return "warning";
    case "moderate":
      return "info";
    case "minor":
      return "neutral";
  }
}
