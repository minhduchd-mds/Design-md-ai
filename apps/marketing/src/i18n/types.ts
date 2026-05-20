/**
 * i18n types — locale union + the exhaustive translation-key union.
 *
 * Every user-facing string on the marketing landing page has a stable key
 * here. The `vi` and `en` dictionaries are typed as
 * `Record<TranslationKey, string>`, so adding a key forces both locales to
 * provide a value (compile-time completeness).
 *
 * This is a self-contained copy of the dashboard's i18n pattern — the two
 * apps are deployed separately, so the marketing site owns its own
 * dictionaries and storage key.
 */

export type Locale = "vi" | "en";

export const DEFAULT_LOCALE: Locale = "vi";
export const FALLBACK_LOCALE: Locale = "en";

/** localStorage key used to persist the active locale (marketing-scoped). */
export const LOCALE_STORAGE_KEY = "desygn-a11y.marketing.locale";

/** Union of every translatable string key rendered by the landing page. */
export type TranslationKey =
  // Brand / nav
  | "brand.name"
  | "nav.features"
  | "nav.pricing"
  | "nav.faq"
  | "skip.toContent"
  // Language toggle
  | "lang.toggleLabel"
  | "lang.vi"
  | "lang.en"
  // Hero
  | "hero.eyebrow"
  | "hero.title"
  | "hero.subtitle"
  | "hero.ctaPrimary"
  | "hero.ctaSecondary"
  | "hero.trust"
  // Features section
  | "features.heading"
  | "features.subheading"
  | "features.designFirst.title"
  | "features.designFirst.body"
  | "features.aiNative.title"
  | "features.aiNative.body"
  | "features.legalGrade.title"
  | "features.legalGrade.body"
  | "features.multiSurface.title"
  | "features.multiSurface.body"
  // Pricing section
  | "pricing.heading"
  | "pricing.subheading"
  | "pricing.perMonth"
  | "pricing.popular"
  | "pricing.free.name"
  | "pricing.free.price"
  | "pricing.free.desc"
  | "pricing.free.cta"
  | "pricing.pro.name"
  | "pricing.pro.price"
  | "pricing.pro.desc"
  | "pricing.pro.cta"
  | "pricing.team.name"
  | "pricing.team.price"
  | "pricing.team.desc"
  | "pricing.team.cta"
  | "pricing.enterprise.name"
  | "pricing.enterprise.price"
  | "pricing.enterprise.desc"
  | "pricing.enterprise.cta"
  // FAQ section
  | "faq.heading"
  | "faq.subheading"
  | "faq.q1"
  | "faq.a1"
  | "faq.q2"
  | "faq.a2"
  | "faq.q3"
  | "faq.a3"
  | "faq.q4"
  | "faq.a4"
  // Footer
  | "footer.tagline"
  | "footer.product"
  | "footer.linkFeatures"
  | "footer.linkPricing"
  | "footer.linkFaq"
  | "footer.resources"
  | "footer.linkDocs"
  | "footer.linkDashboard"
  | "footer.linkGithub"
  | "footer.rights";

/** A complete dictionary: one string per translation key. */
export type Dictionary = Record<TranslationKey, string>;
