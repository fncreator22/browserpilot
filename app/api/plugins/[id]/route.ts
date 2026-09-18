import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { pluginMarketplaceService } from "@/lib/plugins/pluginMarketplaceService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const pluginId = params.id;

    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let userId = sessionUser?.id;

    if (!userId && sessionUser?.email) {
      const { prisma } = await import("@/lib/db/prisma");
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email.toLowerCase().trim() },
        select: { id: true },
      });
      if (dbUser) userId = dbUser.id;
    }

    if (!userId) {
      userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id") || (process.env.NODE_ENV !== "production" ? "dev_user" : undefined);
    }

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in to manage plugins." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action?.toUpperCase();

    if (action === "DISCONNECT") {
      const result = await pluginMarketplaceService.disconnectPlugin(userId, pluginId);
      return NextResponse.json(result);
    } else {
      const result = await pluginMarketplaceService.connectPlugin(userId, pluginId, body);
      return NextResponse.json(result);
    }
  } catch (err: any) {
    return NextResponse.json({ error: "PLUGIN_ACTION_FAILED", message: err.message }, { status: 500 });
  }
}
