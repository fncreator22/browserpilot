import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import {
  getDiscoveryWatch,
  upsertDiscoveryWatch,
  getUserDiscoveryRuns,
  type DiscoveryWatchConfig,
} from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

/**
 * GET /api/discovery/watch
 * Retrieves the authenticated user's discovery watch configuration and recent runs.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to access discovery watch settings." },
        { status: 401 }
      );
    }

    const watch = await getDiscoveryWatch(userId);
    const recentRuns = await getUserDiscoveryRuns(userId, { limit: 5 });

    return NextResponse.json({
      watch,
      recentRuns,
    });
  } catch (err: unknown) {
    console.error("[DiscoveryWatchAPI] GET Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve discovery watch." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discovery/watch
 * Updates the authenticated user's discovery watch configuration.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to modify discovery watch settings." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<DiscoveryWatchConfig>;

    const updated = await upsertDiscoveryWatch(userId, {
      enabled: body.enabled,
      roles: body.roles,
      skills: body.skills,
      locations: body.locations,
      companies: body.companies,
      workModes: body.workModes,
      experienceLevels: body.experienceLevels,
      opportunityTypes: body.opportunityTypes,
      preferredSources: body.preferredSources,
      minimumMatchScore: body.minimumMatchScore,
      latestOnly: body.latestOnly,
      freshnessWindowHours: body.freshnessWindowHours,
      scanIntervalHours: body.scanIntervalHours,
    });

    return NextResponse.json({
      success: true,
      watch: updated,
    });
  } catch (err: unknown) {
    console.error("[DiscoveryWatchAPI] POST Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update discovery watch." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/discovery/watch
 * Partial update for discovery watch configuration.
 */
export async function PATCH(request: NextRequest) {
  return POST(request);
}

/**
 * DELETE /api/discovery/watch
 * Disables the user's discovery watch.
 */
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to modify discovery watch settings." },
        { status: 401 }
      );
    }

    const disabled = await upsertDiscoveryWatch(userId, { enabled: false });

    return NextResponse.json({
      success: true,
      message: "Discovery watch paused successfully.",
      watch: disabled,
    });
  } catch (err: unknown) {
    console.error("[DiscoveryWatchAPI] DELETE Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to disable discovery watch." },
      { status: 500 }
    );
  }
}
