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
        details: { userEmail: auth.userEmail || "anonymous", action: "data_import" },
      });
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { section = "opportunities", format = "json", content } = body;

    if (!content) {
      return NextResponse.json({ error: "MISSING_CONTENT", message: "Content is required for import." }, { status: 400 });
    }

    const result = await adminSwarmService.importData({
      section,
      format,
      content: typeof content === "string" ? content : JSON.stringify(content),
    });

    recordSecurityEvent({
      type: "ADMIN_ACTION",
      path: request.nextUrl.pathname,
      details: {
        userEmail: auth.userEmail,
        action: "DATA_IMPORT",
        section,
        importedCount: result.importedCount,
        errorCount: result.errors.length,
      },
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "DATA_IMPORT_ERROR", message: err.message }, { status: 500 });
  }
}
