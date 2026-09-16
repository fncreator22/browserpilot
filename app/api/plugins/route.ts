import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { pluginMarketplaceService } from "@/lib/plugins/pluginMarketplaceService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id || null;

    if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
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
