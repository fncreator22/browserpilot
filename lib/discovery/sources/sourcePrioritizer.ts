/**
 * §ADAPTIVE SOURCE PRIORITIZER & 48-HOUR FRESHNESS REFRESH EVALUATOR (TASK-039)
 * 
 * Deterministically ranks and prioritizes sources for a given search intent,
 * checking user authenticated sessions, avoiding wasteful redundant crawls,
 * and selectively refreshing only stale sources for specific employers.
 */

import { type SourceDefinition } from "./sourceTypes";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

export interface PrioritizedSource {
  source: SourceDefinition;
  priorityScore: number;
  isStale: boolean;
  isAuthenticated: boolean;
  reason: string;
}

/**
 * 48-Hour Freshness Rule:
 * Evaluates whether a general source or candidate dataset is stale and requires refreshing.
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
 * Per-Source Employer Freshness Rule (TASK-039 Requirement 6):
 * Selectively evaluates freshness per source for a company.
 * E.g. LinkedIn 12h ago (fresh), Greenhouse 51h ago (stale), Company Careers 9h ago (fresh)
 * -> triggers refresh ONLY for Greenhouse.
 */
export function shouldRefreshCompanySource(
  sourceFreshnessMap: Record<string, string | Date> | undefined | null,
  sourceName: string,
  freshnessThresholdHours = 48
): boolean {
  if (!sourceFreshnessMap) return true;

  const rawDate = sourceFreshnessMap[sourceName.toLowerCase()] || sourceFreshnessMap[sourceName];
  if (!rawDate) return true;

  const timestamp = new Date(rawDate).getTime();
  if (isNaN(timestamp)) return true;

  const ageHours = (Date.now() - timestamp) / (1000 * 60 * 60);
  return ageHours >= freshnessThresholdHours;
}

/**
 * Adaptive Source Prioritization:
 * Selects and orders the most valuable discovery mediums for the user's intent,
 * boosting authenticated user connections and targeting stale channels.
 */
export function prioritizeSources(
  sources: SourceDefinition[],
  intent: SearchIntent,
  options: {
    freshnessWindowHours?: number;
    maxSources?: number;
    userAuthenticatedSources?: string[];
    learnedSourceQualityBoosts?: Record<string, number>;
  } = {}
): PrioritizedSource[] {
  const freshnessHours = options.freshnessWindowHours ?? intent.freshnessWindowHours ?? 48;
  const maxSources = options.maxSources ?? 6;
  const authSet = new Set((options.userAuthenticatedSources || []).map((s) => s.toLowerCase()));
  const learnedBoosts = options.learnedSourceQualityBoosts || {};

  const roleText = (intent.role || intent.roles?.join(" ") || "").toLowerCase();
  const isInternship = /\b(intern|internship|student|grad|graduate|new grad|co-op)\b/i.test(roleText);
  const isStartup = intent.companyType === "STARTUP" || /\b(startup|early stage|yc|seed|series a)\b/i.test(roleText);
  const isTargetingCompanies = (intent.companies && intent.companies.length > 0) || !!intent.company;

  const scored: PrioritizedSource[] = [];

  for (const src of sources) {
    if (src.status === "BLOCKED") continue;

    let score = src.reliabilityScore * 50; // Base score (max 50)
    let reason = "Standard source coverage";
    const isAuthenticated = authSet.has(src.name.toLowerCase());

    // 1. Authenticated User Connection Boost (+25)
    if (isAuthenticated) {
      score += 25;
      reason = "User-authorized active browser session";
    }

    // 2. Relevance boost based on intent
    if (isTargetingCompanies && (src.type === "ATS_PORTAL" || src.name === "LinkedIn")) {
      score += 40;
      reason = isAuthenticated ? "Authenticated employer ATS & company targeting" : "Direct employer ATS & company targeting";
    } else if (isInternship && (src.name === "GitHub Curated" || src.name === "LinkedIn" || src.name === "Indeed")) {
      score += 35;
      reason = "High-density student & internship listings";
    } else if (isStartup && (src.name === "Y Combinator" || src.name === "Ashby" || src.name === "Hacker News")) {
      score += 35;
      reason = "Startup & tech community hiring";
    } else if (src.type === "AGGREGATOR") {
      score += 20;
    }

    // 3. Learned Source Quality Boost (TASK-040: -15 to +15 bounded)
    const learnedDelta = learnedBoosts[src.name.toLowerCase()] ?? learnedBoosts[src.name];
    if (typeof learnedDelta === "number" && !isNaN(learnedDelta)) {
      const boundedDelta = Math.max(-15, Math.min(15, Math.round(learnedDelta)));
      score += boundedDelta;
      if (boundedDelta > 0) {
        reason += ` (+${boundedDelta} learned source quality boost)`;
      } else if (boundedDelta < 0) {
        reason += ` (${boundedDelta} learned source quality penalty)`;
      }
    }

    // 4. Freshness calculation
    const isStale = shouldRefreshSource(src, src.lastSuccessfulCrawlAt, freshnessHours);
    if (isStale) {
      score += 10; // Prioritize stale sources that need refreshing
    }

    // 5. Degraded health penalty
    if (src.status === "DEGRADED") {
      score -= 25;
      reason += " (Degraded health - demoted)";
    }

    scored.push({
      source: src,
      priorityScore: Math.round(score),
      isStale,
      isAuthenticated,
      reason,
    });
  }

  // Sort descending by priorityScore
  scored.sort((a, b) => b.priorityScore - a.priorityScore);

  return scored.slice(0, maxSources);
}
