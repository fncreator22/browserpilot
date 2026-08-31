/**
 * §ACCOUNT BILLING & SUBSCRIPTION REST API (TASK-033)
 * GET /api/account/billing - Returns effective plan, subscription, usage quota, and public plans
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserEffectivePlan, getAvailablePlans } from "@/lib/billing/planService";
import { getUserUsageQuotaReport } from "@/lib/billing/usagePolicyService";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const [{ plan, subscription, isPaid }, quota, availablePlans] = await Promise.all([
      getUserEffectivePlan(userId),
      getUserUsageQuotaReport(userId),
      getAvailablePlans(),
    ]);

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
      quota,
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
