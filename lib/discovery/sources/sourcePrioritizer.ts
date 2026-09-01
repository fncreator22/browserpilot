/**
 * §ADAPTIVE SOURCE PRIORITIZER & 48-HOUR FRESHNESS REFRESH EVALUATOR (TASK-038)
 * 
 * Deterministically ranks and prioritizes sources for a given search intent,
 * avoiding wasteful redundant crawls while enforcing the strict 48-hour freshness boundary.
 */

import { type SourceDefinition } from "./sourceTypes";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

export interface PrioritizedSource {
  source: SourceDefinition;
  priorityScore: number;
  isStale: boolean;
  reason: string;
}

/**
 * 48-Hour Freshness Rule:
 * Evaluates whether a source or company dataset is stale and requires refreshing.
 */
export function shouldRefreshSource(
  source: SourceDefinition,
  lastCrawlAt?: Date | null,
  freshnessThresholdHours = 48
): boolean {
  if (!lastCrawlAt) return true;

  const ageMs = Date.now() - new Date(lastCrawlAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);

  return ageHours >= freshnessThresholdHours;
}

/**
 * Adaptive Source Prioritization:
 * Selects and orders the most relevant discovery mediums for the user's intent.
 */
export function prioritizeSources(
  sources: SourceDefinition[],
  intent: SearchIntent,
  options: { freshnessWindowHours?: number; maxSources?: number } = {}
): PrioritizedSource[] {
  const freshnessHours = options.freshnessWindowHours ?? intent.freshnessWindowHours ?? 48;
  const maxSources = options.maxSources ?? 6;

  const roleText = (intent.role || intent.roles?.join(" ") || "").toLowerCase();
  const isInternship = /\b(intern|internship|student|grad|graduate|new grad|co-op)\b/i.test(roleText);
  const isStartup = intent.companyType === "STARTUP" || /\b(startup|early stage|yc|seed|series a)\b/i.test(roleText);
  const isTargetingCompanies = (intent.companies && intent.companies.length > 0) || !!intent.company;

  const scored: PrioritizedSource[] = [];

  for (const src of sources) {
    if (src.status === "BLOCKED") continue;

    let score = src.reliabilityScore * 50; // Base score (max 50)
    let reason = "Standard source coverage";

    // 1. Relevance boost based on intent
    if (isTargetingCompanies && (src.type === "ATS_PORTAL" || src.name === "LinkedIn")) {
      score += 40;
      reason = "Direct employer ATS & company targeting";
    } else if (isInternship && (src.name === "GitHub Curated" || src.name === "LinkedIn" || src.name === "Indeed")) {
      score += 35;
      reason = "High-density student & internship listings";
    } else if (isStartup && (src.name === "Y Combinator" || src.name === "Ashby" || src.name === "Hacker News")) {
      score += 35;
      reason = "Startup & tech community hiring";
    } else if (src.type === "AGGREGATOR") {
      score += 20;
    }

    // 2. Freshness calculation
    const isStale = shouldRefreshSource(src, src.lastSuccessfulCrawlAt, freshnessHours);
    if (isStale) {
      score += 10; // Prioritize stale sources that need refreshing
    }

    // 3. Degraded penalty
    if (src.status === "DEGRADED") {
      score -= 25;
      reason += " (Degraded health - demoted)";
    }

    scored.push({
      source: src,
      priorityScore: Math.round(score),
      isStale,
      reason,
    });
  }

  // Sort descending by priorityScore
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  return scored.slice(0, maxSources);
}
