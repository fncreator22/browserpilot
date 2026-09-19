import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    // 1. Total subscribers and status distribution
    const [
      totalSubscriptions,
      activeSubscriptions,
      subscriptionsByStatus,
      subscriptionsByPlan,
      subscriptionsByProvider,
      totalCoupons,
      couponRedemptions,
      successfulTransactions,
      allTransactions
    ] = await Promise.all([
      prisma.subscription.count(),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.subscription.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      prisma.subscription.groupBy({
        by: ["planId"],
        _count: { id: true },
      }),
      prisma.subscription.groupBy({
        by: ["paymentProvider"],
        _count: { id: true },
      }),
      prisma.coupon.count(),
      prisma.couponRedemption.findMany({
        take: 50,
        orderBy: { redeemedAt: "desc" },
        include: {
          coupon: {
            select: {
              code: true,
              discountType: true,
              discountValue: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.paymentTransaction.findMany({
        where: { status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      prisma.paymentTransaction.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
    ]);

    // Fetch plan metadata to resolve plan names & codes
    const plans = await prisma.plan.findMany();
    const planMap = new Map(plans.map((p) => [p.id, p]));

    // Calculate revenue metrics from successful transactions
    const totalRevenue = successfulTransactions.reduce((acc, tx) => acc + (tx.amount || 0), 0);
    const currency = successfulTransactions[0]?.currency || "USD";

    // Direct vs Coupon breakdown
    // Direct: paymentProvider in [RAZORPAY, STRIPE, MANUAL, MANUAL_ADMIN] or has successful payment transaction
    // Coupon: paymentProvider === "COUPON" or discountType === "PLAN_ACCESS"
    let directPaymentCount = 0;
    let couponPaymentCount = 0;
    let manualCompCount = 0;

    for (const group of subscriptionsByProvider) {
      const provider = (group.paymentProvider || "DIRECT").toUpperCase();
      const count = group._count.id;
      if (provider.includes("COUPON") || provider.includes("PROMO")) {
        couponPaymentCount += count;
      } else if (provider.includes("MANUAL") || provider.includes("COMP")) {
        manualCompCount += count;
      } else {
        directPaymentCount += count;
      }
    }

    // If subscriptions didn't have explicit paymentProvider set, check transactions vs redemptions
    const uniquePayingUsers = new Set(successfulTransactions.map((tx) => tx.userId)).size;
    const uniqueCouponUsers = new Set(couponRedemptions.map((r) => r.userId)).size;

    // Plan tier breakdown with plan name and codes
    const planBreakdown = subscriptionsByPlan.map((item) => {
      const plan = planMap.get(item.planId);
      return {
        planId: item.planId,
        planCode: plan?.code || "UNKNOWN",
        planName: plan?.name || "Unknown Plan",
        priceMonthly: plan?.priceMonthly || 0,
        priceYearly: plan?.priceYearly || 0,
        activeCount: item._count.id,
      };
    });

    // Calculate Average Revenue Per Paying User (ARPU)
    const arpu = uniquePayingUsers > 0 ? totalRevenue / uniquePayingUsers : 0;

    return NextResponse.json({
      success: true,
      role: auth.role,
      analytics: {
        summary: {
          totalSubscriptions,
          activeSubscriptions,
          uniquePayingUsers,
          uniqueCouponUsers,
          directPaymentCount: Math.max(directPaymentCount, uniquePayingUsers),
          couponPaymentCount: Math.max(couponPaymentCount, uniqueCouponUsers),
          manualCompCount,
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          currency,
          arpu: Math.round(arpu * 100) / 100,
          totalCouponsActive: totalCoupons,
          totalRedemptions: couponRedemptions.length,
        },
        breakdowns: {
          byStatus: subscriptionsByStatus.map((s) => ({ status: s.status, count: s._count.id })),
          byPlan: planBreakdown,
          byProvider: subscriptionsByProvider.map((p) => ({
            provider: p.paymentProvider || "DIRECT",
            count: p._count.id,
          })),
        },
        recentTransactions: allTransactions.map((tx) => ({
          id: tx.id,
          userId: tx.userId,
          userEmail: tx.user?.email || "unknown@user",
          userName: tx.user?.name || "Customer",
          amount: tx.amount,
          currency: tx.currency,
          provider: tx.provider,
          status: tx.status,
          createdAt: tx.createdAt,
        })),
        recentRedemptions: couponRedemptions.map((r) => ({
          id: r.id,
          userId: r.userId,
          userEmail: r.user?.email || "unknown@user",
          couponCode: r.coupon?.code || "DISCOUNT",
          discountType: r.coupon?.discountType || "PERCENTAGE",
          discountValue: r.coupon?.discountValue || 0,
          discountGranted: r.discountGranted,
          redeemedAt: r.redeemedAt,
        })),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SUBSCRIPTION_ANALYTICS_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
