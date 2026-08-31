/**
 * §LIVENESS HEALTH PROBE (TASK-035)
 * GET /api/health/liveness
 * 
 * High-speed process liveness check for container orchestrators (AWS ECS, Docker, K8s).
 * Validates that the Node.js event loop is responsive without querying external dependencies.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const processStartTime = Date.now();

export async function GET() {
  const uptimeSeconds = Math.floor((Date.now() - processStartTime) / 1000);

  return NextResponse.json(
    {
      status: "LIVE",
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
