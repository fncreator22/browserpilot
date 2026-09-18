import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { pluginMarketplaceService } from "@/lib/plugins/pluginMarketplaceService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let userId = sessionUser?.id || null;

    if (!userId && sessionUser?.email) {
      const { prisma } = await import("@/lib/db/prisma");
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email.toLowerCase().trim() },
        select: { id: true },
      });
      if (dbUser) userId = dbUser.id;
    }

    if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id") || "dev_user";
    }

    const plugins = await pluginMarketplaceService.listPlugins(userId);

    return NextResponse.json({
      success: true,
      plugins,
    });
  } catch (err: any) {
    return NextResponse.json({ error: "FAILED_TO_FETCH_PLUGINS", message: err.message }, { status: 500 });
  }
}
