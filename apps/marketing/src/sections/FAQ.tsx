/**
 * FAQ — accordion built on native <details>/<summary>.
 *
 * Native disclosure elements are keyboard-operable and announced correctly by
 * screen readers out of the box (WCAG 2.1.1, 4.1.2) — no JS or ARIA needed.
 */

import { useTranslation } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/index.js";
import styles from "./sections.module.css";

interface QA {
  q: TranslationKey;
  a: TranslationKey;
}

const ITEMS: QA[] = [
  { q: "faq.q1", a: "faq.a1" },
  { q: "faq.q2", a: "faq.a2" },
  { q: "faq.q3", a: "faq.a3" },
  { q: "faq.q4", a: "faq.a4" },
];

export function FAQ() {
  const { t } = useTranslation();

  return (
    <section
      id="faq"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="faq-heading"
    >
      <div className={styles.sectionHead}>
        <h2 id="faq-heading" className={styles.sectionHeading}>
          {t("faq.heading")}
        </h2>
        <p className={styles.sectionLead}>{t("faq.subheading")}</p>
      </div>

      <div className={styles.faqList}>
        {ITEMS.map((item) => (
          <details key={item.q} className={styles.faqItem}>
            <summary>{t(item.q)}</summary>
            <p className={styles.faqAnswer}>{t(item.a)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
