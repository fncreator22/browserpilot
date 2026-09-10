/**
 * §READ-ONLY COUPON VALIDATION REST API
 * POST /api/account/coupons/validate - Validate a coupon without consuming it
 * 
 * Verifies coupon existence, activation window, global redemption cap,
 * and single-use per account without mutating any records.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { validateCoupon } from "@/lib/billing/couponService";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { z } from "zod";

const ValidateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Coupon code is too long"),
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

    const rl = await rateLimiter.check(`coupon_validate_${userId}`, 20, 60);
    if (!rl.success) {
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS", message: "Too many coupon validation attempts. Please try again in a moment." },
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

    const parseResult = ValidateCouponSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid coupon code.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await validateCoupon(parseResult.data.code, userId);

    if (!result.valid) {
      const errorMessages: Record<string, string> = {
        COUPON_CODE_REQUIRED: "Coupon code is required.",
        COUPON_NOT_FOUND: "Coupon code does not exist or has expired.",
        COUPON_INACTIVE: "This coupon is currently inactive.",
        COUPON_NOT_YET_ACTIVE: "This coupon is not active yet.",
        COUPON_EXPIRED: "This coupon has expired.",
        COUPON_MAX_REDEMPTIONS_REACHED: "This coupon has reached its maximum global redemption limit.",
        COUPON_ALREADY_REDEEMED: "You have already redeemed this coupon on your account (1 use per user).",
      };

      return NextResponse.json(
        {
          valid: false,
          code: result.code,
          reason: result.reason || "COUPON_INVALID",
          message: errorMessages[result.reason || ""] || "This coupon cannot be applied.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      valid: true,
      code: result.code,
      discountType: result.discountType,
      discountValue: result.discountValue,
      targetPlanCode: result.targetPlanCode,
      validFrom: result.validFrom,
      validUntil: result.validUntil,
      description: result.description,
      message: "Coupon is valid and ready to be applied.",
    });
  } catch (err: unknown) {
    console.error("[POST /api/account/coupons/validate] Error:", err);
    return NextResponse.json(
      { error: "VALIDATION_ERROR", message: (err as Error).message || "Failed to validate coupon." },
      { status: 500 }
    );
  }
}
