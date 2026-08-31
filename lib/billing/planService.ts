/**
 * §PLAN & SUBSCRIPTION MANAGEMENT SERVICE (TASK-033)
 * 
 * Provides server-authoritative plan resolution, default seeding,
 * and subscription lifecycle state management.
 */

import { prisma } from "@/lib/db/prisma";

export interface PlanFeatureConfig {
  id: string;
  code: "FREE" | "PREMIUM" | "ENTERPRISE" | string;
  name: string;
  description: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxWatches: number;
  maxDailyDiscoveries: number;
  maxMonthlyAIOperations: number;
  allowedIntervals: string[];
  supportsCompanyTargeting: boolean;
  supportsAdvancedFilters: boolean;
  supportsPuterPremium: boolean;
  supportsPriorityExecution: boolean;
  active: boolean;
}

export const DEFAULT_PLANS: Array<Omit<PlanFeatureConfig, "id">> = [
  {
    code: "FREE",
    name: "Starter / Community",
    description: "Essential AI autonomous job discovery with standard monitoring intervals.",
    priceMonthly: 0.0,
    priceYearly: 0.0,
    currency: "USD",
    maxWatches: 1,
    maxDailyDiscoveries: 10,
    maxMonthlyAIOperations: 100,
    allowedIntervals: ["TWENTY_FOUR_HOURS"],
    supportsCompanyTargeting: false,
    supportsAdvancedFilters: false,
    supportsPuterPremium: false,
    supportsPriorityExecution: false,
    active: true,
  },
  {
    code: "PREMIUM",
    name: "BrowserPilot Pro Hunter",
    description: "High-frequency 2h/4h/6h scans, unlimited watches, company targeting, and premium AI models.",
    priceMonthly: 19.0,
    priceYearly: 190.0,
    currency: "USD",
    maxWatches: 25,
    maxDailyDiscoveries: 100,
    maxMonthlyAIOperations: 2500,
    allowedIntervals: ["TWO_HOURS", "FOUR_HOURS", "SIX_HOURS", "TWELVE_HOURS", "TWENTY_FOUR_HOURS"],
    supportsCompanyTargeting: true,
    supportsAdvancedFilters: true,
    supportsPuterPremium: true,
    supportsPriorityExecution: true,
    active: true,
  },
  {
    code: "ENTERPRISE",
    name: "Enterprise Fleet",
    description: "Custom swarm orchestration, unlimited AI throughput, dedicated recruiter workflows.",
    priceMonthly: 99.0,
    priceYearly: 990.0,
    currency: "USD",
    maxWatches: 500,
    maxDailyDiscoveries: 1000,
    maxMonthlyAIOperations: 50000,
    allowedIntervals: ["TWO_HOURS", "FOUR_HOURS", "SIX_HOURS", "TWELVE_HOURS", "TWENTY_FOUR_HOURS"],
    supportsCompanyTargeting: true,
    supportsAdvancedFilters: true,
    supportsPuterPremium: true,
    supportsPriorityExecution: true,
    active: true,
  },
];

/**
 * Ensures default canonical plans exist in the database.
 */
export async function ensureDefaultPlans(): Promise<void> {
  for (const p of DEFAULT_PLANS) {
    const existing = await prisma.plan.findUnique({
      where: { code: p.code },
    });

    if (!existing) {
      await prisma.plan.create({
        data: {
          code: p.code,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          currency: p.currency,
          maxWatches: p.maxWatches,
          maxDailyDiscoveries: p.maxDailyDiscoveries,
          maxMonthlyAIOperations: p.maxMonthlyAIOperations,
          allowedIntervals: JSON.stringify(p.allowedIntervals),
          supportsCompanyTargeting: p.supportsCompanyTargeting,
          supportsAdvancedFilters: p.supportsAdvancedFilters,
          supportsPuterPremium: p.supportsPuterPremium,
          supportsPriorityExecution: p.supportsPriorityExecution,
          active: p.active,
        },
      });
    }
  }
}

/**
 * Formats a Prisma Plan record into typed PlanFeatureConfig.
 */
export function formatPlanRecord(record: any): PlanFeatureConfig {
  let intervals = ["TWENTY_FOUR_HOURS"];
  try {
    intervals = JSON.parse(record.allowedIntervals || "[]");
  } catch {}

  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    priceMonthly: record.priceMonthly,
    priceYearly: record.priceYearly,
    currency: record.currency,
    maxWatches: record.maxWatches,
    maxDailyDiscoveries: record.maxDailyDiscoveries,
    maxMonthlyAIOperations: record.maxMonthlyAIOperations,
    allowedIntervals: intervals,
    supportsCompanyTargeting: Boolean(record.supportsCompanyTargeting),
    supportsAdvancedFilters: Boolean(record.supportsAdvancedFilters),
    supportsPuterPremium: Boolean(record.supportsPuterPremium),
    supportsPriorityExecution: Boolean(record.supportsPriorityExecution),
    active: Boolean(record.active),
  };
}

/**
 * Returns all active plans available for subscription.
 */
export async function getAvailablePlans(): Promise<PlanFeatureConfig[]> {
  await ensureDefaultPlans();
  const plans = await prisma.plan.findMany({
    where: { active: true },
    orderBy: { priceMonthly: "asc" },
  });

  return plans.map(formatPlanRecord);
}

/**
 * Returns a user's active subscription if one exists.
 */
export async function getUserSubscription(userId: string) {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Resolves the server-authoritative effective plan for a user.
 * Existing users without subscriptions gracefully receive the FREE plan.
 */
export async function getUserEffectivePlan(userId: string): Promise<{
  plan: PlanFeatureConfig;
  subscription: any | null;
  isPaid: boolean;
}> {
  await ensureDefaultPlans();

  const sub = await getUserSubscription(userId);

  if (sub && sub.plan) {
    // Check expiration if currentPeriodEnd is set
    if (sub.currentPeriodEnd && new Date() > new Date(sub.currentPeriodEnd)) {
      // Mark as expired in background
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: "EXPIRED" },
      }).catch(() => {});
    } else {
      return {
        plan: formatPlanRecord(sub.plan),
        subscription: sub,
        isPaid: sub.plan.code !== "FREE",
      };
    }
  }

  // Default fallback to FREE plan
  const freePlan = await prisma.plan.findUnique({
    where: { code: "FREE" },
  });

  if (freePlan) {
    return {
      plan: formatPlanRecord(freePlan),
      subscription: null,
      isPaid: false,
    };
  }

  // Absolute fallback in case DB is unseeded
  return {
    plan: {
      id: "fallback-free",
      ...DEFAULT_PLANS[0],
    },
    subscription: null,
    isPaid: false,
  };
}

/**
 * Upgrades or assigns a user to a specific plan (e.g. on payment or coupon redemption).
 */
export async function assignUserToPlan(
  userId: string,
  planCode: string,
  options: {
    paymentProvider?: string;
    billingInterval?: "MONTHLY" | "YEARLY" | "LIFETIME";
    durationDays?: number;
    providerSubscriptionId?: string;
    providerCustomerId?: string;
    metadata?: Record<string, unknown>;
  } = {},
  db: any = prisma
) {
  const targetPlan = await db.plan.findUnique({
    where: { code: planCode },
  });

  if (!targetPlan) {
    throw new Error(`INVALID_PLAN_CODE: Plan with code "${planCode}" does not exist.`);
  }

  const now = new Date();
  let periodEnd: Date | null = null;

  if (options.durationDays && options.durationDays > 0) {
    periodEnd = new Date(now.getTime() + options.durationDays * 24 * 60 * 60 * 1000);
  } else if (options.billingInterval === "YEARLY") {
    periodEnd = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  } else if (options.billingInterval === "MONTHLY" || !options.billingInterval) {
    periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  }

  // Deactivate any previous active subscriptions for this user
  await db.subscription.updateMany({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: now,
    },
  });

  // Create new active subscription
  return db.subscription.create({
    data: {
      userId,
      planId: targetPlan.id,
      status: "ACTIVE",
      billingInterval: options.billingInterval || "MONTHLY",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      paymentProvider: options.paymentProvider || "MANUAL_PROMO",
      providerSubscriptionId: options.providerSubscriptionId || null,
      providerCustomerId: options.providerCustomerId || null,
      metadata: JSON.stringify(options.metadata || {}),
    },
    include: { plan: true },
  });
}
