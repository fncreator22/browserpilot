/**
 * §PAYMENT CHECKOUT INTENT REST API (TASK-033)
 * POST /api/billing/checkout - Create a payment order intent for Razorpay / payment gateway
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { paymentGateway } from "@/lib/billing/paymentGateway";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { recordSecurityEvent } from "@/lib/security/auditLog";
import { prisma } from "@/lib/db/prisma";
import { validateCoupon, redeemCoupon, COUPON_ERROR_MESSAGES } from "@/lib/billing/couponService";
import { assignUserToPlan } from "@/lib/billing/planService";
import { z } from "zod";

const CheckoutSchema = z.object({
  planCode: z.enum(["PREMIUM", "ENTERPRISE"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  couponCode: z.string().optional(),
  provider: z.enum(["RAZORPAY", "STRIPE"]).optional().default("RAZORPAY"),
  paymentMethod: z.enum(["CARD", "UPI", "NETBANKING"]).optional().default("CARD"),
  upiVpa: z.string().optional(),
  returnUrl: z.string().optional(),
});

export async function POST(req: Request) {
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

    const rl = await rateLimiter.check(`checkout_${userId}`, 20, 60);
    if (!rl.success) {
      recordSecurityEvent({
        type: "RATE_LIMIT_EXCEEDED",
        userId,
        path: "/api/billing/checkout",
        details: { action: "burst_checkout_attempt" },
      });
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS", message: "Too many checkout requests. Please try again in a moment." },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = CheckoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid checkout data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({
      where: { code: parseResult.data.planCode },
    });

    if (!plan || !plan.active) {
      return NextResponse.json(
        { error: "PLAN_NOT_FOUND", message: "Selected plan is not available." },
        { status: 404 }
      );
    }

    const baseAmount = parseResult.data.billingInterval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

    // Apply plan-level discount percentage
    let planDiscountAmount = 0;
    const planDiscountPct = (plan as any).discountPercentage || 0;
    if (planDiscountPct > 0) {
      planDiscountAmount = Math.round(((baseAmount * planDiscountPct) / 100) * 100) / 100;
    }
    let discountedAmount = Math.max(0, baseAmount - planDiscountAmount);

    let appliedCouponInfo: any = null;
    const cleanCouponCode = parseResult.data.couponCode?.trim().toUpperCase();

    if (cleanCouponCode) {
      const validation = await validateCoupon(cleanCouponCode, userId);
      if (!validation.valid) {
        const msg = validation.reason && COUPON_ERROR_MESSAGES[validation.reason]
          ? COUPON_ERROR_MESSAGES[validation.reason]
          : "Invalid or expired coupon code.";
        return NextResponse.json(
          { error: "INVALID_COUPON", message: msg },
          { status: 400 }
        );
      }

      // Check plan restriction
      if (
        validation.targetPlanCode &&
        validation.targetPlanCode !== "ALL" &&
        validation.targetPlanCode !== plan.code
      ) {
        return NextResponse.json(
          {
            error: "COUPON_PLAN_MISMATCH",
            message: `Coupon ${cleanCouponCode} is only applicable to the ${validation.targetPlanCode} plan.`,
          },
          { status: 400 }
        );
      }

      let couponDiscountAmount = 0;
      if (validation.discountType === "PERCENTAGE") {
        couponDiscountAmount = Math.round(((discountedAmount * (validation.discountValue || 0)) / 100) * 100) / 100;
      } else if (validation.discountType === "FIXED_AMOUNT") {
        couponDiscountAmount = validation.discountValue || 0;
      } else if (validation.discountType === "PLAN_ACCESS") {
        couponDiscountAmount = discountedAmount;
      }

      discountedAmount = Math.max(0, Math.round((discountedAmount - couponDiscountAmount) * 100) / 100);
      appliedCouponInfo = {
        code: cleanCouponCode,
        discountType: validation.discountType,
        discountValue: validation.discountValue,
        discountAmount: couponDiscountAmount,
      };
    }

    // If final amount is 0 (100% discount, full access coupon, or 100% off plan):
    if (discountedAmount === 0) {
      if (cleanCouponCode) {
        await redeemCoupon(userId, cleanCouponCode);
      } else {
        await assignUserToPlan(userId, plan.code, {
          paymentProvider: "PROMO_DISCOUNT",
          billingInterval: parseResult.data.billingInterval,
          metadata: { planDiscountPct },
        });
      }

      return NextResponse.json({
        success: true,
        freeUpgrade: true,
        amount: 0,
        currency: plan.currency,
        plan: {
          code: plan.code,
          name: plan.name,
        },
        message: `Plan activated! Upgraded to ${plan.name} at 100% discount.`,
      });
    }

    // Otherwise create payment order
    const order = await paymentGateway.createOrder({
      userId,
      amount: discountedAmount,
      currency: plan.currency,
      planCode: plan.code,
      provider: parseResult.data.provider,
      paymentMethod: parseResult.data.paymentMethod,
      upiVpa: parseResult.data.upiVpa,
      returnUrl: parseResult.data.returnUrl,
    });

    return NextResponse.json({
      success: true,
      order,
      plan: {
        code: plan.code,
        name: plan.name,
      },
      pricing: {
        originalAmount: baseAmount,
        planDiscountPct,
        planDiscountAmount,
        appliedCoupon: appliedCouponInfo,
        finalAmount: discountedAmount,
        currency: plan.currency,
      },
    });
  } catch (err: unknown) {
    console.error("[POST /api/billing/checkout] Error:", err);
    return NextResponse.json(
      { error: "CHECKOUT_FAILED", message: (err as Error).message || "Failed to initialize payment checkout." },
      { status: 500 }
    );
  }
}
