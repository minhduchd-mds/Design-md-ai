/**
 * English (en) dictionary — secondary locale and fallback.
 */

import type { Dictionary } from "./types.js";

export const en: Dictionary = {
  "app.title": "Desygn A11y",
  "app.badge": "Week 0",
  "app.tagline":
    "Accessibility-as-a-Service — Catch WCAG violations in Figma before they cost you $50,000 in lawsuits.",
  "card.title": "Run your first audit",
  "card.body": "Paste a Figma file URL and we'll check it against WCAG 2.2 AA.",
  "button.startAudit": "Start audit",
  "button.viewSample": "View sample report",
  "status.line": "Status: scaffold + design system wired.",
  "lang.toggleLabel": "Language",
  "lang.vi": "Vietnamese",
  "lang.en": "English",

  // Navigation (sidebar)
  "nav.dashboard": "Dashboard",
  "nav.audits": "Audits",
  "nav.settings": "Settings",
  "nav.primaryLabel": "Primary",

  // Top bar / shell
  "shell.brand": "Desygn A11y",
  "shell.signOut": "Sign out",
  "shell.userMenuLabel": "Account",

  // Auth — shared
  "auth.emailLabel": "Email",
  "auth.emailPlaceholder": "you@example.com",
  "auth.passwordLabel": "Password",
  "auth.passwordPlaceholder": "Enter your password",
  "auth.backendUnconfiguredTitle": "Backend not configured",
  "auth.backendUnconfiguredBody":
    "Authentication is unavailable because Supabase is not set up. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then reload.",
  "auth.backendUnconfiguredCta": "Sign in (disabled)",
  "auth.genericError": "Something went wrong. Please try again.",

  // Auth — login
  "auth.login.title": "Sign in",
  "auth.login.submit": "Sign in",
  "auth.login.submitting": "Signing in…",
  "auth.login.toSignupPrompt": "Don't have an account?",
  "auth.login.toSignupLink": "Sign up",

  // Auth — signup
  "auth.signup.title": "Create account",
  "auth.signup.submit": "Sign up",
  "auth.signup.submitting": "Creating account…",
  "auth.signup.success": "Account created. Check your email to confirm sign-in.",
  "auth.signup.toLoginPrompt": "Already have an account?",
  "auth.signup.toLoginLink": "Sign in",

  // Audits page (placeholder)
  "audits.title": "Audits",
  "audits.body": "Your accessibility audits will appear here.",
  "audits.cta": "Start a new audit",

  // Settings page (placeholder)
  "settings.title": "Settings",
  "settings.body": "Manage your workspace preferences.",
  "settings.languageHeading": "Language",
};
