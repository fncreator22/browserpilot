import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { sourceReliabilityManager } from "@/lib/discovery/execution/sourceReliabilityManager";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityEvent } from "@/lib/security/auditLog";
import { sanitizeSearchTelemetry } from "@/lib/ai/errors/searchFailureModel";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/search-telemetry
 * Admin-only telemetry endpoint providing aggregated search health, latency,
 * and source reliability metrics without exposing user PII, queries, or memories.
 */
export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization");
    const auth = await verifyAdminAccess(adminHeader);

    if (!auth.isAdmin) {
      recordSecurityEvent({
        type: "ADMIN_ACCESS_DENIED",
        path: "/api/admin/search-telemetry",
        details: { userEmail: auth.userEmail || "anonymous", reason: auth.error || "FORBIDDEN" },
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    // 1. Source Reliability Records (Circuit Breakers, Cooldowns, Failure Categories)
    const sourceHealth = sourceReliabilityManager.getAllHealthRecords();

    // 2. Aggregate Search Volume from Database
    let totalSearches = 0;
    let completedSearches = 0;
    let partialSearches = 0;

    try {
      if (prisma.search) {
        totalSearches = await prisma.search.count();
        completedSearches = await prisma.search.count({ where: { status: "COMPLETED" } });
        partialSearches = await prisma.search.count({ where: { status: "PARTIAL" } });
      }
    } catch {
      // Non-fatal if database in mock mode
    }

    const telemetryReport = {
      timestamp: new Date().toISOString(),
      adminEmail: auth.userEmail,
      searchMetrics: {
        totalSearches,
        completedSearches,
        partialSearches,
        successRate: totalSearches > 0 ? ((completedSearches + partialSearches) / totalSearches) * 100 : 100,
      },
      sources: sourceHealth.map((s) => ({
        sourceName: s.sourceName,
        status: s.status,
        consecutiveFailures: s.consecutiveFailures,
        consecutiveSuccesses: s.consecutiveSuccesses,
        lastFailureCategory: s.lastFailureCategory || null,
        lastFailureAt: s.lastFailureAt || null,
        cooldownUntil: s.cooldownUntil || null,
      })),
      privacyBoundaries: {
        piiExposed: false,
        userQueriesExposed: false,
        userMemoriesExposed: false,
      },
    };

    return NextResponse.json(sanitizeSearchTelemetry(telemetryReport));
  } catch (err: unknown) {
    console.error("[AdminTelemetry] Error:", err);
    return NextResponse.json(
      { error: "TELEMETRY_ERROR", message: "Failed to collect admin search telemetry." },
      { status: 500 }
    );
  }
}
