/**
 * §USAGE POLICY & LIMIT ENFORCEMENT SERVICE (TASK-033)
 * 
 * Enforces server-authoritative usage limits based on the user's effective plan:
 * - Daily Discoveries Quota
 * - Monthly AI Operations Quota
 * - Active Discovery Watches Quota
 * - Company Targeting Entitlement
 * - Scan Interval Entitlement
 */

import { prisma } from "@/lib/db/prisma";
import { getUserEffectivePlan, PlanFeatureConfig } from "./planService";

export interface UserUsageQuotaReport {
  userId: string;
  plan: PlanFeatureConfig;
  dailyDiscoveries: {
    used: number;
    limit: number;
    remaining: number;
    isExceeded: boolean;
  };
  monthlyAIOperations: {
    used: number;
    limit: number;
    remaining: number;
    isExceeded: boolean;
  };
  activeWatches: {
    used: number;
    limit: number;
    remaining: number;
    isExceeded: boolean;
  };
  supportsCompanyTargeting: boolean;
  supportsAdvancedFilters: boolean;
}

/**
 * Returns a comprehensive usage and quota report for a user.
 */
export async function getUserUsageQuotaReport(userId: string): Promise<UserUsageQuotaReport> {
  const { plan } = await getUserEffectivePlan(userId);

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [dailySearchesCount, monthlyAiEventsCount, activeWatchesCount] = await Promise.all([
    prisma.search.count({
      where: {
        userId,
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.aIUsageEvent.count({
      where: {
        userId,
        timestamp: { gte: startOfMonth },
      },
    }),
    prisma.discoveryWatch.count({
      where: {
        userId,
        enabled: true,
      },
    }),
  ]);

  return {
    userId,
    plan,
    dailyDiscoveries: {
      used: dailySearchesCount,
      limit: plan.maxDailyDiscoveries,
      remaining: Math.max(0, plan.maxDailyDiscoveries - dailySearchesCount),
      isExceeded: dailySearchesCount >= plan.maxDailyDiscoveries,
    },
    monthlyAIOperations: {
      used: monthlyAiEventsCount,
      limit: plan.maxMonthlyAIOperations,
      remaining: Math.max(0, plan.maxMonthlyAIOperations - monthlyAiEventsCount),
      isExceeded: monthlyAiEventsCount >= plan.maxMonthlyAIOperations,
    },
    activeWatches: {
      used: activeWatchesCount,
      limit: plan.maxWatches,
      remaining: Math.max(0, plan.maxWatches - activeWatchesCount),
      isExceeded: activeWatchesCount >= plan.maxWatches,
    },
    supportsCompanyTargeting: plan.supportsCompanyTargeting,
    supportsAdvancedFilters: plan.supportsAdvancedFilters,
  };
}

/**
 * Validates whether an operation is allowed under the user's plan and current usage.
 */
export async function evaluateUsageLimit(
  userId: string,
  operation: "DISCOVERY_SEARCH" | "AI_OPERATION" | "CREATE_WATCH" | "COMPANY_TARGETING" | "SCAN_INTERVAL",
  context?: { requestedInterval?: string; companyCount?: number }
): Promise<{ allowed: boolean; reason?: string; code?: string }> {
  const quota = await getUserUsageQuotaReport(userId);

  switch (operation) {
    case "DISCOVERY_SEARCH":
      if (quota.dailyDiscoveries.isExceeded) {
        return {
          allowed: false,
          code: "DAILY_DISCOVERY_LIMIT_REACHED",
          reason: `You have reached your daily discovery limit of ${quota.plan.maxDailyDiscoveries} on the ${quota.plan.name} plan. Upgrade to Premium for higher limits.`,
        };
      }
      return { allowed: true };

    case "AI_OPERATION":
      if (quota.monthlyAIOperations.isExceeded) {
        return {
          allowed: false,
          code: "MONTHLY_AI_LIMIT_REACHED",
          reason: `You have reached your monthly AI operation limit of ${quota.plan.maxMonthlyAIOperations} on the ${quota.plan.name} plan.`,
        };
      }
      return { allowed: true };

    case "CREATE_WATCH":
      if (quota.activeWatches.isExceeded) {
        return {
          allowed: false,
          code: "ACTIVE_WATCH_LIMIT_REACHED",
          reason: `You have reached your maximum active watch limit of ${quota.plan.maxWatches} on the ${quota.plan.name} plan.`,
        };
      }
      return { allowed: true };

    case "COMPANY_TARGETING":
      if (!quota.supportsCompanyTargeting && context?.companyCount && context.companyCount > 0) {
        return {
          allowed: false,
          code: "COMPANY_TARGETING_REQUIRES_PREMIUM",
          reason: "Targeting specific companies in autonomous watches is a Premium feature.",
        };
      }
      return { allowed: true };

    case "SCAN_INTERVAL":
      if (context?.requestedInterval && !quota.plan.allowedIntervals.includes(context.requestedInterval)) {
        return {
          allowed: false,
          code: "SCAN_INTERVAL_REQUIRES_PREMIUM",
          reason: `The scan interval "${context.requestedInterval}" is not available on the ${quota.plan.name} plan.`,
        };
      }
      return { allowed: true };

    default:
      return { allowed: true };
  }
}
