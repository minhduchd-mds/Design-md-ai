/**
 * Features — the four product differentiators in a responsive Card grid.
 *
 * Each card is an <article> with its own heading so the section forms a
 * meaningful heading outline (WCAG 1.3.1). Copy via useTranslation().
 */

import { Card } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/index.js";
import styles from "./sections.module.css";

interface Feature {
  titleKey: TranslationKey;
  bodyKey: TranslationKey;
}

const FEATURES: Feature[] = [
  { titleKey: "features.designFirst.title", bodyKey: "features.designFirst.body" },
  { titleKey: "features.aiNative.title", bodyKey: "features.aiNative.body" },
  { titleKey: "features.legalGrade.title", bodyKey: "features.legalGrade.body" },
  { titleKey: "features.multiSurface.title", bodyKey: "features.multiSurface.body" },
];

export function Features() {
  const { t } = useTranslation();

  return (
    <section
      id="features"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="features-heading"
    >
      <div className={styles.sectionHead}>
        <h2 id="features-heading" className={styles.sectionHeading}>
          {t("features.heading")}
        </h2>
        <p className={styles.sectionLead}>{t("features.subheading")}</p>
      </div>

      <div className={styles.featureGrid}>
        {FEATURES.map((feature) => (
          <Card key={feature.titleKey} variant="outlined">
            <article className={styles.featureCard}>
              <h3 className={styles.featureTitle}>{t(feature.titleKey)}</h3>
              <p className={styles.featureBody}>{t(feature.bodyKey)}</p>
            </article>
          </Card>
        ))}
      </div>
    </section>
  );
}
