import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getActiveUserSearch } from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id || null;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = request.headers.get("x-test-user-id");
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
      return NextResponse.json({
        active: true,
        executionId: activeSearch.id,
        searchId: activeSearch.id,
        query: activeSearch.rawQuery,
        status: activeSearch.status,
        startedAt: activeSearch.startedAt || activeSearch.createdAt,
        updatedAt: activeSearch.updatedAt,
        totalFound: activeSearch.totalFound,
      });
    }

    // 2. Fallback: check most recent search within last 60 seconds (in case it just completed/stopped during page refresh)
    const recentSearch = await prisma.search.findFirst({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 60000) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (recentSearch) {
      return NextResponse.json({
        active: false,
        recent: true,
        executionId: recentSearch.id,
        searchId: recentSearch.id,
        query: recentSearch.rawQuery,
        status: recentSearch.status,
        startedAt: recentSearch.startedAt || recentSearch.createdAt,
        completedAt: recentSearch.completedAt,
        totalFound: recentSearch.totalFound,
        stoppingReason: recentSearch.stoppingReason,
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
