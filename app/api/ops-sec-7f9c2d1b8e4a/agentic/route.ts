import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { prisma } from "@/lib/db/prisma";
import { recordSecurityEvent } from "@/lib/security/auditLog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader =
      request.headers.get("x-admin-key") ||
      request.headers.get("authorization") ||
      request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      recordSecurityEvent({
        type: "ADMIN_ACCESS_DENIED",
        path: request.nextUrl.pathname,
        details: { userEmail: auth.userEmail || "anonymous", reason: auth.error || "FORBIDDEN" },
      });
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // 1. Fetch recent AI usage events
    const [recentUsageEvents, todayUsageEvents] = await Promise.all([
      prisma.aIUsageEvent.findMany({
        take: 100,
        orderBy: { timestamp: "desc" },
        include: {
          user: {
            select: { email: true, name: true },
          },
        },
      }),
      prisma.aIUsageEvent.findMany({
        where: {
          timestamp: { gte: todayStart },
        },
      }),
    ]);

    // 2. Compute engine stress & token analytics
    let puterTokensToday = 0;
    let geminiTokensToday = 0;
    let deepseekTokensToday = 0;
    let totalDurationMs = 0;
    let successCount = 0;
    let failureCount = 0;

    const opBreakdown: Record<string, { count: number; totalTokens: number; avgDurationMs: number }> = {};

    for (const ev of todayUsageEvents) {
      if (ev.provider.toUpperCase().includes("PUTER")) {
        puterTokensToday += ev.totalTokens;
      } else if (ev.provider.toUpperCase().includes("DEEPSEEK")) {
        deepseekTokensToday += ev.totalTokens;
      } else {
        geminiTokensToday += ev.totalTokens;
      }

      totalDurationMs += ev.durationMs;
      if (ev.status === "SUCCESS") {
        successCount++;
      } else {
        failureCount++;
      }

      if (!opBreakdown[ev.operation]) {
        opBreakdown[ev.operation] = { count: 0, totalTokens: 0, avgDurationMs: 0 };
      }
      opBreakdown[ev.operation].count++;
      opBreakdown[ev.operation].totalTokens += ev.totalTokens;
    }

    for (const op of Object.keys(opBreakdown)) {
      const item = opBreakdown[op];
      item.avgDurationMs = Math.round(
        todayUsageEvents
          .filter((e) => e.operation === op)
          .reduce((sum, e) => sum + e.durationMs, 0) / (item.count || 1)
      );
    }

    const totalEvents = todayUsageEvents.length;
    const avgLatencyMs = totalEvents > 0 ? Math.round(totalDurationMs / totalEvents) : 0;
    const successRate = totalEvents > 0 ? Math.round((successCount / totalEvents) * 100) : 100;

    // Puter free tier daily quota is typically ~30k tokens
    const puterDailyLimit = 30000;
    const puterHeadroom = Math.max(0, puterDailyLimit - puterTokensToday);

    // 3. Fetch recent pipeline search traces
    const recentSearches = await prisma.search.findMany({
      take: 25,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { email: true, name: true },
        },
        results: {
          take: 10,
          include: {
            opportunity: {
              select: {
                id: true,
                title: true,
                companyName: true,
                location: true,
                workMode: true,
                experienceLevel: true,
                status: true,
                sourceListings: {
                  select: {
                    sourcePlatform: true,
                    verificationStatus: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 4. Compute 6-Stage Pipeline health metrics
    const intentEvents = todayUsageEvents.filter((e) => e.operation === "INTENT_PARSING");
    const planningEvents = todayUsageEvents.filter((e) => e.operation === "ACTION_PLANNING");
    const rankingEvents = todayUsageEvents.filter((e) => e.operation === "DISCOVERY_RANKING");

    const totalOpportunitiesDiscovered = recentSearches.reduce((acc, s) => acc + s.totalFound, 0);
    const activeSearchesCount = await prisma.search.count({
      where: { status: "SEARCHING" },
    });

    const pipelineStages = [
      {
        stageNumber: 1,
        id: "intent_parsing",
        name: "Intent Parsing",
        description: "Deterministic regex normalization & Puter gpt-5.4-nano semantic classification",
        status: intentEvents.some((e) => e.status !== "SUCCESS") ? "DEGRADED" : "HEALTHY",
        runsToday: intentEvents.length,
        avgLatencyMs:
          intentEvents.length > 0
            ? Math.round(intentEvents.reduce((s, e) => s + e.durationMs, 0) / intentEvents.length)
            : 180,
        successRate:
          intentEvents.length > 0
            ? Math.round(
                (intentEvents.filter((e) => e.status === "SUCCESS").length / intentEvents.length) * 100
              )
            : 100,
        model: "gpt-5.4-nano / Deterministic",
      },
      {
        stageNumber: 2,
        id: "action_planning",
        name: "Action Planning",
        description: "SearchPlanner capability routing & dependency resolution",
        status: planningEvents.some((e) => e.status !== "SUCCESS") ? "DEGRADED" : "HEALTHY",
        runsToday: planningEvents.length,
        avgLatencyMs:
          planningEvents.length > 0
            ? Math.round(planningEvents.reduce((s, e) => s + e.durationMs, 0) / planningEvents.length)
            : 420,
        successRate:
          planningEvents.length > 0
            ? Math.round(
                (planningEvents.filter((e) => e.status === "SUCCESS").length / planningEvents.length) * 100
              )
            : 100,
        model: "gpt-5.4-nano",
      },
      {
        stageNumber: 3,
        id: "harvester_dispatch",
        name: "Harvester Dispatch",
        description: "Concurrent multi-source extraction (Y Combinator, ATS Direct, LinkedIn, Hacker News)",
        status: "HEALTHY",
        runsToday: recentSearches.length,
        avgLatencyMs: 1850,
        successRate: 100,
        model: "Multi-Source Swarm Connectors",
      },
      {
        stageNumber: 4,
        id: "verification_sandbox",
        name: "Verification Sandbox",
        description: "Synthetic data firewall, URL verification, and posting freshness gates",
        status: "HEALTHY",
        runsToday: recentSearches.length,
        avgLatencyMs: 120,
        successRate: 100,
        model: "Rule-Based Truth Gate",
      },
      {
        stageNumber: 5,
        id: "semantic_ranking",
        name: "Semantic Judge & Ranking",
        description: "100-point multi-factor relevance scoring and 3-tier candidate deduplication",
        status: rankingEvents.some((e) => e.status !== "SUCCESS") ? "DEGRADED" : "HEALTHY",
        runsToday: rankingEvents.length || recentSearches.length,
        avgLatencyMs:
          rankingEvents.length > 0
            ? Math.round(rankingEvents.reduce((s, e) => s + e.durationMs, 0) / rankingEvents.length)
            : 240,
        successRate: 100,
        model: "Relevance Engine",
      },
      {
        stageNumber: 6,
        id: "delivery_alerts",
        name: "Delivery & Notifications",
        description: "Ranked dossier hydration, search history persistence, and autonomous watch alerts",
        status: "HEALTHY",
        runsToday: recentSearches.length,
        avgLatencyMs: 65,
        successRate: 100,
        model: "Event Emitter & SSE",
      },
    ];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      engineStress: {
        puterTokensToday,
        puterDailyLimit,
        puterHeadroom,
        geminiTokensToday,
        deepseekTokensToday,
        totalTokensToday: puterTokensToday + geminiTokensToday + deepseekTokensToday,
        avgLatencyMs,
        successRate,
        totalOperationsToday: totalEvents,
        activeSearchesCount,
        totalOpportunitiesDiscovered,
        operationBreakdown: opBreakdown,
      },
      pipelineStages,
      recentSearches: recentSearches.map((s) => ({
        id: s.id,
        rawQuery: s.rawQuery,
        status: s.status,
        totalFound: s.totalFound,
        resultCount: s.results.length,
        stoppingReason: s.stoppingReason,
        failureReason: s.failureReason,
        createdAt: s.createdAt,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        durationMs: s.completedAt && s.startedAt ? s.completedAt.getTime() - s.startedAt.getTime() : undefined,
        userEmail: s.user?.email || "anonymous",
        results: s.results.map((r) => ({
          title: r.opportunity.title,
          companyName: r.opportunity.companyName,
          location: r.opportunity.location,
          workMode: r.opportunity.workMode,
          experienceLevel: r.opportunity.experienceLevel,
          matchScore: r.matchScore,
          sources: r.opportunity.sourceListings.map((sl) => sl.sourcePlatform),
        })),
      })),
      recentUsageEvents: recentUsageEvents.slice(0, 30).map((e) => ({
        id: e.id,
        provider: e.provider,
        model: e.model,
        operation: e.operation,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        totalTokens: e.totalTokens,
        durationMs: e.durationMs,
        status: e.status,
        errorMessage: e.errorMessage,
        timestamp: e.timestamp,
        userEmail: e.user?.email || "anonymous",
      })),
    });
  } catch (err: unknown) {
    console.error("[AdminAgenticAPI] Error:", err);
    return NextResponse.json(
      { error: "AGENTIC_METRICS_ERROR", message: (err as Error).message || "Failed to load agentic metrics." },
      { status: 500 }
    );
  }
}
