/**
 * Pricing — the four subscription tiers (Free / Pro / Team / Enterprise).
 *
 * Built from a typed config so vi/en copy stays in the dictionaries. The Pro
 * tier is flagged "popular" and gets a Badge + highlighted Card outline.
 * Each CTA is a real <a> styled with @desygn/ui's buttonClass.
 */

import { Card, Badge, buttonClass } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/index.js";
import styles from "./sections.module.css";

interface Tier {
  id: string;
  nameKey: TranslationKey;
  priceKey: TranslationKey;
  descKey: TranslationKey;
  ctaKey: TranslationKey;
  /** Show the "/mo" period suffix (false for the custom Enterprise price). */
  showPeriod: boolean;
  popular?: boolean;
  ctaVariant: "primary" | "secondary";
  ctaHref: string;
}

const TIERS: Tier[] = [
  {
    id: "free",
    nameKey: "pricing.free.name",
    priceKey: "pricing.free.price",
    descKey: "pricing.free.desc",
    ctaKey: "pricing.free.cta",
    showPeriod: true,
    ctaVariant: "secondary",
    ctaHref: "#",
  },
  {
    id: "pro",
    nameKey: "pricing.pro.name",
    priceKey: "pricing.pro.price",
    descKey: "pricing.pro.desc",
    ctaKey: "pricing.pro.cta",
    showPeriod: true,
    popular: true,
    ctaVariant: "primary",
    ctaHref: "#",
  },
  {
    id: "team",
    nameKey: "pricing.team.name",
    priceKey: "pricing.team.price",
    descKey: "pricing.team.desc",
    ctaKey: "pricing.team.cta",
    showPeriod: true,
    ctaVariant: "secondary",
    ctaHref: "#",
  },
  {
    id: "enterprise",
    nameKey: "pricing.enterprise.name",
    priceKey: "pricing.enterprise.price",
    descKey: "pricing.enterprise.desc",
    ctaKey: "pricing.enterprise.cta",
    showPeriod: false,
    ctaVariant: "secondary",
    ctaHref: "#",
  },
];

export function Pricing() {
  const { t } = useTranslation();

  return (
    <section
      id="pricing"
      className={`${styles.container} ${styles.section}`}
      aria-labelledby="pricing-heading"
    >
      <div className={styles.sectionHead}>
        <h2 id="pricing-heading" className={styles.sectionHeading}>
          {t("pricing.heading")}
        </h2>
        <p className={styles.sectionLead}>{t("pricing.subheading")}</p>
      </div>

      <div className={styles.pricingGrid}>
        {TIERS.map((tier) => {
          const headingId = `price-${tier.id}-name`;
          return (
            <Card
              key={tier.id}
              variant={tier.popular ? "elevated" : "outlined"}
              className={tier.popular ? styles.priceCardFeatured : undefined}
            >
              <article className={styles.priceCard} aria-labelledby={headingId}>
                <div className={styles.priceHead}>
                  <h3 id={headingId} className={styles.priceName}>
                    {t(tier.nameKey)}
                  </h3>
                  {tier.popular && <Badge tone="info">{t("pricing.popular")}</Badge>}
                </div>

                <div className={styles.priceAmount}>
                  <span className={styles.priceValue}>{t(tier.priceKey)}</span>
                  {tier.showPeriod && (
                    <span className={styles.pricePeriod}>{t("pricing.perMonth")}</span>
                  )}
                </div>

                <p className={styles.priceDesc}>{t(tier.descKey)}</p>

                <a
                  href={tier.ctaHref}
                  className={buttonClass(tier.ctaVariant, "md")}
                  style={{ width: "100%" }}
                >
                  {t(tier.ctaKey)}
                </a>
              </article>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
