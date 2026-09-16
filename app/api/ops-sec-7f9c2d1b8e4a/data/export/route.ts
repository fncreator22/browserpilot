import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminSwarmService, type ExportFormat } from "@/lib/admin/adminSwarmService";
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
        details: { userEmail: auth.userEmail || "anonymous", action: "data_export" },
      });
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const section = body.section || "opportunities";
    const format = (body.format?.toLowerCase() || "json") as ExportFormat;
    const dateFrom = body.dateFrom;
    const dateTo = body.dateTo;

    const exported = await adminSwarmService.exportData({
      section,
      format,
      dateFrom,
      dateTo,
    });

    recordSecurityEvent({
      type: "ADMIN_ACTION",
      path: request.nextUrl.pathname,
      details: {
        userEmail: auth.userEmail,
        action: "DATA_EXPORT",
        section,
        format,
        recordCount: exported.recordCount,
      },
    });

    // If client requested direct file download via download query/flag
    if (body.download || request.nextUrl.searchParams.get("download") === "true") {
      return new NextResponse(exported.content, {
        headers: {
          "Content-Type": exported.contentType,
          "Content-Disposition": `attachment; filename="${exported.filename}"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      filename: exported.filename,
      contentType: exported.contentType,
      recordCount: exported.recordCount,
      data: exported.content,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "DATA_EXPORT_ERROR", message: err.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Admin privileges required." }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const section = (searchParams.get("section") || "opportunities") as any;
    const format = (searchParams.get("format")?.toLowerCase() || "csv") as ExportFormat;
    const dateFrom = searchParams.get("dateFrom") || undefined;
    const dateTo = searchParams.get("dateTo") || undefined;

    const exported = await adminSwarmService.exportData({
      section,
      format,
      dateFrom,
      dateTo,
    });

    return new NextResponse(exported.content, {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "DATA_EXPORT_ERROR", message: err.message }, { status: 500 });
  }
}
