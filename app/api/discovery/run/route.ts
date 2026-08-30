import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { autonomousDiscoveryEngine } from "@/lib/scraper/autonomousDiscovery";

export const dynamic = "force-dynamic";

/**
 * POST /api/discovery/run
 * Manually triggers an autonomous discovery cycle for the authenticated user.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to trigger an autonomous discovery scan." },
        { status: 401 }
      );
    }

    const result = await autonomousDiscoveryEngine.runAutonomousDiscoveryForUser(userId, {
      forceScan: true,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("[DiscoveryRunAPI] Execution Error:", err);
    return NextResponse.json(
      { error: "EXECUTION_ERROR", message: (err as Error).message || "Discovery scan failed." },
      { status: 500 }
    );
  }
}
