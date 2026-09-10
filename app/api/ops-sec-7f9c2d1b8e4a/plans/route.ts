import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminControlPlaneService } from "@/lib/admin/adminService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

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

    const plans = await adminControlPlaneService.getAdminPlansWithLimits();

    return NextResponse.json({
      success: true,
      role: auth.role,
      plans,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "PLANS_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      planCode,
      dailyTokenLimit,
      priceMonthly,
      priceYearly,
      description,
      features,
      maxWatches,
      maxDailyDiscoveries,
    } = body;

    if (!planCode || typeof planCode !== "string") {
      return NextResponse.json(
        { error: "VALIDATION_FAILED", message: "planCode (string) is required." },
        { status: 400 }
      );
    }

    const updatedPlan = await adminControlPlaneService.updatePlanConfig(planCode, {
      dailyTokenLimit: typeof dailyTokenLimit === "number" ? dailyTokenLimit : undefined,
      priceMonthly: typeof priceMonthly === "number" ? priceMonthly : undefined,
      priceYearly: typeof priceYearly === "number" ? priceYearly : undefined,
      description: typeof description === "string" ? description : undefined,
      features: Array.isArray(features) ? features : undefined,
      maxWatches: typeof maxWatches === "number" ? maxWatches : undefined,
      maxDailyDiscoveries: typeof maxDailyDiscoveries === "number" ? maxDailyDiscoveries : undefined,
    });

    recordSecurityEvent({
      type: "ADMIN_CONFIG_CHANGE",
      path: request.nextUrl.pathname,
      details: {
        action: "UPDATE_PLAN_CONFIGURATION",
        planCode,
        dailyTokenLimit,
        priceMonthly,
        priceYearly,
        adminUser: auth.userEmail || "SUPERADMIN_KEY",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Updated plan configuration for "${planCode}".`,
      plan: {
        code: updatedPlan.code,
        name: updatedPlan.name,
        priceMonthly: updatedPlan.priceMonthly,
        priceYearly: updatedPlan.priceYearly,
        description: updatedPlan.description,
        metadata: updatedPlan.metadata,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "PLAN_UPDATE_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
