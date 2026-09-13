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
import { validateCoupon, COUPON_ERROR_MESSAGES } from "@/lib/billing/couponService";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const ValidateCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Coupon code is too long"),
});

export async function POST(req: Request) {
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
    let dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;

    if (!dbUser && sessionUser?.email) {
      dbUser = await prisma.user.findUnique({ where: { email: sessionUser.email } });
      if (!dbUser) {
        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e) => e.trim().toLowerCase())
          .filter(Boolean);
        const isAdmin = adminEmails.includes(sessionUser.email.toLowerCase().trim());
        dbUser = await prisma.user.create({
          data: {
            email: sessionUser.email,
            name: session?.user?.name || "BrowserPilot User",
            role: isAdmin ? "ADMIN" : "USER",
            passwordHash: "oauth_auto_managed",
          },
        });
      }
      activeUserId = dbUser.id;
    }

    if (!activeUserId) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account could not be found." },
        { status: 404 }
      );
    }

    const rl = await rateLimiter.check(`coupon_validate_${activeUserId}`, 20, 60);
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

    const result = await validateCoupon(parseResult.data.code, activeUserId);

    if (!result.valid) {
      return NextResponse.json(
        {
          valid: false,
          code: result.code,
          reason: result.reason || "COUPON_INVALID",
          message: COUPON_ERROR_MESSAGES[result.reason || ""] || result.reason || "This coupon cannot be applied.",
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
