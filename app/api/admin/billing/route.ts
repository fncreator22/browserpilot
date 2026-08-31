/**
 * §ADMIN BILLING & MONETIZATION REST API (TASK-033)
 * GET /api/admin/billing - Administrative monetization overview
 */

import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("x-admin-key") || req.headers.get("authorization");
    const auth = await verifyAdminAccess(authHeader);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin access required." },
        { status: 403 }
      );
    }

    const [
      totalUsers,
      allSubscriptions,
      allTransactions,
      allCoupons,
      allRedemptions,
      plans,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.subscription.findMany({ include: { plan: true } }),
      prisma.paymentTransaction.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.coupon.findMany({ include: { targetPlan: true } }),
      prisma.couponRedemption.count(),
      prisma.plan.findMany(),
    ]);

    // Subscriptions by plan & status
    const subscriptionsByPlan: Record<string, number> = {};
    const subscriptionsByStatus: Record<string, number> = {};
    let activePaidSubscribers = 0;

    for (const sub of allSubscriptions) {
      const planCode = sub.plan?.code || "UNKNOWN";
      subscriptionsByPlan[planCode] = (subscriptionsByPlan[planCode] || 0) + 1;
      subscriptionsByStatus[sub.status] = (subscriptionsByStatus[sub.status] || 0) + 1;
      if (sub.status === "ACTIVE" && planCode !== "FREE") {
        activePaidSubscribers++;
      }
    }

    // Transactions breakdown
    let totalRevenueUsd = 0;
    let successfulTransactionsCount = 0;
    let failedTransactionsCount = 0;

    for (const tx of allTransactions) {
      if (tx.status === "SUCCESS") {
        successfulTransactionsCount++;
        totalRevenueUsd += tx.amount;
      } else if (tx.status === "FAILED") {
        failedTransactionsCount++;
      }
    }

    return NextResponse.json({
      metrics: {
        totalUsers,
        activePaidSubscribers,
        totalRevenueUsd,
        subscriptionsByPlan,
        subscriptionsByStatus,
        transactions: {
          total: allTransactions.length,
          successful: successfulTransactionsCount,
          failed: failedTransactionsCount,
        },
        coupons: {
          totalCoupons: allCoupons.length,
          activeCoupons: allCoupons.filter((c) => c.active).length,
          totalRedemptions: allRedemptions,
        },
        plans: plans.map((p) => ({
          code: p.code,
          name: p.name,
          priceMonthly: p.priceMonthly,
          active: p.active,
        })),
        recentTransactions: allTransactions.slice(0, 15).map((t) => ({
          id: t.id,
          userId: t.userId,
          amount: t.amount,
          currency: t.currency,
          provider: t.provider,
          status: t.status,
          createdAt: t.createdAt,
        })),
      },
    });
  } catch (err: unknown) {
    console.error("[GET /api/admin/billing] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve billing metrics." },
      { status: 500 }
    );
  }
}
