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
    let userId = (session?.user as { id?: string })?.id;

    if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
      userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id") || "dev_user";
    }

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED", message: "Please sign in to connect plugins." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await pluginMarketplaceService.connectPlugin(userId, pluginId, body);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: "CONNECT_FAILED", message: err.message }, { status: 500 });
  }
}
