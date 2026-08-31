import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminControlPlaneService } from "@/lib/admin/adminService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader);

    if (!auth.isAdmin) {
      recordSecurityEvent({
        type: "ADMIN_ACCESS_DENIED",
        path: "/api/admin/metrics",
        details: { userEmail: auth.userEmail || "anonymous", reason: auth.error || "FORBIDDEN" },
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const metrics = await adminControlPlaneService.getOverviewMetrics();

    return NextResponse.json({
      success: true,
      role: auth.role,
      userEmail: auth.userEmail,
      ...metrics,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "METRICS_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
