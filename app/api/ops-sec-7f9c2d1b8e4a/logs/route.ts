import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { UniversalAuditLogger, AuditActor, AuditActionType } from "@/lib/audit/universalAuditLogger";

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
        { error: "FORBIDDEN", message: "Admin privileges required to view audit logs." },
        { status: 403 }
      );
    }

    const { searchParams } = request.nextUrl;
    const actor = searchParams.get("actor") || undefined;
    const actionType = searchParams.get("actionType") || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const queryResult = UniversalAuditLogger.query({
      actor,
      actionType,
      search,
      limit,
      offset,
    });

    const stats = UniversalAuditLogger.getStats();

    return NextResponse.json({
      success: true,
      logs: queryResult.events,
      total: queryResult.total,
      hasMore: queryResult.hasMore,
      stats,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Support single event or batch events
    if (Array.isArray(body.events)) {
      const count = UniversalAuditLogger.logBatch(body.events);
      return NextResponse.json({ success: true, ingested: count });
    }

    const actor: AuditActor = body.actor || "USER";
    const actionType: AuditActionType = body.actionType || "CLICK";
    const target: string = body.target || "Interactive Element";
    const path: string = body.path || "/";
    const details = body.details || {};
    const userId = body.userId || null;
    const userEmail = body.userEmail || null;
    const userAgent = request.headers.get("user-agent") || null;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || null;

    const logged = UniversalAuditLogger.log({
      actor,
      actionType,
      target,
      path,
      details,
      userId,
      userEmail,
      ip,
      userAgent,
    });

    return NextResponse.json({ success: true, event: logged });
  } catch (err: any) {
    return NextResponse.json(
      { error: "LOG_INGESTION_FAILED", message: err.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const adminHeader =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization") ||
      request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required to prune audit logs." },
        { status: 403 }
      );
    }

    UniversalAuditLogger.prune();
    return NextResponse.json({ success: true, message: "Audit logs successfully pruned." });
  } catch (err: any) {
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: err.message },
      { status: 500 }
    );
  }
}
