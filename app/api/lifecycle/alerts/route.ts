import { NextRequest } from "next/server";
import { GET as notificationsGET, POST as notificationsPOST } from "@/app/api/notifications/route";

export const dynamic = "force-dynamic";

/**
 * Backward-compatible alias route: /api/lifecycle/alerts -> /api/notifications
 */
export async function GET(request: NextRequest) {
  return notificationsGET(request);
}

export async function POST(request: NextRequest) {
  return notificationsPOST(request);
}
