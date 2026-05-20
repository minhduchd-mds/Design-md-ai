/**
 * App — Root component for the Desygn A11y marketing landing page.
 *
 * Composes the landing sections (Hero, Features, Pricing, FAQ, Footer) inside
 * a single semantic landmark layout:
 *   - one <header> (sticky nav + language toggle)
 *   - one <main> wrapping every <section> (and the page's only <h1>, in Hero)
 *   - one <footer>
 *
 * All visible strings flow through useTranslation() (i18n/). Vietnamese is the
 * default locale; English is the fallback. Every interactive element is a real
 * <button> or <a> for full keyboard + screen-reader support (WCAG 2.1.1).
 */

import { Button } from "@desygn/ui";
import { useTranslation } from "./i18n/index.js";
import type { Locale } from "./i18n/index.js";
import { Hero } from "./sections/Hero.js";
import { Features } from "./sections/Features.js";
import { Pricing } from "./sections/Pricing.js";
import { FAQ } from "./sections/FAQ.js";
import { Footer } from "./sections/Footer.js";
import styles from "./App.module.css";

function LanguageToggle() {
  const { t, locale, setLocale } = useTranslation();
  const options: Locale[] = ["vi", "en"];

  return (
    <div role="group" aria-label={t("lang.toggleLabel")} className={styles.langGroup}>
      {options.map((code) => (
        <Button
          key={code}
          variant="ghost"
          size="sm"
          aria-pressed={locale === code}
          onClick={() => setLocale(code)}
        >
          {t(code === "vi" ? "lang.vi" : "lang.en")}
        </Button>
      ))}
    </div>
  );
}

function SiteHeader() {
  const { t } = useTranslation();

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a className={styles.brand} href="#hero-title">
          {t("brand.name")}
        </a>

        <nav className={styles.primaryNav} aria-label={t("brand.name")}>
          <a className={styles.navLink} href="#features">
            {t("nav.features")}
          </a>
          <a className={styles.navLink} href="#pricing">
            {t("nav.pricing")}
          </a>
          <a className={styles.navLink} href="#faq">
            {t("nav.faq")}
          </a>
        </nav>

        <LanguageToggle />
      </div>
    </header>
  );
}

export function App() {
  const { t } = useTranslation();

  return (
    <>
      <a className="skip-link" href="#main">
        {t("skip.toContent")}
      </a>

      <SiteHeader />

      <main id="main">
        <Hero />
        <Features />
        <Pricing />
        <FAQ />
      </main>

      <Footer />
    </>
  );
}
