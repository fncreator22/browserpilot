import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserLifecycleAlerts, getUnreadAlertCount, recordLifecycleAlert } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to view notifications." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const [alerts, unreadCount] = await Promise.all([
      getUserLifecycleAlerts(userId, { unreadOnly, limit }),
      getUnreadAlertCount(userId),
    ]);

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: alerts,
    });
  } catch (err: unknown) {
    console.error("[NotificationsAPI] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve notifications." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to record notifications." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { title, message, companyName = "BrowserPilot", transitionType = "SYSTEM_NOTICE", opportunityId } = body;

    const result = await recordLifecycleAlert({
      userId,
      opportunityId: opportunityId || null,
      transitionType: transitionType || "SYSTEM_NOTICE",
      previousStatus: "INFO",
      newStatus: "ACTIVE",
      title: title || "Notification",
      companyName: companyName || "BrowserPilot",
      message: message || "",
      idempotencyKey: `${userId}_notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    });

    return NextResponse.json({
      success: true,
      alert: result.alert,
    });
  } catch (err: unknown) {
    console.error("[NotificationsAPI] POST error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to record notification." },
      { status: 500 }
    );
  }
}
