/**
 * §ADMIN COUPON STATUS UPDATE REST API (TASK-033)
 * PATCH /api/admin/coupons/[id] - Enable or disable a coupon
 */

import { NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminToggleCoupon } from "@/lib/billing/couponService";
import { z } from "zod";

const PatchCouponSchema = z.object({
  active: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get("x-admin-key") || req.headers.get("authorization");
    const auth = await verifyAdminAccess(authHeader);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin access required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Coupon ID is required." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    const parseResult = PatchCouponSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", message: "Field 'active' (boolean) is required." },
        { status: 400 }
      );
    }

    const updated = await adminToggleCoupon(id, parseResult.data.active);

    return NextResponse.json({
      success: true,
      coupon: {
        id: updated.id,
        code: updated.code,
        active: updated.active,
      },
    });
  } catch (err: unknown) {
    console.error("[PATCH /api/admin/coupons/[id]] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message || "Failed updating coupon." },
      { status: 500 }
    );
  }
}
