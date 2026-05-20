/**
 * Hero — top-of-page banner. Owns the page's single <h1>.
 *
 * All copy flows through useTranslation() (vi default, en fallback).
 * CTAs are real anchors styled as buttons via @desygn/ui's buttonClass so
 * they are keyboard- and screen-reader-accessible (WCAG 2.1.1, 4.1.2).
 */

import { buttonClass } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import styles from "./sections.module.css";

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className={`${styles.container} ${styles.hero}`} aria-labelledby="hero-title">
      <div className={styles.heroInner}>
        <span className={styles.eyebrow}>{t("hero.eyebrow")}</span>
        <h1 id="hero-title" className={styles.heroTitle}>
          {t("hero.title")}
        </h1>
        <p className={styles.heroSubtitle}>{t("hero.subtitle")}</p>
        <div className={styles.heroActions}>
          <a href="#pricing" className={buttonClass("primary", "lg")}>
            {t("hero.ctaPrimary")}
          </a>
          <a href="#faq" className={buttonClass("secondary", "lg")}>
            {t("hero.ctaSecondary")}
          </a>
        </div>
        <p className={styles.heroTrust}>{t("hero.trust")}</p>
      </div>
    </section>
  );
}
