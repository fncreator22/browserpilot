/**
 * §ADMIN COUPONS REST API (TASK-033)
 * GET /api/admin/coupons - List all coupons with redemption metrics
 * POST /api/admin/coupons - Create a new promotional coupon
 */

import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminListCoupons, adminCreateCoupon } from "@/lib/billing/couponService";
import { z } from "zod";

const AdminCreateCouponSchema = z.object({
  code: z.string().min(3).max(50),
  description: z.string().max(200).optional(),
  discountType: z.enum(["PERCENTAGE", "FIXED_AMOUNT", "PLAN_ACCESS"]),
  discountValue: z.number().min(0),
  targetPlanCode: z.string().optional(),
  maxRedemptions: z.number().int().min(0).default(100),
  validUntilDays: z.number().int().min(1).optional(),
  active: z.boolean().default(true),
});

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

    const coupons = await adminListCoupons();

    return NextResponse.json({
      coupons: coupons.map((c) => ({
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        targetPlanCode: c.targetPlan?.code || null,
        maxRedemptions: c.maxRedemptions,
        redemptionCount: c.redemptionCount,
        validFrom: c.validFrom,
        validUntil: c.validUntil,
        active: c.active,
        createdAt: c.createdAt,
      })),
    });
  } catch (err: unknown) {
    console.error("[GET /api/admin/coupons] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to list coupons." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("x-admin-key") || req.headers.get("authorization");
    const auth = await verifyAdminAccess(authHeader);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin access required." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = AdminCreateCouponSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid coupon data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const coupon = await adminCreateCoupon(parseResult.data, auth.userEmail);

    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        targetPlanCode: coupon.targetPlan?.code || null,
        active: coupon.active,
      },
    });
  } catch (err: unknown) {
    console.error("[POST /api/admin/coupons] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message || "Failed to create coupon." },
      { status: 500 }
    );
  }
}
