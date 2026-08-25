/**
 * §FAST-CALCULATED TIME BUDGET ENGINE (Prompt C2)
 * Pure, near-instant calculation (< 1ms) running at job creation time BEFORE any AI/Gemini calls.
 * Absolute Hard Ceiling: 300 seconds (5 minutes). Floor: 30 seconds.
 */

export const MIN_TIME_BUDGET_MS = 30 * 1000;      // 30 seconds floor
export const BASE_TIME_BUDGET_MS = 45 * 1000;     // 45 seconds baseline default
export const MAX_HARD_CEILING_MS = 300 * 1000;    // 300 seconds (5 minutes) hard ceiling

export interface TimeBudgetOptions {
  prompt: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
}

export interface CalculatedTimeBudget {
  budgetMs: number;
  budgetSeconds: number;
  breakdown: {
    baseMs: number;
    keywordAdditionsMs: number;
    domainAdditionsMs: number;
    stepBudgetScalingMs: number;
    unclampedTotalMs: number;
  };
  matchedHeuristics: string[];
}

/**
 * Calculates a deterministic execution time budget from prompt heuristics and task constraints
 */
export function calculateJobTimeBudget(options: TimeBudgetOptions): CalculatedTimeBudget {
  const promptLower = (options.prompt || "").toLowerCase();
  const matchedHeuristics: string[] = [];
  let keywordAdditionsMs = 0;

  // 1. Screenshot / Visual Capture Heuristic (+15s)
  if (/\b(screenshot|capture|viewport|snapshot|image|visual)\b/i.test(promptLower)) {
    keywordAdditionsMs += 15 * 1000;
    matchedHeuristics.push("visual_capture (+15s)");
  }

  // 2. Form Interaction / Input / Search Heuristic (+20s)
  if (/\b(form|fill|input|type|submit|select|radio|search|query|enter)\b/i.test(promptLower)) {
    keywordAdditionsMs += 20 * 1000;
    matchedHeuristics.push("form_interaction (+20s)");
  }

  // 3. Authentication / Login Flows (+25s)
  if (/\b(login|auth|sign in|signup|credential|password|account)\b/i.test(promptLower)) {
    keywordAdditionsMs += 25 * 1000;
    matchedHeuristics.push("auth_flow (+25s)");
  }

  // 4. Multi-Page / Comparison / Table Extraction (+35s)
  if (/\b(compare|multiple|table|paginate|pagination|pages|list|extract all|crawl|rows|pricing)\b/i.test(promptLower)) {
    keywordAdditionsMs += 35 * 1000;
    matchedHeuristics.push("multi_page_comparison (+35s)");
  }

  // 5. Download / Export Files (+20s)
  if (/\b(download|export|pdf|csv|json|file|report)\b/i.test(promptLower)) {
    keywordAdditionsMs += 20 * 1000;
    matchedHeuristics.push("export_download (+20s)");
  }

  // 6. Domain Breadth Heuristics (+15s per extra domain beyond the first)
  const domainsCount = (options.allowedDomains || []).length;
  const domainAdditionsMs = domainsCount > 1 ? (domainsCount - 1) * 15 * 1000 : 0;
  if (domainAdditionsMs > 0) {
    matchedHeuristics.push(`multi_domain (${domainsCount} domains, +${domainAdditionsMs / 1000}s)`);
  }

  // 7. Step Budget Scaling (+3s per step beyond 10)
  const maxSteps = options.maxStepsBudget;
  const stepBudgetScalingMs = maxSteps && maxSteps > 10 ? (maxSteps - 10) * 3 * 1000 : 0;
  if (stepBudgetScalingMs > 0) {
    matchedHeuristics.push(`step_scaling (${maxSteps} steps, +${stepBudgetScalingMs / 1000}s)`);
  }

  const unclampedTotalMs = BASE_TIME_BUDGET_MS + keywordAdditionsMs + domainAdditionsMs + stepBudgetScalingMs;

  // STRICT ENFORCEMENT: Clamp between 30s floor and 300s (5-minute) non-negotiable hard ceiling
  const budgetMs = Math.min(Math.max(unclampedTotalMs, MIN_TIME_BUDGET_MS), MAX_HARD_CEILING_MS);

  return {
    budgetMs,
    budgetSeconds: Math.round(budgetMs / 1000),
    breakdown: {
      baseMs: BASE_TIME_BUDGET_MS,
      keywordAdditionsMs,
      domainAdditionsMs,
      stepBudgetScalingMs,
      unclampedTotalMs,
    },
    matchedHeuristics,
  };
}
