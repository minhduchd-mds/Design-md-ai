/**
 * authRepo — repository wrapping auth with Supabase Auth support.
 *
 * Strategy (dual-mode):
 *  • If VITE_SUPABASE_URL is configured → use Supabase Auth (production)
 *  • Otherwise → fallback to localStorage AES-GCM auth (offline/dev)
 *
 * The UI layer only imports authRepo, never auth.ts or supabase.ts directly.
 * Swapping backend = updating this file only.
 */

import {
  register as localRegister,
  login as localLogin,
  getSessionUser,
  saveSessionUser,
  clearSessionUser,
  updatePlan,
  getProjectHistory,
  saveProjectHistory,
} from "../app/auth";
import type { AccountPlan, ProjectHistoryItem, SessionUser } from "../app/types";
import { supabase } from "../lib/supabase";
import { errorBus } from "../lib/errorBus";
import { eventBus } from "../lib/eventBus";

// ── Strategy detection ────────────────────────────────────────

const USE_SUPABASE = supabase !== null;

// ── Supabase helpers ──────────────────────────────────────────

async function supabaseRegister(email: string, password: string): Promise<SessionUser> {
  const { data, error } = await supabase!.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error("Registration succeeded but no user returned.");
  return {
    emailHash: data.user.id,
    displayEmail: data.user.email ?? email,
    plan: "free",
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  };
}

async function supabaseLogin(email: string, password: string): Promise<SessionUser> {
  const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.user || !data.session) throw new Error("Login failed — no session returned.");
  return {
    emailHash: data.user.id,
    displayEmail: data.user.email ?? email,
    plan: (data.user.user_metadata?.plan as AccountPlan | undefined) ?? "free",
    expiresAt: new Date(data.session.expires_at! * 1000).getTime(),
  };
}

async function supabaseLogout(): Promise<void> {
  await supabase!.auth.signOut();
}

async function getSupabaseSession(): Promise<SessionUser | null> {
  const { data: { session } } = await supabase!.auth.getSession();
  if (!session) return null;
  return {
    emailHash: session.user.id,
    displayEmail: session.user.email ?? "",
    plan: (session.user.user_metadata?.plan as AccountPlan | undefined) ?? "free",
    expiresAt: new Date(session.expires_at! * 1000).getTime(),
  };
}

// ── Public repository ─────────────────────────────────────────

export const authRepo = {
  // ── Auth ────────────────────────────────────────────────────

  async register(email: string, password: string): Promise<SessionUser> {
    try {
      const user = USE_SUPABASE
        ? await supabaseRegister(email, password)
        : await localRegister(email, password);

      if (!USE_SUPABASE) saveSessionUser(user);
      eventBus.emit("session:started", { emailHash: user.emailHash, plan: user.plan });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      errorBus.auth(message);
      throw err;
    }
  },

  async login(email: string, password: string): Promise<SessionUser> {
    try {
      const user = USE_SUPABASE
        ? await supabaseLogin(email, password)
        : await localLogin(email, password);

      if (!USE_SUPABASE) saveSessionUser(user);
      eventBus.emit("session:started", { emailHash: user.emailHash, plan: user.plan });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      errorBus.auth(message);
      throw err;
    }
  },

  // ── Session ──────────────────────────────────────────────────

  /** Synchronous for localStorage mode, returns null for Supabase (use getSessionAsync). */
  getSession(): SessionUser | null {
    if (USE_SUPABASE) return null; // Supabase sessions are async — use getSessionAsync
    const user = getSessionUser();
    if (!user) return null;
    if (user.expiresAt <= Date.now()) {
      clearSessionUser();
      eventBus.emit("session:expired");
      return null;
    }
    return user;
  },

  /** Async version — works for both Supabase and localStorage. */
  async getSessionAsync(): Promise<SessionUser | null> {
    if (USE_SUPABASE) {
      const session = await getSupabaseSession();
      if (!session) eventBus.emit("session:expired");
      return session;
    }
    return this.getSession();
  },

  logout(): void {
    if (USE_SUPABASE) {
      void supabaseLogout();
    } else {
      clearSessionUser();
    }
    eventBus.emit("session:expired");
  },

  // ── Auth mode indicator ──────────────────────────────────────

  get mode(): "supabase" | "local" {
    return USE_SUPABASE ? "supabase" : "local";
  },

  // ── Plan ─────────────────────────────────────────────────────

  upgradePlan(emailHash: string, plan: AccountPlan): void {
    if (!USE_SUPABASE) updatePlan(emailHash, plan);
    // Supabase: update user_metadata via admin API (server-side only)
    eventBus.emit("session:plan:upgraded", { plan });
  },

  // ── Project history ──────────────────────────────────────────

  getProjectHistory(): ProjectHistoryItem[] {
    return getProjectHistory();
  },

  saveProjectHistory(items: ProjectHistoryItem[]): void {
    saveProjectHistory(items);
  },
};
