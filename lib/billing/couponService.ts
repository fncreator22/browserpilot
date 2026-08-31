/**
 * §COUPON & PROMOTION SERVICE (TASK-033)
 * 
 * Provides server-authoritative, concurrency-safe coupon validation,
 * redemption, and administrative lifecycle management.
 */

import { prisma } from "@/lib/db/prisma";
import { assignUserToPlan } from "./planService";

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  reason?: string;
  discountType?: "PERCENTAGE" | "FIXED_AMOUNT" | "PLAN_ACCESS" | string;
  discountValue?: number;
  targetPlanCode?: string | null;
  couponId?: string;
}

export interface CreateCouponInput {
  code: string;
  description?: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "PLAN_ACCESS";
  discountValue: number;
  targetPlanCode?: string;
  maxRedemptions?: number;
  validUntilDays?: number;
  active?: boolean;
}

/**
 * Normalizes coupon codes to trimmed uppercase.
 */
export function normalizeCouponCode(code: string): string {
  return (code || "").trim().toUpperCase();
}

/**
 * Validates a coupon code server-side for a specific user.
 */
export async function validateCoupon(
  code: string,
  userId: string
): Promise<CouponValidationResult> {
  const cleanCode = normalizeCouponCode(code);
  if (!cleanCode) {
    return { valid: false, code: cleanCode, reason: "COUPON_CODE_REQUIRED" };
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: cleanCode },
    include: { targetPlan: true },
  });

  if (!coupon) {
    return { valid: false, code: cleanCode, reason: "COUPON_NOT_FOUND" };
  }

  if (!coupon.active) {
    return { valid: false, code: cleanCode, reason: "COUPON_INACTIVE" };
  }

  const now = new Date();
  if (coupon.validUntil && now > coupon.validUntil) {
    return { valid: false, code: cleanCode, reason: "COUPON_EXPIRED" };
  }

  if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
    return { valid: false, code: cleanCode, reason: "COUPON_MAX_REDEMPTIONS_REACHED" };
  }

  // Check if user has already redeemed this single-use coupon
  const priorRedemption = await prisma.couponRedemption.findUnique({
    where: {
      couponId_userId: {
        couponId: coupon.id,
        userId,
      },
    },
  });

  if (priorRedemption) {
    return { valid: false, code: cleanCode, reason: "COUPON_ALREADY_REDEEMED" };
  }

  return {
    valid: true,
    code: cleanCode,
    couponId: coupon.id,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue,
    targetPlanCode: coupon.targetPlan?.code || null,
  };
}

/**
 * Redeems a coupon for a user transactionally, updating counts and provisioning access.
 */
export async function redeemCoupon(
  userId: string,
  code: string
): Promise<{ success: boolean; message: string; planCode?: string; discountGranted?: number }> {
  const validation = await validateCoupon(code, userId);
  if (!validation.valid || !validation.couponId) {
    throw new Error(validation.reason || "COUPON_INVALID");
  }

  return prisma.$transaction(async (tx) => {
    // 1. Re-check coupon inside transaction for concurrency safety
    const coupon = await tx.coupon.findUnique({
      where: { id: validation.couponId },
      include: { targetPlan: true },
    });

    if (!coupon || !coupon.active) {
      throw new Error("COUPON_INACTIVE");
    }

    if (coupon.maxRedemptions > 0 && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new Error("COUPON_MAX_REDEMPTIONS_REACHED");
    }

    // 2. Increment redemption count
    await tx.coupon.update({
      where: { id: coupon.id },
      data: {
        redemptionCount: { increment: 1 },
      },
    });

    // 3. Create redemption record
    await tx.couponRedemption.create({
      data: {
        couponId: coupon.id,
        userId,
        discountGranted: coupon.discountValue,
        metadata: JSON.stringify({
          discountType: coupon.discountType,
          targetPlan: coupon.targetPlan?.code || null,
        }),
      },
    });

    // 4. If PLAN_ACCESS (e.g. 100% off Premium), provision subscription
    if (coupon.discountType === "PLAN_ACCESS" || coupon.discountValue >= 100) {
      const targetPlanCode = coupon.targetPlan?.code || "PREMIUM";
      await assignUserToPlan(userId, targetPlanCode, {
        paymentProvider: "COUPON",
        metadata: { couponCode: coupon.code },
      }, tx);

      return {
        success: true,
        message: `Coupon applied successfully! Upgraded to ${targetPlanCode} plan.`,
        planCode: targetPlanCode,
        discountGranted: coupon.discountValue,
      };
    }

    return {
      success: true,
      message: `Coupon ${coupon.code} redeemed successfully (${coupon.discountValue}% discount applied).`,
      discountGranted: coupon.discountValue,
    };
  });
}

/**
 * Admin: Creates a new coupon code.
 */
export async function adminCreateCoupon(
  input: CreateCouponInput,
  adminUserId?: string
) {
  const cleanCode = normalizeCouponCode(input.code);
  if (!cleanCode || cleanCode.length < 3) {
    throw new Error("INVALID_COUPON_CODE: Code must be at least 3 characters long.");
  }

  let targetPlanId: string | null = null;
  if (input.targetPlanCode) {
    const plan = await prisma.plan.findUnique({
      where: { code: input.targetPlanCode },
    });
    if (plan) targetPlanId = plan.id;
  }

  let validUntil: Date | null = null;
  if (input.validUntilDays && input.validUntilDays > 0) {
    validUntil = new Date(Date.now() + input.validUntilDays * 24 * 60 * 60 * 1000);
  }

  return prisma.coupon.create({
    data: {
      code: cleanCode,
      description: input.description || null,
      discountType: input.discountType,
      discountValue: input.discountValue,
      targetPlanId,
      maxRedemptions: input.maxRedemptions ?? 100,
      validUntil,
      active: input.active !== false,
      createdById: adminUserId || null,
    },
    include: { targetPlan: true },
  });
}

/**
 * Admin: Lists all coupons with redemption statistics.
 */
export async function adminListCoupons() {
  return prisma.coupon.findMany({
    include: {
      targetPlan: true,
      _count: {
        select: { redemptions: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Admin: Toggles coupon active status.
 */
export async function adminToggleCoupon(couponId: string, active: boolean) {
  return prisma.coupon.update({
    where: { id: couponId },
    data: { active },
  });
}
