import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminControlPlaneService } from "@/lib/admin/adminService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const userId = searchParams.get("userId") || undefined;
    const status = searchParams.get("status") || undefined;

    const data = await adminControlPlaneService.listDiscoveryRuns({ page, limit, userId, status });

    return NextResponse.json({
      success: true,
      role: auth.role,
      ...data,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "RUNS_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
