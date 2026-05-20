/**
 * TopBar — header for the authenticated app shell.
 *
 * Holds the language toggle, an optional avatar for the signed-in user, and a
 * sign-out button. Sign-out is shown only when a user session exists; in the
 * degraded/no-backend mode there is no user so the control is omitted (the
 * page's own buttons still satisfy the e2e ">=1 button" check).
 */

import { useNavigate } from "@tanstack/react-router";
import { Avatar, Button } from "@desygn/ui";
import { useTranslation } from "../i18n/index.js";
import { useAuth } from "../auth/AuthContext.js";
import { LanguageToggle } from "./LanguageToggle.js";
import styles from "./TopBar.module.css";

export function TopBar() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  const displayName = user?.email ?? user?.id ?? "";

  return (
    <header className={styles.topbar}>
      <div className={styles.spacer}>
        <LanguageToggle />
      </div>

      {user && (
        <div className={styles.user} aria-label={t("shell.userMenuLabel")}>
          {displayName && <Avatar name={displayName} size="sm" />}
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            {t("shell.signOut")}
          </Button>
        </div>
      )}
    </header>
  );
}
