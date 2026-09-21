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

export interface LayerExecutionBudgets {
  layer1_intentMs: number;
  layer2_contextMs: number;
  layer3_planMs: number;
  layer4_harvestMs: number;
  layer5_verifyMs: number;
  layer6_rankPersistMs: number;
  totalMaxBudgetMs: number;
  totalMaxBudgetSeconds: number;
  isServerless: boolean;
  breakdown: Record<string, number>;
  reasons: string[];
}

/**
 * Calculates stage-by-stage maximum time budgets for each architectural layer:
 * Layer 1: Intent & Constraint Parsing (500ms max)
 * Layer 2: Context & Memory Retrieval (1000ms max)
 * Layer 3: Action Planning & Capability Guard (1500ms max)
 * Layer 4: Multi-Source Federated Harvesting & DeepReach Social Scouting (14s-22s serverless / 120s dedicated)
 * Layer 5: Evidence Verification & De-duplication (3s serverless / 25s dedicated)
 * Layer 6: 100-Point Ranking & Chunked Persistence (3s serverless / 15s dedicated)
 *
 * Takes maximum time possibilities to allow full multi-source discovery while bounding total execution.
 */
export function calculateLayerExecutionBudgets(
  options: SearchBudgetOptions & { isServerless?: boolean } = {}
): LayerExecutionBudgets {
  const isServerless =
    options.isServerless ??
    Boolean(
      process.env.VERCEL === "1" ||
      process.env.NEXT_SERVERLESS === "1" ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
    );

  const sources = options.sources || [];
  const reasons: string[] = [];

  const layer1_intentMs = 500;
  const layer2_contextMs = 1000;
  const layer3_planMs = 1500;

  let layer4_harvestMs = isServerless ? 14000 : 120000;

  if (sources.length > 2) {
    const extraSources = sources.length - 2;
    const add = isServerless ? extraSources * 1500 : extraSources * 15000;
    layer4_harvestMs += add;
    reasons.push(`additional_sources_${extraSources} (+${add / 1000}s)`);
  }

  if (options.companies && options.companies.length > 1) {
    const add = isServerless ? Math.min(options.companies.length * 1000, 3000) : options.companies.length * 10000;
    layer4_harvestMs += add;
    reasons.push(`target_companies_${options.companies.length} (+${add / 1000}s)`);
  }

  if (isServerless) {
    layer4_harvestMs = Math.min(layer4_harvestMs, 22000);
  }

  const layer5_verifyMs = isServerless ? 3000 : 25000;
  const layer6_rankPersistMs = isServerless ? 3000 : 15000;

  const rawTotal =
    layer1_intentMs +
    layer2_contextMs +
    layer3_planMs +
    layer4_harvestMs +
    layer5_verifyMs +
    layer6_rankPersistMs;

  const totalMaxBudgetMs = isServerless
    ? Math.min(Math.max(rawTotal, 20000), 45000)
    : Math.min(Math.max(rawTotal, SEARCH_BASELINE_BUDGET_MS), SEARCH_MAX_CEILING_MS);

  return {
    layer1_intentMs,
    layer2_contextMs,
    layer3_planMs,
    layer4_harvestMs,
    layer5_verifyMs,
    layer6_rankPersistMs,
    totalMaxBudgetMs,
    totalMaxBudgetSeconds: Math.round(totalMaxBudgetMs / 1000),
    isServerless,
    breakdown: {
      layer1_intentMs,
      layer2_contextMs,
      layer3_planMs,
      layer4_harvestMs,
      layer5_verifyMs,
      layer6_rankPersistMs,
    },
    reasons,
  };
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
