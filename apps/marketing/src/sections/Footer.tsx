/**
 * Footer — site footer with brand blurb + grouped navigation.
 *
 * Renders the page's single <footer> landmark. Link groups use <nav> with an
 * accessible name so screen-reader users can distinguish them (WCAG 1.3.1).
 */

import { useTranslation } from "../i18n/index.js";
import styles from "./sections.module.css";

export function Footer() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerGrid}>
          <div>
            <div className={styles.footerBrand}>{t("brand.name")}</div>
            <p className={styles.footerTagline}>{t("footer.tagline")}</p>
          </div>

          <nav aria-label={t("footer.product")}>
            <h2 className={styles.footerColTitle}>{t("footer.product")}</h2>
            <div className={styles.footerNav}>
              <a className={styles.footerLink} href="#features">
                {t("footer.linkFeatures")}
              </a>
              <a className={styles.footerLink} href="#pricing">
                {t("footer.linkPricing")}
              </a>
              <a className={styles.footerLink} href="#faq">
                {t("footer.linkFaq")}
              </a>
            </div>
          </nav>

          <nav aria-label={t("footer.resources")}>
            <h2 className={styles.footerColTitle}>{t("footer.resources")}</h2>
            <div className={styles.footerNav}>
              <a className={styles.footerLink} href="#">
                {t("footer.linkDocs")}
              </a>
              <a className={styles.footerLink} href="#">
                {t("footer.linkDashboard")}
              </a>
              <a
                className={styles.footerLink}
                href="https://github.com/minhduchd-mds/desygn-ai"
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("footer.linkGithub")}
              </a>
            </div>
          </nav>
        </div>

        <div className={styles.footerBottom}>
          © {year} {t("brand.name")}. {t("footer.rights")}
        </div>
      </div>
    </footer>
  );
}
