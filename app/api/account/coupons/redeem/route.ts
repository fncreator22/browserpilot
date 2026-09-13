/**
 * §COUPON REDEMPTION REST API (TASK-033)
 * POST /api/account/coupons/redeem - Redeem a promotional coupon code
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { redeemCoupon, COUPON_ERROR_MESSAGES } from "@/lib/billing/couponService";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { recordSecurityEvent } from "@/lib/security/auditLog";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const RedeemCouponSchema = z.object({
  code: z.string().min(1, "Coupon code is required").max(50, "Coupon code too long"),
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

    // Resolve or sync active user in database to prevent foreign key errors on coupon_redemptions
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

    const rl = await rateLimiter.check(`coupon_redeem_${activeUserId}`, 10, 60);
    if (!rl.success) {
      recordSecurityEvent({
        type: "COUPON_ABUSE_DETECTED",
        userId: activeUserId,
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

    const result = await redeemCoupon(activeUserId, parseResult.data.code);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const rawMsg = (err as Error).message || "Failed to redeem coupon.";
    const friendlyMsg = COUPON_ERROR_MESSAGES[rawMsg] || rawMsg;
    console.error("[POST /api/account/coupons/redeem] Error:", rawMsg);
    return NextResponse.json(
      { error: "REDEMPTION_FAILED", message: friendlyMsg, rawError: rawMsg },
      { status: 400 }
    );
  }
}
