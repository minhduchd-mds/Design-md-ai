/**
 * Sidebar — primary navigation for the authenticated app shell.
 *
 * Renders the brand mark and a vertical nav (Dashboard, Audits, Settings).
 * Uses TanStack Router <Link> so the active route is highlighted via
 * activeProps. All labels flow through i18n.
 */

import { Link } from "@tanstack/react-router";
import { Badge } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import type { TranslationKey } from "../i18n/index.js";
import styles from "./Sidebar.module.css";

interface NavItem {
  to: string;
  labelKey: TranslationKey;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard" },
  { to: "/audits", labelKey: "nav.audits" },
  { to: "/settings", labelKey: "nav.settings" },
];

export function Sidebar() {
  const { t } = useTranslation();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span>{t("shell.brand")}</span>
        <Badge tone="info">{t("app.badge")}</Badge>
      </div>

      <nav aria-label={t("nav.primaryLabel")} className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={styles.link}
            activeProps={{ className: `${styles.link} ${styles.linkActive}` }}
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
