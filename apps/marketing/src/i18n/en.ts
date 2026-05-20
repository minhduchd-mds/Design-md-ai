/**
 * English (en) dictionary — secondary locale and fallback for the marketing
 * landing page.
 */

import type { Dictionary } from "./types.js";

export const en: Dictionary = {
  // ─── Brand / nav ─────────────────────────────────────────────────
  "brand.name": "Desygn A11y",
  "nav.features": "Features",
  "nav.pricing": "Pricing",
  "nav.faq": "FAQ",
  "skip.toContent": "Skip to main content",

  // ─── Language toggle ─────────────────────────────────────────────
  "lang.toggleLabel": "Language",
  "lang.vi": "Vietnamese",
  "lang.en": "English",

  // ─── Hero ────────────────────────────────────────────────────────
  "hero.eyebrow": "Accessibility-as-a-Service",
  "hero.title": "Catch WCAG violations 10× cheaper, in Figma.",
  "hero.subtitle":
    "The only accessibility platform that audits your design before you write a single line of code. Catch issues early, fix them fast, avoid costly lawsuits.",
  "hero.ctaPrimary": "Start free",
  "hero.ctaSecondary": "View sample report",
  "hero.trust":
    "Checked against WCAG 2.2 AA · Legally signed PDF reports · No credit card required",

  // ─── Features section ────────────────────────────────────────────
  "features.heading": "Why Desygn A11y",
  "features.subheading":
    "Four reasons design and engineering teams catch accessibility issues earlier and cheaper.",
  "features.designFirst.title": "Design-first",
  "features.designFirst.body":
    "Audit right inside Figma before code exists. Fixing a violation at the design stage is 10× cheaper than after release.",
  "features.aiNative.title": "AI-native (MCP)",
  "features.aiNative.body":
    "A built-in MCP server lets AI coding agents read audit results and propose fixes automatically, right inside your workflow.",
  "features.legalGrade.title": "Legal-grade reports",
  "features.legalGrade.body":
    "Export digitally signed PDF reports as proof of compliance — ready for audits, contracts, and legal requests.",
  "features.multiSurface.title": "Multi-surface",
  "features.multiSurface.body":
    "One audit engine, everywhere: Figma Plugin, web Dashboard, GitHub Action, and IDE integration — same rule set.",

  // ─── Pricing section ─────────────────────────────────────────────
  "pricing.heading": "Simple, transparent pricing",
  "pricing.subheading":
    "Start free. Upgrade as your team grows. Cancel anytime.",
  "pricing.perMonth": "/mo",
  "pricing.popular": "Most popular",
  "pricing.free.name": "Free",
  "pricing.free.price": "$0",
  "pricing.free.desc": "5 audits per month. Perfect for trying it out.",
  "pricing.free.cta": "Start free",
  "pricing.pro.name": "Pro",
  "pricing.pro.price": "$29",
  "pricing.pro.desc": "100 audits per month for individual designers.",
  "pricing.pro.cta": "Choose Pro",
  "pricing.team.name": "Team",
  "pricing.team.price": "$299",
  "pricing.team.desc": "1,000 audits per month, 5 seats for your whole team.",
  "pricing.team.cta": "Choose Team",
  "pricing.enterprise.name": "Enterprise",
  "pricing.enterprise.price": "Custom",
  "pricing.enterprise.desc":
    "Custom limits, SSO, SLA, and dedicated support.",
  "pricing.enterprise.cta": "Contact sales",

  // ─── FAQ section ─────────────────────────────────────────────────
  "faq.heading": "Frequently asked questions",
  "faq.subheading": "Everything you need to know before you start.",
  "faq.q1": "How does Desygn A11y work?",
  "faq.a1":
    "Connect your Figma file and we check the design against WCAG 2.2 AA, returning a list of violations with fix guidance — all before you write any code.",
  "faq.q2": "Do I need to know WCAG?",
  "faq.a2":
    "No. Every finding comes with a plain explanation, a severity level, and a concrete fix, so the whole team can understand it.",
  "faq.q3": "Are the PDF reports legally valid?",
  "faq.a3":
    "Our reports are digitally signed and timestamped to serve as compliance evidence for audits and contracts. Consult your legal counsel for your specific case.",
  "faq.q4": "Can I use it in CI/CD?",
  "faq.a4":
    "Yes. The GitHub Action and IDE integration let you run the same audit rule set automatically in your pipeline.",

  // ─── Footer ──────────────────────────────────────────────────────
  "footer.tagline": "Catch WCAG violations 10× cheaper, in Figma.",
  "footer.product": "Product",
  "footer.linkFeatures": "Features",
  "footer.linkPricing": "Pricing",
  "footer.linkFaq": "FAQ",
  "footer.resources": "Resources",
  "footer.linkDocs": "Docs",
  "footer.linkDashboard": "Dashboard",
  "footer.linkGithub": "GitHub",
  "footer.rights": "All rights reserved.",
};
