/**
 * §SEARCH EXECUTION TIME BUDGET & STALENESS WATCHDOG
 * 
 * Provides an execution budget with a 180-second (3 minutes) baseline,
 * dynamically scaling up to a strict 300-second (5 minutes) non-negotiable ceiling.
 * Protects complex multi-source ATS harvesting (Greenhouse, Lever, Ashby, LinkedIn)
 * against premature ORPHANED_TIMEOUT abortion.
 */

export const SEARCH_BASELINE_BUDGET_MS = 180 * 1000;  // 180 seconds baseline (3 minutes)
export const SEARCH_MAX_CEILING_MS = 300 * 1000;     // 300 seconds (5 minutes) non-negotiable hard ceiling
export const SEARCH_WATCHDOG_STALENESS_BASELINE_MS = 180 * 1000; // 180 seconds
export const SEARCH_WATCHDOG_STALENESS_CEILING_MS = 300 * 1000;  // 300 seconds

export interface SearchBudgetOptions {
  query?: string;
  sources?: string[];
  requestedCount?: number;
  companies?: string[];
  roles?: string[];
  isMultiSource?: boolean;
}

export interface CalculatedSearchBudget {
  budgetMs: number;
  budgetSeconds: number;
  isScaled: boolean;
  breakdown: {
    baselineMs: number;
    multiSourceAdditionMs: number;
    requestedCountAdditionMs: number;
    companyAdditionMs: number;
    unclampedTotalMs: number;
  };
  reasons: string[];
}

/**
 * Calculates a dynamically scaled execution time budget for discovery search.
 * Baseline: 180s (180,000ms).
 * Hard ceiling: 300s (300,000ms).
 */
export function calculateSearchExecutionBudget(options: SearchBudgetOptions = {}): CalculatedSearchBudget {
  const reasons: string[] = [];
  let multiSourceAdditionMs = 0;
  let requestedCountAdditionMs = 0;
  let companyAdditionMs = 0;

  // Multi-source ATS harvesting detection (Greenhouse, Lever, Ashby, LinkedIn, etc.)
  const sources = options.sources || [];
  const queryLower = (options.query || "").toLowerCase();
  const isAtsHarvesting =
    options.isMultiSource ||
    sources.length > 1 ||
    /\b(greenhouse|lever|ashby|linkedin|workday|icims|smartrecruiters|ats)\b/i.test(queryLower) ||
    sources.some((s) => /ats|greenhouse|lever|ashby|linkedin/i.test(s));

  if (isAtsHarvesting) {
    // Dynamic scale for complex multi-source ATS queries
    multiSourceAdditionMs = 60 * 1000; // +60s
    reasons.push("multi_source_ats_harvesting (+60s)");
  }

  if (sources.length > 2) {
    const extraSources = sources.length - 2;
    const add = extraSources * 20 * 1000;
    multiSourceAdditionMs += add;
    reasons.push(`additional_sources_${extraSources} (+${add / 1000}s)`);
  }

  // Requested count scaling (> 10 results requires additional harvest/verification passes)
  if (options.requestedCount && options.requestedCount > 10) {
    const additional = Math.min(options.requestedCount - 10, 20) * 3 * 1000; // +3s per additional requested candidate
    requestedCountAdditionMs = additional;
    reasons.push(`requested_count_${options.requestedCount} (+${additional / 1000}s)`);
  }

  // Multiple target companies require federated ATS lookups
  if (options.companies && options.companies.length > 1) {
    const add = Math.min(options.companies.length * 10 * 1000, 40 * 1000);
    companyAdditionMs = add;
    reasons.push(`target_companies_${options.companies.length} (+${add / 1000}s)`);
  }

  // Allow environment override if within valid range
  const envBudget = process.env.SEARCH_EXECUTION_BUDGET_MS
    ? parseInt(process.env.SEARCH_EXECUTION_BUDGET_MS, 10)
    : null;

  const unclampedTotalMs = (envBudget && !isNaN(envBudget))
    ? envBudget
    : SEARCH_BASELINE_BUDGET_MS + multiSourceAdditionMs + requestedCountAdditionMs + companyAdditionMs;

  // Strict enforcement: non-negotiable 300s maximum ceiling, 180s baseline minimum
  const budgetMs = Math.min(Math.max(unclampedTotalMs, SEARCH_BASELINE_BUDGET_MS), SEARCH_MAX_CEILING_MS);

  return {
    budgetMs,
    budgetSeconds: Math.round(budgetMs / 1000),
    isScaled: budgetMs > SEARCH_BASELINE_BUDGET_MS,
    breakdown: {
      baselineMs: SEARCH_BASELINE_BUDGET_MS,
      multiSourceAdditionMs,
      requestedCountAdditionMs,
      companyAdditionMs,
      unclampedTotalMs,
    },
    reasons,
  };
}

/**
 * Checks if a search execution has exceeded its execution budget or staleness threshold.
 * Returns true if stale (exceeded budget or watchdog timeout).
 */
export function isSearchStaleOrExceeded(
  search: {
    createdAt: Date;
    startedAt?: Date | null;
    updatedAt: Date;
    status?: string;
  },
  budgetMs: number = SEARCH_BASELINE_BUDGET_MS
): { isStale: boolean; reason?: "HARD_CEILING_EXCEEDED" | "HEARTBEAT_TIMEOUT" } {
  const now = Date.now();
  const startTime = new Date(search.startedAt || search.createdAt).getTime();
  const totalAgeMs = now - startTime;
  const timeSinceLastUpdate = now - new Date(search.updatedAt).getTime();

  // Strict 300-second non-negotiable hard ceiling from start
  if (totalAgeMs > SEARCH_MAX_CEILING_MS) {
    return { isStale: true, reason: "HARD_CEILING_EXCEEDED" };
  }

  // Staleness watchdog: accommodates up to budgetMs (baseline 180s up to 300s)
  const effectiveWatchdogMs = Math.min(
    Math.max(budgetMs, SEARCH_WATCHDOG_STALENESS_BASELINE_MS),
    SEARCH_WATCHDOG_STALENESS_CEILING_MS
  );
  if (timeSinceLastUpdate > effectiveWatchdogMs) {
    return { isStale: true, reason: "HEARTBEAT_TIMEOUT" };
  }

  return { isStale: false };
}
