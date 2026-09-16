import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminSwarmService } from "@/lib/admin/adminSwarmService";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const status = await adminSwarmService.getSwarmStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err: any) {
    return NextResponse.json({ error: "INTERNAL_ERROR", message: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      recordSecurityEvent({
        type: "ADMIN_ACCESS_DENIED",
        path: request.nextUrl.pathname,
        details: { userEmail: auth.userEmail || "anonymous", action: "swarm_control" },
      });
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action?.toUpperCase();

    if (action === "STOP_ALL" || action === "HALT") {
      const result = await adminSwarmService.stopAllSwarms();
      recordSecurityEvent({
        type: "ADMIN_ACTION",
        path: request.nextUrl.pathname,
        details: { userEmail: auth.userEmail, action: "STOP_ALL_SWARMS", stoppedExecutions: result.stoppedExecutionsCount },
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "START_ALL" || action === "RESUME") {
      const result = await adminSwarmService.startAllSwarms();
      recordSecurityEvent({
        type: "ADMIN_ACTION",
        path: request.nextUrl.pathname,
        details: { userEmail: auth.userEmail, action: "START_ALL_SWARMS" },
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      { error: "INVALID_ACTION", message: "Action must be 'STOP_ALL' or 'START_ALL'." },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: "SWARM_CONTROL_ERROR", message: err.message }, { status: 500 });
  }
}
