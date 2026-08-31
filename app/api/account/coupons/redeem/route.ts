/**
 * §COUPON REDEMPTION REST API (TASK-033)
 * POST /api/account/coupons/redeem - Redeem a promotional coupon code
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { redeemCoupon } from "@/lib/billing/couponService";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { recordSecurityEvent } from "@/lib/security/auditLog";
import { z } from "zod";

const RedeemCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Coupon code too long"),
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

    const rl = await rateLimiter.check(`coupon_redeem_${userId}`, 10, 60);
    if (!rl.success) {
      recordSecurityEvent({
        type: "COUPON_ABUSE_DETECTED",
        userId,
        path: "/api/account/coupons/redeem",
        details: { action: "burst_coupon_attempt" },
      });
      return NextResponse.json(
        { error: "TOO_MANY_REQUESTS", message: "Too many coupon attempts. Please try again later." },
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

    const parseResult = RedeemCouponSchema.safeParse(body);
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

    const result = await redeemCoupon(userId, parseResult.data.code);

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[POST /api/account/coupons/redeem] Error:", err);
    return NextResponse.json(
      { error: "REDEMPTION_FAILED", message: (err as Error).message || "Failed to redeem coupon." },
      { status: 400 }
    );
  }
}
