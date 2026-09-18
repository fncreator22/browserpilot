/**
 * §ACCOUNT BILLING & SUBSCRIPTION REST API (TASK-033)
 * GET /api/account/billing - Returns effective plan, subscription, usage quota, and public plans
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserEffectivePlan, getAvailablePlans } from "@/lib/billing/planService";
import { getUserUsageQuotaReport } from "@/lib/billing/usagePolicyService";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;

    if (!userId && !sessionUser?.email) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    let activeUserId = userId;
    let dbUser: any = null;

    if (sessionUser?.email) {
      dbUser = await prisma.user.findUnique({ where: { email: sessionUser.email.toLowerCase().trim() } });
      if (dbUser) {
        activeUserId = dbUser.id;
      }
    }

    if (!dbUser && userId) {
      dbUser = await prisma.user.findUnique({ where: { id: userId } });
      if (dbUser) {
        activeUserId = dbUser.id;
      }
    }

    if (!activeUserId) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account could not be found." },
        { status: 404 }
      );
    }

    const [{ plan, subscription, isPaid }, quota, availablePlans] = await Promise.all([
      getUserEffectivePlan(activeUserId),
      getUserUsageQuotaReport(activeUserId),
      getAvailablePlans(),
    ]);

    const { getPlanCapabilities } = await import("@/lib/billing/entitlementService");
    const { TIER_PRICES, SUPPORTED_CURRENCIES } = await import("@/lib/billing/currency");

    const rawCaps = await getPlanCapabilities(plan.code).catch(() => []);
    const capabilitiesMap: Record<string, boolean> = {
      COMPANY_TARGETING: plan.supportsCompanyTargeting,
      ADVANCED_FILTERS: plan.supportsAdvancedFilters,
      PUTER_PREMIUM: plan.supportsPuterPremium,
      PRIORITY_EXECUTION: plan.supportsPriorityExecution,
      CSV_EXPORT: isPaid,
      DIRECT_REACH: true,
      AI_DISCOVERY: true,
    };
    for (const cap of rawCaps) {
      capabilitiesMap[cap.capabilityKey.toUpperCase()] = cap.enabled;
    }

    // Resolve user currency preference (stored in profile or inferred from location)
    let userCurrency: "USD" | "INR" = (plan.currency?.toUpperCase() === "INR" ? "INR" : "USD");
    try {
      const userProfile = await prisma.userProfile.findUnique({
        where: { userId: activeUserId },
        select: { preferredLocations: true },
      });
      if (userProfile?.preferredLocations) {
        const locs = JSON.parse(userProfile.preferredLocations);
        if (Array.isArray(locs) && locs.some((l: string) => /india|bengaluru|bangalore|delhi|mumbai|hyderabad|pune|chennai|noida/i.test(l))) {
          userCurrency = "INR";
        }
      }
    } catch {}

    return NextResponse.json({
      plan,
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            paymentProvider: subscription.paymentProvider,
          }
        : null,
      isPaid,
      planTier: plan.code.toUpperCase(),
      capabilities: capabilitiesMap,
      currency: userCurrency,
      supportedCurrencies: SUPPORTED_CURRENCIES,
      tierPrices: TIER_PRICES,
      quota,
      usage: {
        activeWatches: (quota as any).activeWatches?.used ?? (typeof (quota as any).activeWatches === "number" ? (quota as any).activeWatches : 0),
        todayDiscoveries: (quota as any).dailyDiscoveries?.used ?? (typeof (quota as any).dailyDiscoveries === "number" ? (quota as any).dailyDiscoveries : 0),
        monthlyAIOperations: (quota as any).monthlyAIOperations?.used ?? (typeof (quota as any).monthlyAIOperations === "number" ? (quota as any).monthlyAIOperations : 0),
      },
      availablePlans,
    });
  } catch (err: unknown) {
    console.error("[GET /api/account/billing] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve billing information." },
      { status: 500 }
    );
  }
}
