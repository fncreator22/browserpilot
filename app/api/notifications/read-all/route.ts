import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { markAllAlertsAsRead } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const count = await markAllAlertsAsRead(userId);

    return NextResponse.json({ success: true, markedReadCount: count });
  } catch (err: unknown) {
    console.error("[NotificationsAPI] Mark all read error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to mark all notifications as read." },
      { status: 500 }
    );
  }
}
