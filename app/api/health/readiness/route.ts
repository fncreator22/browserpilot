/**
 * §READINESS HEALTH PROBE (TASK-035)
 * GET /api/health/readiness
 * 
 * Verifies that the application and critical backing dependencies (Database)
 * are ready to accept customer traffic from load balancers.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  let dbHealthy = false;
  let dbLatencyMs = 0;
  let errorMessage: string | null = null;

  try {
    const t0 = Date.now();
    // Fast lightweight readiness ping
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
    dbHealthy = true;
  } catch (err: unknown) {
    dbHealthy = false;
    errorMessage = (err as Error).message || "Database connection query failed";
  }

  const totalLatencyMs = Date.now() - startTime;

  if (!dbHealthy) {
    return NextResponse.json(
      {
        status: "NOT_READY",
        timestamp: new Date().toISOString(),
        latencyMs: totalLatencyMs,
        dependencies: {
          database: {
            status: "UNHEALTHY",
            error: errorMessage,
          },
        },
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  }

  return NextResponse.json(
    {
      status: "READY",
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      dependencies: {
        database: {
          status: "HEALTHY",
          latencyMs: dbLatencyMs,
        },
      },
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
