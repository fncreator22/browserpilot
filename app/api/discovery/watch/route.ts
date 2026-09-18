import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import {
  getDiscoveryWatch,
  getUserDiscoveryWatches,
  createDiscoveryWatch,
  upsertDiscoveryWatch,
  getUserDiscoveryRuns,
  type DiscoveryWatchConfig,
} from "@/lib/db/opportunities";
import {
  getCapabilityLimit,
  countUserActiveWatches,
} from "@/lib/billing/entitlementService";

export const dynamic = "force-dynamic";

/**
 * Resolves user identity from NextAuth session with test harness fallback.
 */
async function resolveAuthUserId(request?: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions).catch(() => null);
  const sessionUserId = (session?.user as { id?: string })?.id;
  if (sessionUserId) return sessionUserId;

  if (
    process.env.IS_TEST_HARNESS === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
  ) {
    return (
      request?.headers.get("x-user-id") ||
      request?.headers.get("x-test-user-id") ||
      null
    );
  }

  return null;
}

/**
 * GET /api/discovery/watch
 * Retrieves the authenticated user's discovery watch configuration(s) and recent runs.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveAuthUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to access discovery watch settings." },
        { status: 401 }
      );
    }

    const watch = await getDiscoveryWatch(userId);
    const watches = await getUserDiscoveryWatches(userId);
    const recentRuns = await getUserDiscoveryRuns(userId, { limit: 5 });
    const activeCount = await countUserActiveWatches(userId);
    const maxWatches = (await getCapabilityLimit(userId, "MAX_ACTIVE_WATCHES")) ?? 1;

    return NextResponse.json({
      watch,
      watches,
      recentRuns,
      activeCount,
      maxWatches,
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
 * Creates or updates an authenticated user's discovery watch configuration.
 * Gated by PlanCapability: MAX_ACTIVE_WATCHES (FREE = 1, PREMIUM = 25, ENTERPRISE = 500).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveAuthUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to modify discovery watch settings." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as Partial<DiscoveryWatchConfig> & {
      watchId?: string;
      isNew?: boolean;
    };

    // Sanitize locations: "Remote" is a work mode, not a geographic location
    if (body.locations && Array.isArray(body.locations)) {
      const hasRemote = body.locations.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(String(l).trim()));
      body.locations = body.locations.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(String(l).trim()));
      if (hasRemote) {
        const wModes = Array.isArray(body.workModes) ? [...body.workModes] : [];
        if (!wModes.includes("REMOTE")) {
          wModes.push("REMOTE");
        }
        body.workModes = wModes;
      }
    }

    const targetWatchId = body.id || body.watchId;
    const isEnabling = body.enabled === true;
    const maxWatches = (await getCapabilityLimit(userId, "MAX_ACTIVE_WATCHES")) ?? 1;
    const activeCount = await countUserActiveWatches(userId);

    let isNewWatch = body.isNew === true;
    if (body.enabled === undefined && isNewWatch) {
      body.enabled = false;
    }

    if (targetWatchId) {
      const existing = await prisma.discoveryWatch.findFirst({
        where: { id: targetWatchId, userId },
      });
      if (existing) {
        // If re-enabling a previously disabled watch, check whether it would exceed quota
        if (!existing.enabled && isEnabling && activeCount >= maxWatches) {
          return NextResponse.json(
            {
              error: "QUOTA_EXCEEDED",
              code: "ACTIVE_WATCH_LIMIT_EXCEEDED",
              message: `You have reached your limit of ${maxWatches} active autonomous watch${maxWatches > 1 ? "es" : ""}. Please upgrade your plan to activate more watches.`,
              currentUsage: activeCount,
              limit: maxWatches,
              upgradeUrl: "/app/plans",
            },
            { status: 429 }
          );
        }
      } else {
        isNewWatch = true;
      }
    } else if (!isNewWatch) {
      // No target ID provided and not explicitly a new watch: resolve existing primary watch if any
      const existing = await prisma.discoveryWatch.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        body.id = existing.id;
        if (!existing.enabled && isEnabling && activeCount >= maxWatches) {
          return NextResponse.json(
            {
              error: "QUOTA_EXCEEDED",
              code: "ACTIVE_WATCH_LIMIT_EXCEEDED",
              message: `You have reached your limit of ${maxWatches} active autonomous watch${maxWatches > 1 ? "es" : ""}. Please upgrade your plan to activate more watches.`,
              currentUsage: activeCount,
              limit: maxWatches,
              upgradeUrl: "/app/plans",
            },
            { status: 429 }
          );
        }
      } else {
        isNewWatch = true;
      }
    }

    // Gated check when creating a new active watch
    if (isNewWatch && isEnabling) {
      if (activeCount >= maxWatches) {
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            code: "ACTIVE_WATCH_LIMIT_EXCEEDED",
            message: `You have reached your limit of ${maxWatches} active autonomous watch${maxWatches > 1 ? "es" : ""}. Please upgrade your plan to create more watches.`,
            currentUsage: activeCount,
            limit: maxWatches,
            upgradeUrl: "/app/plans",
          },
          { status: 429 }
        );
      }
    }

    const watchResult = isNewWatch
      ? await createDiscoveryWatch(userId, body)
      : await upsertDiscoveryWatch(userId, body);

    // If watch was disabled, ensure state is accurately set without leaking orphaned enabled rows
    if (body.enabled === false) {
      if (body.id) {
        await prisma.discoveryWatch.updateMany({
          where: { id: body.id, userId },
          data: { enabled: false },
        }).catch(() => {});
      } else {
        await prisma.discoveryWatch.updateMany({
          where: { userId },
          data: { enabled: false },
        }).catch(() => {});
      }
      watchResult.enabled = false;
    }

    return NextResponse.json(
      {
        success: true,
        watch: watchResult,
      },
      { status: isNewWatch ? 201 : 200 }
    );
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
 * Disables or removes a discovery watch.
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await resolveAuthUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to modify discovery watch settings." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const watchId = url.searchParams.get("watchId") || url.searchParams.get("id");

    if (watchId) {
      await prisma.discoveryWatch.deleteMany({
        where: { id: watchId, userId },
      });
      return NextResponse.json({
        success: true,
        message: "Discovery watch deleted successfully.",
      });
    }

    // Default fallback: disable all watches for user
    await prisma.discoveryWatch.updateMany({
      where: { userId },
      data: { enabled: false },
    });
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
