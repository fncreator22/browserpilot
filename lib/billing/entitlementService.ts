import { prisma } from "@/lib/db/prisma";
import { Plan, PlanCapability } from "@prisma/client";

/**
 * Mapping of capability keys to legacy boolean columns on the Plan model.
 * Used for graceful fallback when no explicit PlanCapability row exists.
 */
export const LEGACY_PLAN_CAPABILITY_MAP: Record<string, keyof Plan> = {
  COMPANY_TARGETING: "supportsCompanyTargeting",
  supportsCompanyTargeting: "supportsCompanyTargeting",
  ADVANCED_FILTERS: "supportsAdvancedFilters",
  supportsAdvancedFilters: "supportsAdvancedFilters",
  PUTER_PREMIUM: "supportsPuterPremium",
  supportsPuterPremium: "supportsPuterPremium",
  PRIORITY_EXECUTION: "supportsPriorityExecution",
  supportsPriorityExecution: "supportsPriorityExecution",
  PREMIUM_DEEP_REACH: "supportsCompanyTargeting",
  DEEP_REACH: "supportsCompanyTargeting",
};

export interface CapabilityEntitlementResult {
  allowed: boolean;
  reason?: string;
  planCode: string;
  capabilityKey: string;
  source: "EXPLICIT_ROW" | "LEGACY_COLUMN" | "DEFAULT_DENIED";
  limitValue?: number | null;
}

/**
 * Normalizes a capability key for consistent storage and lookups.
 */
export function normalizeCapabilityKey(key: string): string {
  return key.trim().toUpperCase().replace(/[-\s]+/g, "_");
}

/**
 * Evaluates whether a user has access to a specific capability according to the strict hierarchy:
 * 1. Check for an explicit PlanCapability row for the user's active plan + capabilityKey.
 *    If found, return its enabled value.
 * 2. If no explicit row exists AND capability corresponds to an existing hardcoded Plan boolean column,
 *    fall back to that column's value.
 * 3. If no explicit row exists AND there is no matching legacy column (genuinely new capability),
 *    strictly default to FALSE (denied).
 */
export async function checkCapabilityEntitlement(
  userId: string,
  capabilityKey: string
): Promise<CapabilityEntitlementResult> {
  const normKey = normalizeCapabilityKey(capabilityKey);

  // 1. Resolve effective plan
  const { getUserEffectivePlan } = await import("./planService");
  const effective = await getUserEffectivePlan(userId);
  const plan = effective.plan;
  const planCode = plan.code.toUpperCase();

  // Find DB Plan row to query relations
  const dbPlan = await prisma.plan.findUnique({
    where: { code: planCode },
    include: { capabilities: true },
  });

  if (!dbPlan) {
    return {
      allowed: false,
      reason: `Plan "${planCode}" not found in database.`,
      planCode,
      capabilityKey: normKey,
      source: "DEFAULT_DENIED",
    };
  }

  // 2a. Check explicit PlanCapability row
  const explicitRow = dbPlan.capabilities.find(
    (c) => normalizeCapabilityKey(c.capabilityKey) === normKey
  );

  if (explicitRow) {
    return {
      allowed: explicitRow.enabled,
      reason: explicitRow.enabled
        ? undefined
        : `Capability "${normKey}" is disabled for tier "${planCode}".`,
      planCode,
      capabilityKey: normKey,
      source: "EXPLICIT_ROW",
      limitValue: explicitRow.limitValue,
    };
  }

  // 2b. Check legacy Plan boolean columns fallback
  if (normKey === "DISCOVERY") {
    return {
      allowed: true,
      planCode,
      capabilityKey: normKey,
      source: "LEGACY_COLUMN",
    };
  }

  const legacyColName = LEGACY_PLAN_CAPABILITY_MAP[normKey] || LEGACY_PLAN_CAPABILITY_MAP[capabilityKey];
  if (legacyColName && legacyColName in dbPlan) {
    const legacyValue = Boolean((dbPlan as any)[legacyColName]);
    return {
      allowed: legacyValue,
      reason: legacyValue
        ? undefined
        : `Legacy feature "${legacyColName}" not granted on tier "${planCode}".`,
      planCode,
      capabilityKey: normKey,
      source: "LEGACY_COLUMN",
    };
  }

  // 2c. Genuinely new capability key never seen before -> STRICT DEFAULT FALSE (denied)
  return {
    allowed: false,
    reason: `New capability "${normKey}" is not configured or enabled for tier "${planCode}". Defaulting to denied.`,
    planCode,
    capabilityKey: normKey,
    source: "DEFAULT_DENIED",
  };
}

/**
 * Boolean wrapper for checkCapabilityEntitlement.
 */
export async function hasCapability(userId: string, capabilityKey: string): Promise<boolean> {
  const result = await checkCapabilityEntitlement(userId, capabilityKey);
  return result.allowed;
}

/**
 * Resolves a numeric capability limit for a user.
 * 1. Checks explicit PlanCapability row for user's plan.
 *    If explicit row exists and is enabled, returns limitValue (if defined).
 * 2. If explicit row exists but is disabled, returns 0 (disallowed).
 * 3. If no explicit row exists, provides deterministic defaults for standard numeric capabilities:
 *    - MAX_CONCURRENT_SEARCHES: FREE = 1, PREMIUM = 5, ENTERPRISE = 25
 * 4. Otherwise returns defaultValue or null.
 */
export async function getCapabilityLimit(
  userId: string,
  capabilityKey: string,
  defaultValue?: number
): Promise<number | null> {
  const normKey = normalizeCapabilityKey(capabilityKey);
  const entitlement = await checkCapabilityEntitlement(userId, normKey);

  if (!entitlement.allowed && entitlement.source === "EXPLICIT_ROW") {
    return 0;
  }

  if (typeof entitlement.limitValue === "number") {
    return entitlement.limitValue;
  }

  if (normKey === "MAX_CONCURRENT_SEARCHES") {
    const code = entitlement.planCode.toUpperCase();
    if (code === "ENTERPRISE") return 25;
    if (code === "PREMIUM") return 5;
    return 1; // FREE default
  }

  if (normKey === "MONTHLY_AI_OPERATIONS") {
    const code = entitlement.planCode.toUpperCase();
    if (code === "ENTERPRISE") return 50000;
    if (code === "PREMIUM") return 2500;
    if (code === "FREE") return 100;
    return 0; // Deny by default
  }

  if (normKey === "MAX_ACTIVE_WATCHES" || normKey === "MAX_WATCHES") {
    const code = entitlement.planCode.toUpperCase();
    if (code === "ENTERPRISE") return 500;
    if (code === "PREMIUM") return 25;
    if (code === "FREE") return 1;
    return 0; // Deny by default
  }

  return defaultValue ?? null;
}

/**
 * Retrieves all configured capabilities for a specific plan tier (by code, e.g. "FREE", "PREMIUM").
 */
export async function getPlanCapabilities(planCode: string): Promise<PlanCapability[]> {
  const cleanCode = planCode.toUpperCase().trim();
  const plan = await prisma.plan.findUnique({
    where: { code: cleanCode },
    include: { capabilities: true },
  });
  if (!plan) return [];
  return plan.capabilities;
}

/**
 * Creates or updates an explicit PlanCapability row for a plan tier.
 */
export async function setPlanCapability(
  planCode: string,
  capabilityKey: string,
  enabled: boolean,
  limitValue?: number | null,
  metadata: Record<string, any> = {}
): Promise<PlanCapability> {
  const cleanCode = planCode.toUpperCase().trim();
  const normKey = normalizeCapabilityKey(capabilityKey);

  const plan = await prisma.plan.findUnique({
    where: { code: cleanCode },
  });

  if (!plan) {
    throw new Error(`Plan tier with code "${cleanCode}" was not found.`);
  }

  return prisma.planCapability.upsert({
    where: {
      planId_capabilityKey: {
        planId: plan.id,
        capabilityKey: normKey,
      },
    },
    create: {
      planId: plan.id,
      capabilityKey: normKey,
      enabled,
      limitValue: limitValue ?? null,
      metadata: JSON.stringify(metadata),
    },
    update: {
      enabled,
      limitValue: limitValue !== undefined ? limitValue : undefined,
      metadata: Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : undefined,
    },
  });
}

/**
 * Seeds canonical PlanCapability rows for FREE, PREMIUM, and ENTERPRISE plans
 * mirroring their current behavior.
 */
export async function seedDefaultPlanCapabilities(): Promise<void> {
  const plans = await prisma.plan.findMany({
    include: { capabilities: true },
  });

  for (const plan of plans) {
    const code = plan.code.toUpperCase();
    const isPaid = code === "PREMIUM" || code === "ENTERPRISE";

    // 1. MAX_CONCURRENT_SEARCHES: FREE = 1, PREMIUM = 5, ENTERPRISE = 25
    const maxConcurrent = code === "ENTERPRISE" ? 25 : code === "PREMIUM" ? 5 : 1;

    // 2. PRIORITY_EXECUTION: FREE = false, PREMIUM = false, ENTERPRISE = true
    const priorityExecution = code === "ENTERPRISE";

    // 3. MONTHLY_AI_OPERATIONS: FREE = 100, PREMIUM = 2,500, ENTERPRISE = 50,000
    const maxMonthlyOps = code === "ENTERPRISE" ? 50000 : code === "PREMIUM" ? 2500 : 100;

    // 4. MAX_ACTIVE_WATCHES: FREE = 1, PREMIUM = 25, ENTERPRISE = 500
    const maxWatches = code === "ENTERPRISE" ? 500 : code === "PREMIUM" ? 25 : 1;

    const baselineCapabilities: Array<{ key: string; enabled: boolean; limitValue?: number | null }> = [
      { key: "COMPANY_TARGETING", enabled: plan.supportsCompanyTargeting },
      { key: "ADVANCED_FILTERS", enabled: plan.supportsAdvancedFilters },
      { key: "PUTER_PREMIUM", enabled: plan.supportsPuterPremium },
      { key: "PRIORITY_EXECUTION", enabled: priorityExecution },
      { key: "MAX_CONCURRENT_SEARCHES", enabled: true, limitValue: maxConcurrent },
      { key: "MONTHLY_AI_OPERATIONS", enabled: true, limitValue: maxMonthlyOps },
      { key: "MAX_ACTIVE_WATCHES", enabled: true, limitValue: maxWatches },
      // Proof capability: CSV_EXPORT (available on paid plans, disabled on free)
      { key: "CSV_EXPORT", enabled: isPaid, limitValue: isPaid ? 500 : 0 },
    ];

    for (const cap of baselineCapabilities) {
      await prisma.planCapability.upsert({
        where: {
          planId_capabilityKey: {
            planId: plan.id,
            capabilityKey: cap.key,
          },
        },
        create: {
          planId: plan.id,
          capabilityKey: cap.key,
          enabled: cap.enabled,
          limitValue: cap.limitValue ?? null,
        },
        update: {
          enabled: cap.enabled,
          limitValue: cap.limitValue !== undefined ? cap.limitValue : null,
        },
      });
    }
  }
}

/**
 * Calculates user's active billing period boundary and counts AIUsageEvents in that window.
 * Q1 Option C: Subscription billing cycle for paid users, calendar month for Free tier.
 */
export async function getUserPeriodAIUsage(userId: string): Promise<{
  used: number;
  periodStart: Date;
  periodEnd: Date;
  isPaidPlan: boolean;
}> {
  const activeSub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
    },
    orderBy: { currentPeriodStart: "desc" },
  });

  let periodStart: Date;
  let periodEnd: Date;
  const isPaidPlan = Boolean(activeSub && activeSub.currentPeriodStart);

  if (activeSub && activeSub.currentPeriodStart) {
    periodStart = activeSub.currentPeriodStart;
    periodEnd = activeSub.currentPeriodEnd || new Date(periodStart.getTime() + 30 * 86400 * 1000);
  } else {
    // Free tier: Calendar month (1st of current month to 1st of next month)
    const now = new Date();
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
  }

  const used = await prisma.aIUsageEvent.count({
    where: {
      userId,
      timestamp: { gte: periodStart },
    },
  });

  return { used, periodStart, periodEnd, isPaidPlan };
}

/**
 * Checks whether user has a custom BYOK key or connected Puter account.
 * Q5 Option A: BYOK bypasses platform MONTHLY_AI_OPERATIONS quota.
 */
export async function isUserByokOrPuter(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      geminiApiKey: true,
      providerConnections: {
        where: { status: "CONNECTED" },
        select: { provider: true },
      },
    },
  });

  if (!user) return false;
  if (user.geminiApiKey && user.geminiApiKey.trim().length > 0) return true;
  return user.providerConnections.some(
    (c) => c.provider === "PUTER" || c.provider.endsWith("_BYOK") || c.provider === "GEMINI"
  );
}

/**
 * Counts the user's currently active (enabled) autonomous discovery watches.
 */
export async function countUserActiveWatches(userId: string): Promise<number> {
  return await prisma.discoveryWatch.count({
    where: {
      userId,
      enabled: true,
    },
  });
}

