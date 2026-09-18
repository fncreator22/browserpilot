import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getActiveUserSearch } from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";
import { executionKeyRegistry } from "@/lib/discovery/execution/executionKeyRegistry";
import {
  calculateSearchExecutionBudget,
  isSearchStaleOrExceeded,
} from "@/lib/discovery/execution/executionBudget";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id || null;

    if (
      !userId &&
      (process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test" ||
        (process.env as any).IS_TEST_HARNESS === "true")
    ) {
      const headerUser = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to query active search." },
        { status: 401 }
      );
    }

    // 1. Look for active in-flight or recently updated search
    const activeSearch = await getActiveUserSearch(userId);

    if (activeSearch) {
      // Check atomic key revocation
      if (executionKeyRegistry.isKeyRevoked(activeSearch.id) || activeSearch.cancellationRequested) {
        await prisma.search.update({
          where: { id: activeSearch.id },
          data: {
            status: "STOPPED",
            cancellationRequested: true,
            stoppingReason: "CANCELLED_BY_USER",
            totalFound: 0,
            completedAt: new Date(),
          },
        }).catch(() => {});
        return NextResponse.json({ active: false, recent: false });
      }

      // Calculate execution budget from canonicalIntent if available (180s baseline dynamically scaling up to 300s ceiling)
      let parsedIntent: any = null;
      if (activeSearch.canonicalIntent) {
        try {
          parsedIntent = JSON.parse(activeSearch.canonicalIntent);
        } catch {}
      }
      const budget = calculateSearchExecutionBudget({
        query: activeSearch.rawQuery,
        sources: parsedIntent?.sources,
        requestedCount: parsedIntent?.requestedCount || 10,
        companies: parsedIntent?.companies,
        roles: parsedIntent?.roles,
        isMultiSource: parsedIntent?.sources?.length > 1,
      });

      const staleCheck = isSearchStaleOrExceeded(activeSearch, budget.budgetMs);
      if (staleCheck.isStale) {
        // Auto-terminate stale search so it doesn't hang forever or auto-restart
        await prisma.search.update({
          where: { id: activeSearch.id },
          data: {
            status: "STOPPED",
            stoppingReason: "TIMEOUT",
            completedAt: new Date(),
          },
        }).catch(() => {});
      } else {
        return NextResponse.json({
          active: true,
          executionId: activeSearch.id,
          searchId: activeSearch.id,
          query: activeSearch.rawQuery,
          status: activeSearch.status,
          startedAt: activeSearch.startedAt || activeSearch.createdAt,
          updatedAt: activeSearch.updatedAt,
          totalFound: activeSearch.totalFound,
          budgetMs: budget.budgetMs,
          budgetSeconds: budget.budgetSeconds,
        });
      }
    }

    // 2. Fallback: check most recent search within last 30 minutes (recovers session if refreshed)
    const recentSearch = await prisma.search.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentSearch) {
      // If the search was explicitly cancelled or stopped, do not auto-resume or restore on reload
      const isExplicitlyCancelled =
        recentSearch.status === "STOPPED" ||
        recentSearch.cancellationRequested ||
        recentSearch.stoppingReason === "CANCELLED" ||
        recentSearch.stoppingReason === "CANCELLED_BY_USER" ||
        executionKeyRegistry.isKeyRevoked(recentSearch.id);

      if (isExplicitlyCancelled) {
        return NextResponse.json({ active: false, recent: false });
      }

      const isRunningOrQueued = recentSearch.status === "RUNNING" || recentSearch.status === "QUEUED";
      let recentParsedIntent: any = null;
      if (recentSearch.canonicalIntent) {
        try {
          recentParsedIntent = JSON.parse(recentSearch.canonicalIntent);
        } catch {}
      }
      const budget = calculateSearchExecutionBudget({
        query: recentSearch.rawQuery,
        sources: recentParsedIntent?.sources,
        requestedCount: recentParsedIntent?.requestedCount || 10,
        companies: recentParsedIntent?.companies,
        roles: recentParsedIntent?.roles,
        isMultiSource: recentParsedIntent?.sources?.length > 1,
      });

      const isStale = isRunningOrQueued && isSearchStaleOrExceeded(recentSearch, budget.budgetMs).isStale;
      if (isStale) {
        await prisma.search.update({
          where: { id: recentSearch.id },
          data: {
            status: "STOPPED",
            stoppingReason: "TIMEOUT",
            completedAt: new Date(),
          },
        }).catch(() => {});
        return NextResponse.json({ active: false, recent: false });
      }

      const isStillInFlight = !isStale && isRunningOrQueued;
      return NextResponse.json({
        active: isStillInFlight,
        recent: !isStillInFlight,
        executionId: recentSearch.id,
        searchId: recentSearch.id,
        query: recentSearch.rawQuery,
        status: recentSearch.status,
        startedAt: recentSearch.startedAt || recentSearch.createdAt,
        completedAt: recentSearch.completedAt,
        totalFound: recentSearch.totalFound,
        stoppingReason: recentSearch.stoppingReason,
        budgetMs: budget.budgetMs,
        budgetSeconds: budget.budgetSeconds,
      });
    }

    return NextResponse.json({ active: false, recent: false });
  } catch (err: unknown) {
    console.error("[ActiveSearchAPI] Error checking active search:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to query active search execution." },
      { status: 500 }
    );
  }
}
