import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { checkRedisHealth } from "@/lib/queue/redis";

export const dynamic = "force-dynamic";

/**
 * GET /api/health
 * Production health and readiness probe for AWS ALB, Vercel uptime monitoring, and Kubernetes probes.
 */
export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, { status: "HEALTHY" | "DEGRADED" | "UNHEALTHY"; latencyMs?: number; details?: string }> = {};

  let isDatabaseHealthy = false;

  // 1. Database Connectivity Probe (Turso Cloud / SQLite)
  const dbStart = Date.now();
  try {
    const jobCount = await prisma.job.count();
    checks.database = {
      status: "HEALTHY",
      latencyMs: Date.now() - dbStart,
      details: `Connected (${jobCount} registered tasks)`,
    };
    isDatabaseHealthy = true;
  } catch (err: unknown) {
    checks.database = {
      status: "UNHEALTHY",
      latencyMs: Date.now() - dbStart,
      details: (err as Error).message || "Database connection failed",
    };
  }

  // 2. Redis Connectivity Probe (BullMQ / PubSub)
  if (process.env.REDIS_URL) {
    const redisStart = Date.now();
    try {
      const redisStatus = await checkRedisHealth();
      checks.redis = {
        status: redisStatus.connected ? "HEALTHY" : "DEGRADED",
        latencyMs: Date.now() - redisStart,
        details: redisStatus.connected ? "Connected" : redisStatus.error || "Disconnected",
      };
    } catch {
      checks.redis = {
        status: "DEGRADED",
        latencyMs: Date.now() - redisStart,
        details: "Redis probe failed, using in-memory bus",
      };
    }
  } else {
    checks.redis = {
      status: "HEALTHY",
      details: "In-memory event bus (standalone mode)",
    };
  }

  // 3. Artifact Storage Backend Status
  const hasBlobStorage = !!process.env.BLOB_READ_WRITE_TOKEN;
  checks.storage = {
    status: "HEALTHY",
    details: hasBlobStorage ? "Vercel Blob CDN" : "Local Filesystem Storage",
  };

  // 4. AI Engine Configuration Guard
  const hasGeminiKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  checks.aiEngine = {
    status: hasGeminiKey ? "HEALTHY" : "DEGRADED",
    details: hasGeminiKey ? "Gemini 3.6/3.7 API configured" : "BYOK mode (user profile keys required)",
  };

  // 5. Browser Pool Capability
  const hasRemoteBrowser = !!(process.env.BROWSER_WS_ENDPOINT || process.env.PLAYWRIGHT_WS_ENDPOINT);
  checks.browserPool = {
    status: "HEALTHY",
    details: hasRemoteBrowser ? "Remote WebSocket Browser Pool" : "Local / Serverless Hybrid Engine",
  };

  const totalLatencyMs = Date.now() - startTime;
  const overallStatus = isDatabaseHealthy ? "HEALTHY" : "UNHEALTHY";

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      version: "0.1.0",
      environment: process.env.NODE_ENV || "development",
      checks,
    },
    {
      status: isDatabaseHealthy ? 200 : 503,
    }
  );
}
