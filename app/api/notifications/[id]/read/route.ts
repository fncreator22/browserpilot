import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { markAlertAsRead } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const alertId = params.id;

    if (!alertId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing notification ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const updated = await markAlertAsRead(alertId, userId);
    if (!updated) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Notification not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, alertId });
  } catch (err: unknown) {
    console.error("[NotificationsAPI] Mark read error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update notification." },
      { status: 500 }
    );
  }
}
