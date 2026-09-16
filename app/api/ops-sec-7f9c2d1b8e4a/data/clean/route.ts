import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminSwarmService } from "@/lib/admin/adminSwarmService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      recordSecurityEvent({
        type: "ADMIN_ACCESS_DENIED",
        path: request.nextUrl.pathname,
        details: { userEmail: auth.userEmail || "anonymous", action: "data_clean" },
      });
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { section = "all", dateFrom, dateTo, dryRun = false } = body;

    const result = await adminSwarmService.cleanData({
      section,
      dateFrom,
      dateTo,
      dryRun: Boolean(dryRun),
    });

    recordSecurityEvent({
      type: "ADMIN_ACTION",
      path: request.nextUrl.pathname,
      details: {
        userEmail: auth.userEmail,
        action: dryRun ? "CLEAN_DATA_DRY_RUN" : "CLEAN_DATA_PURGE",
        section,
        recordsAffected: result.recordsAffected,
      },
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ error: "DATA_CLEAN_ERROR", message: err.message }, { status: 500 });
  }
}
