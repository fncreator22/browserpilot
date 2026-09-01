/**
 * §INTELLIGENT REFRESH PLANNER & DISCOVERY BUDGET CONTROLLER (TASK-042)
 * 
 * Determines exact sources to crawl vs skip based on 48-hour freshness,
 * search memory, ATS company relationships, user entitlements, and worker semaphores.
 */

import { searchMemoryService } from "./searchMemoryService";
import { sourceRegistry } from "@/lib/discovery/sources/sourceRegistry";
import { getCompanyIntelligence } from "@/lib/discovery/company/companyIntelligence";
import { checkFeatureEntitlement } from "@/lib/ai/governance/providerGovernance";
import { evaluateUsageLimit } from "@/lib/billing/usagePolicyService";

export interface RefreshDecision {
  sourceName: string;
  action: "CRAWL" | "SKIP";
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  isFresh: boolean;
  reason: string;
  affinityScore: number;
}

export interface RefreshPlan {
  targetCompany?: string;
  sourcesToCrawl: string[];
  sourcesToSkip: string[];
  decisions: RefreshDecision[];
  estimatedExecutionTimeMs: number;
  entitlementAllowed: boolean;
  quotaAllowed: boolean;
  rejectionReason?: string;
}

export class IntelligentRefreshPlanner {
  /**
   * Plans an intelligent, explainable discovery crawl and refresh schedule.
   */
  public async planRefresh(input: {
    userId?: string;
    companyName?: string;
    roleCategory?: string;
    freshnessWindowHours?: number;
    forceRefresh?: boolean;
  }): Promise<RefreshPlan> {
    const freshnessHours = input.freshnessWindowHours || 48;
    const decisions: RefreshDecision[] = [];

    // 1. Entitlement & Usage Boundary Check
    let entitlementAllowed = true;
    let quotaAllowed = true;
    let rejectionReason: string | undefined;

    if (input.userId) {
      const ent = await checkFeatureEntitlement(input.userId, "SWARM_MODE");
      entitlementAllowed = ent.allowed;
      if (!ent.allowed) {
        rejectionReason = ent.reason;
      }

      const usage = await evaluateUsageLimit(input.userId, "DISCOVERY_SEARCH");
      quotaAllowed = usage.allowed;
      if (!usage.allowed && !rejectionReason) {
        rejectionReason = usage.reason;
      }
    }

    // 2. Search Memory Retrieval
    const memory = await searchMemoryService.getSearchRecommendations({
      companyName: input.companyName,
      roleCategory: input.roleCategory,
      freshnessWindowHours: freshnessHours,
    });

    // 3. Evaluate each source decision
    const allSources = sourceRegistry.getAllSources();
    for (const src of allSources) {
      if (src.status === "BLOCKED") {
        decisions.push({
          sourceName: src.name,
          action: "SKIP",
          priority: "LOW",
          isFresh: false,
          reason: "Source status is BLOCKED due to persistent failures or maintenance.",
          affinityScore: 0.0,
        });
        continue;
      }

      const rec = memory.recommendedSources.find((r) => r.sourceName.toLowerCase() === src.name.toLowerCase());
      const isFresh = rec?.isFresh || false;
      const affinity = rec?.affinityScore || src.reliabilityScore * 0.5;

      if (isFresh && !input.forceRefresh) {
        decisions.push({
          sourceName: src.name,
          action: "SKIP",
          priority: "LOW",
          isFresh: true,
          reason: `Fresh (<${freshnessHours}h) data available in search memory — skipped redundant crawl.`,
          affinityScore: affinity,
        });
      } else {
        let priority: RefreshDecision["priority"] = "NORMAL";
        let reason = "Standard crawl refresh";

        if (input.companyName && (src.type === "ATS_PORTAL" || src.name === "LinkedIn")) {
          priority = "HIGH";
          reason = `Employer targeting: ${memory.knownAtsProvider || "Direct channel"} requires fresh sweep.`;
        } else if (affinity > 0.8) {
          priority = "HIGH";
          reason = "High historical affinity and reliability score.";
        }

        decisions.push({
          sourceName: src.name,
          action: "CRAWL",
          priority,
          isFresh: false,
          reason,
          affinityScore: affinity,
        });
      }
    }

    // 4. Order decisions by priority and affinity
    const priorityWeight: Record<RefreshDecision["priority"], number> = {
      CRITICAL: 4,
      HIGH: 3,
      NORMAL: 2,
      LOW: 1,
    };

    decisions.sort((a, b) => {
      const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (pDiff !== 0) return pDiff;
      return b.affinityScore - a.affinityScore;
    });

    const sourcesToCrawl = decisions.filter((d) => d.action === "CRAWL").map((d) => d.sourceName);
    const sourcesToSkip = decisions.filter((d) => d.action === "SKIP").map((d) => d.sourceName);

    const estimatedExecutionTimeMs = sourcesToCrawl.length * 800;

    return {
      targetCompany: input.companyName,
      sourcesToCrawl,
      sourcesToSkip,
      decisions,
      estimatedExecutionTimeMs,
      entitlementAllowed,
      quotaAllowed,
      rejectionReason,
    };
  }
}

export const intelligentRefreshPlanner = new IntelligentRefreshPlanner();
