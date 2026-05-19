/**
 * usageTracker — Client-side token metering & cost tracking.
 *
 * Tracks per-request token usage, computes hourly burn rates and costs,
 * and provides daily per-model request counts.  All data is persisted in
 * localStorage and auto-pruned after 7 days.
 *
 * Pricing reflects public API pricing as of 2025-Q2.
 */

// ── Model pricing (per 1 M tokens, USD) ─────────────────

export interface ModelPricing {
  input: number;
  output: number;
  dailyLimit: number;
  label: string;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Google Gemini
  "gemini-2.0-flash":      { input: 0.10,  output: 0.40,  dailyLimit: 1500, label: "Gemini 2.0 Flash" },
  "gemini-2.5-flash":      { input: 0.15,  output: 0.60,  dailyLimit: 500,  label: "Gemini 2.5 Flash" },
  "gemini-2.0-flash-lite": { input: 0.075, output: 0.30,  dailyLimit: 1500, label: "Gemini 2.0 Lite" },
  // Groq
  "llama-3.3-70b-versatile": { input: 0.59, output: 0.79, dailyLimit: 1000, label: "Llama 3.3 70B" },
  "llama-3.1-8b-instant":    { input: 0.05, output: 0.08, dailyLimit: 1000, label: "Llama 3.1 8B" },
  "mixtral-8x7b-32768":      { input: 0.24, output: 0.24, dailyLimit: 1000, label: "Mixtral 8x7B" },
  "gemma2-9b-it":             { input: 0.20, output: 0.20, dailyLimit: 1000, label: "Gemma 2 9B" },
};

// ── Usage record ─────────────────────────────────────────

export interface UsageRecord {
  /** Epoch ms */
  ts: number;
  /** Model ID from MODEL_PRICING keys */
  model: string;
  /** Prompt / input tokens */
  p: number;
  /** Completion / output tokens */
  c: number;
}

export interface DailyModelUsage {
  model: string;
  label: string;
  count: number;
  limit: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface UsageSnapshot {
  /** Tokens consumed in the last 60 min */
  hourlyTokens: number;
  /** Estimated USD cost in the last 60 min */
  hourlyCost: number;
  /** Total requests today */
  todayRequests: number;
  /** Total USD cost today */
  todayCost: number;
  /** Per-model daily breakdown */
  models: DailyModelUsage[];
}

// ── Persistence keys ─────────────────────────────────────

const STORAGE_PREFIX = "desygn.usage:";
const PRUNE_DAYS = 7;

function storageKey(emailHash: string): string {
  return `${STORAGE_PREFIX}${emailHash}`;
}

// ── Core API ─────────────────────────────────────────────

function loadRecords(emailHash: string): UsageRecord[] {
  try {
    const raw = localStorage.getItem(storageKey(emailHash));
    if (!raw) return [];
    const records: UsageRecord[] = JSON.parse(raw);
    const cutoff = Date.now() - PRUNE_DAYS * 86_400_000;
    return records.filter((r) => r.ts > cutoff);
  } catch {
    return [];
  }
}

function saveRecords(emailHash: string, records: UsageRecord[]): void {
  try {
    localStorage.setItem(storageKey(emailHash), JSON.stringify(records));
  } catch {
    // Storage full — silently drop old records
    const half = records.slice(Math.floor(records.length / 2));
    try { localStorage.setItem(storageKey(emailHash), JSON.stringify(half)); } catch { /* give up */ }
  }
}

/** Record a single request's token usage. */
export function recordUsage(
  emailHash: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): void {
  const records = loadRecords(emailHash);
  records.push({ ts: Date.now(), model, p: promptTokens, c: completionTokens });
  saveRecords(emailHash, records);
}

/** Compute a full usage snapshot (hourly burn, daily totals, per-model). */
export function getUsageSnapshot(emailHash: string): UsageSnapshot {
  const records = loadRecords(emailHash);
  const now = Date.now();
  const oneHourAgo = now - 3_600_000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCutoff = todayStart.getTime();

  let hourlyTokens = 0;
  let hourlyCost = 0;
  let todayRequests = 0;
  let todayCost = 0;

  const modelMap = new Map<string, { count: number; input: number; output: number; cost: number }>();

  for (const r of records) {
    const pricing = MODEL_PRICING[r.model];
    const cost = pricing
      ? (r.p * pricing.input + r.c * pricing.output) / 1_000_000
      : 0;

    // Hourly aggregates
    if (r.ts >= oneHourAgo) {
      hourlyTokens += r.p + r.c;
      hourlyCost += cost;
    }

    // Daily aggregates
    if (r.ts >= todayCutoff) {
      todayRequests++;
      todayCost += cost;

      const entry = modelMap.get(r.model) ?? { count: 0, input: 0, output: 0, cost: 0 };
      entry.count++;
      entry.input += r.p;
      entry.output += r.c;
      entry.cost += cost;
      modelMap.set(r.model, entry);
    }
  }

  const models: DailyModelUsage[] = [];
  for (const [model, data] of modelMap) {
    const pricing = MODEL_PRICING[model];
    models.push({
      model,
      label: pricing?.label ?? model,
      count: data.count,
      limit: pricing?.dailyLimit ?? 1000,
      inputTokens: data.input,
      outputTokens: data.output,
      cost: data.cost,
    });
  }
  // Sort by count desc
  models.sort((a, b) => b.count - a.count);

  return { hourlyTokens, hourlyCost, todayRequests, todayCost, models };
}

/** Get daily limit for a specific model. */
export function getDailyLimit(model: string): number {
  return MODEL_PRICING[model]?.dailyLimit ?? 1000;
}

/** Check if the user has exceeded the daily limit for a model. */
export function isOverDailyLimit(emailHash: string, model: string): boolean {
  const snapshot = getUsageSnapshot(emailHash);
  const modelUsage = snapshot.models.find((m) => m.model === model);
  if (!modelUsage) return false;
  return modelUsage.count >= getDailyLimit(model);
}

// ── Formatting helpers ───────────────────────────────────

/** Format token count: 1234 → "1.2K", 500 → "500" */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Format USD cost: 0.00342 → "$0.003", 1.5 → "$1.50" */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
