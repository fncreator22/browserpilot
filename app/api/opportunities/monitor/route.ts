import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { monitorSavedOpportunitiesForUser } from "@/lib/scraper/savedOpportunityMonitor";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to run saved opportunity monitoring." },
        { status: 401 }
      );
    }

    let force = false;
    let maxCandidates = 10;

    try {
      const body = await request.json();
      if (typeof body?.force === "boolean") force = body.force;
      if (typeof body?.maxCandidates === "number") maxCandidates = body.maxCandidates;
    } catch {
      // Body optional
    }

    const result = await monitorSavedOpportunitiesForUser(userId, {
      force,
      maxCandidates,
      candidateTimeoutMs: 2500,
    });

    return NextResponse.json({
      success: true,
      telemetry: result.telemetry,
      summaries: result.summaries,
    });
  } catch (err: unknown) {
    console.error("[SavedOpportunityMonitorAPI] Error running monitoring:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Unexpected error during saved opportunity monitoring." },
      { status: 500 }
    );
  }
}
