import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminControlPlaneService } from "@/lib/admin/adminService";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "User ID parameter is required." },
        { status: 400 }
      );
    }

    const userDetail = await adminControlPlaneService.getAdminUserDetail(id);

    return NextResponse.json({
      success: true,
      role: auth.role,
      user: userDetail,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    const isNotFound = msg.includes("was not found");
    return NextResponse.json(
      { error: isNotFound ? "USER_NOT_FOUND" : "USER_DETAIL_ERROR", message: msg },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
