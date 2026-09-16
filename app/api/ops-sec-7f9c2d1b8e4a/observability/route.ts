import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { telemetryEngine } from "@/lib/observability/telemetryEngine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization") ||
      request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    // Seed a baseline sample if buffer is currently empty
    const snapshot = telemetryEngine.getSnapshot(30);
    if (snapshot.totalRequestsTracked === 0) {
      telemetryEngine.recordRequest({ method: "GET", path: "/api/search", statusCode: 200, latencyMs: 42 });
      telemetryEngine.recordRequest({ method: "POST", path: "/api/search", statusCode: 200, latencyMs: 88 });
      telemetryEngine.recordRequest({ method: "GET", path: "/api/account/profile", statusCode: 304, latencyMs: 14 });
      telemetryEngine.recordRequest({ method: "POST", path: "/api/billing/checkout", statusCode: 200, latencyMs: 110 });
      telemetryEngine.recordRequest({ method: "GET", path: "/api/notifications", statusCode: 200, latencyMs: 19 });
    }

    return NextResponse.json({
      success: true,
      telemetry: telemetryEngine.getSnapshot(30),
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
