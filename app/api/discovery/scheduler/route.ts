/**
 * §PRODUCTION AUTONOMOUS DISCOVERY SCHEDULER API (TASK-016)
 * 
 * Endpoints:
 * - POST /api/discovery/scheduler: Authenticated trigger for production schedulers (EventBridge, Vercel Cron, etc.)
 * - GET  /api/discovery/scheduler: Authenticated health and telemetry observability inspection
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { discoveryScheduler } from "@/lib/scraper/discoveryScheduler";
import { getDueDiscoveryWatches } from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Helper to verify cron / admin authorization from incoming headers.
 */
async function authorizeSchedulerRequest(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET || process.env.ADMIN_SECRET_KEY;
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const adminHeader = request.headers.get("x-admin-key");

  // Check Bearer Token or x-cron-secret header
  if (cronSecret) {
    if (cronHeader && cronHeader.trim() === cronSecret.trim()) {
      return true;
    }
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (token === cronSecret.trim()) {
        return true;
      }
    }
  }

  // Check Admin API key / session fallback
  const adminAuth = await verifyAdminAccess(adminHeader);
  return adminAuth.isAdmin;
}

/**
 * GET /api/discovery/scheduler
 * Observability & Health Inspection Endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const isAuthorized = await authorizeSchedulerRequest(request);
    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Scheduler health inspection requires valid cron secret or administrator credentials.",
        },
        { status: 401 }
      );
    }

    const now = new Date();
    const staleCutoff = new Date(now.getTime() - 120000);

    const [totalWatches, enabledWatches, dueWatches, activeLeases, recentRuns] = await Promise.all([
      prisma.discoveryWatch.count(),
      prisma.discoveryWatch.count({ where: { enabled: true } }),
      getDueDiscoveryWatches(100),
      prisma.discoveryWatch.count({
        where: {
          lockedAt: { gt: staleCutoff },
        },
      }),
      prisma.discoveryRun.findMany({
        orderBy: { startedAt: "desc" },
        take: 5,
        select: {
          id: true,
          triggerType: true,
          status: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          newOpportunities: true,
          newSources: true,
          notificationsCreated: true,
          errorMessage: true,
        },
      }),
    ]);

    return NextResponse.json({
      status: "HEALTHY",
      systemTime: now.toISOString(),
      metrics: {
        totalWatches,
        enabledWatches,
        dueWatchesCount: dueWatches.length,
        activeLeasesCount: activeLeases,
      },
      recentRuns,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || "Failed to inspect scheduler health";
    return NextResponse.json(
      {
        error: "HEALTH_CHECK_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/discovery/scheduler
 * Production Execution Trigger Endpoint
 */
export async function POST(request: NextRequest) {
  try {
    const isAuthorized = await authorizeSchedulerRequest(request);
    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Internal scheduler execution requires valid cron secret or administrator credentials.",
        },
        { status: 401 }
      );
    }

    // Parse optional query / body overrides
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body is optional
    }

    const maxWatches = typeof body.maxWatches === "number" ? Math.min(body.maxWatches, 50) : 10;
    const concurrencyLimit = typeof body.concurrencyLimit === "number" ? Math.min(body.concurrencyLimit, 4) : 2;
    const maxExecutionBudgetMs = typeof body.maxExecutionBudgetMs === "number" ? body.maxExecutionBudgetMs : 30000;

    // Execute Autonomous Discovery Scheduler
    const telemetry = await discoveryScheduler.runScheduledDiscovery({
      maxWatchesToProcess: maxWatches,
      concurrencyLimit,
      maxExecutionBudgetMs,
    });

    return NextResponse.json({
      success: true,
      telemetry,
    });
  } catch (err: unknown) {
    const message = (err as Error).message || "Scheduler trigger failed";
    return NextResponse.json(
      {
        error: "SCHEDULER_FAILED",
        message,
      },
      { status: 500 }
    );
  }
}
