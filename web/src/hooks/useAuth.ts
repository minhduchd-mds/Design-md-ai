/**
 * useAuth — Authentication hook extracted from main.tsx.
 *
 * Manages user session, login/register form state, Google OAuth,
 * and plan upgrade. Refreshes TTL on app load.
 */

import { useCallback, useState } from "react";
import type { AppView, AuthMode, SessionUser } from "../app/types";
import {
  register,
  login,
  updatePlan,
  getSessionUser,
  saveSessionUser,
  clearSessionUser,
  SESSION_TTL_MS,
} from "../app/auth";

// ── Stable hash for Google OAuth sub → emailHash ──────────────
function stableHash(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (Math.imul(31, hash) + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ── Types ─────────────────────────────────────────────────────

export interface UseAuthReturn {
  /* state */
  user: SessionUser | null;
  view: AppView;
  authMode: AuthMode;
  email: string;
  password: string;
  showPassword: boolean;
  authError: string;

  /* setters */
  setUser: React.Dispatch<React.SetStateAction<SessionUser | null>>;
  setView: React.Dispatch<React.SetStateAction<AppView>>;
  setAuthMode: React.Dispatch<React.SetStateAction<AuthMode>>;
  setEmail: React.Dispatch<React.SetStateAction<string>>;
  setPassword: React.Dispatch<React.SetStateAction<string>>;
  setShowPassword: React.Dispatch<React.SetStateAction<boolean>>;
  setAuthError: React.Dispatch<React.SetStateAction<string>>;

  /* actions */
  handleAuthSubmit: (event: React.FormEvent, onSuccess?: () => void) => Promise<void>;
  handleGoogleLogin: (credentialResponse: { credential?: string }) => void;
  upgradeToPro: () => void;
  logout: () => void;
}

// ── Hook ──────────────────────────────────────────────────────

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<SessionUser | null>(() => {
    const session = getSessionUser();
    if (session) saveSessionUser(session); // refresh TTL
    return session;
  });

  const [view, setView] = useState<AppView>(() =>
    getSessionUser() ? "workspace" : "landing",
  );

  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  const handleAuthSubmit = useCallback(
    async (event: React.FormEvent, onSuccess?: () => void) => {
      event.preventDefault();
      setAuthError("");
      try {
        const session =
          authMode === "login"
            ? await login(email, password)
            : await register(email, password);
        saveSessionUser(session);
        setUser(session);
        setPassword("");
        onSuccess?.();
        setView("workspace");
      } catch (error) {
        setAuthError(
          error instanceof Error ? error.message : String(error),
        );
      }
    },
    [authMode, email, password],
  );

  const handleGoogleLogin = useCallback(
    (credentialResponse: { credential?: string }) => {
      const token = credentialResponse.credential;
      if (!token) {
        setAuthError("Google login failed — no credential received.");
        return;
      }
      try {
        const base64 = token
          .split(".")[1]
          .replace(/-/g, "+")
          .replace(/_/g, "/");
        const payload = JSON.parse(atob(base64)) as {
          sub?: string;
          email?: string;
        };
        if (!payload.sub || !payload.email) throw new Error("Missing fields");
        const session: SessionUser = {
          emailHash: stableHash(payload.sub),
          displayEmail: payload.email,
          plan: "free",
          expiresAt: Date.now() + SESSION_TTL_MS,
        };
        saveSessionUser(session);
        setUser(session);
        setView("workspace");
      } catch {
        setAuthError(
          "Could not read Google account info. Try email login.",
        );
      }
    },
    [],
  );

  const upgradeToPro = useCallback(() => {
    if (!user) return;
    updatePlan(user.emailHash, "pro");
    const nextUser = { ...user, plan: "pro" as const };
    saveSessionUser(nextUser);
    setUser(nextUser);
  }, [user]);

  const logout = useCallback(() => {
    clearSessionUser();
    setUser(null);
    setView("landing");
  }, []);

  return {
    user,
    view,
    authMode,
    email,
    password,
    showPassword,
    authError,
    setUser,
    setView,
    setAuthMode,
    setEmail,
    setPassword,
    setShowPassword,
    setAuthError,
    handleAuthSubmit,
    handleGoogleLogin,
    upgradeToPro,
    logout,
  };
}
