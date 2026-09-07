import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/:id
 * Fetches the current status and full results dossier for a search execution.
 * Allows client recovery across page reloads and disconnects.
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const executionId = params.id;

  if (!executionId) {
    return NextResponse.json({ error: "Missing executionId" }, { status: 400 });
  }

  // 1. Resolve User Session
  const session = await getServerSession(authOptions).catch(() => null);
  let userId = (session?.user as any)?.id || null;
  if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")) {
    userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
  }

  try {
    // 2. Query Search Record from PostgreSQL
    const searchRecord = await prisma.search.findUnique({
      where: { id: executionId },
      include: {
        results: {
          include: {
            opportunity: {
              include: {
                sourceListings: true,
              },
            },
          },
          orderBy: {
            rankPosition: "asc",
          },
        },
      },
    });

    if (!searchRecord) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Search execution '${executionId}' not found.` },
        { status: 404 }
      );
    }

    // 3. Resolve User Saved Opportunities (if authenticated)
    const userSavedOpportunityIds = new Set<string>();
    if (userId) {
      try {
        const saved = await prisma.savedOpportunity.findMany({
          where: { userId },
          select: { opportunityId: true },
        });
        for (const s of saved) {
          userSavedOpportunityIds.add(s.opportunityId);
        }
      } catch {}
    }

    // 4. Format Structured Results Deck
    const structuredResults = searchRecord.results.map((sr) => {
      const opp = sr.opportunity;
      const isSaved = userSavedOpportunityIds.has(opp.id);
      return {
        id: opp.id,
        canonicalHash: opp.canonicalHash,
        title: opp.title,
        companyName: opp.companyName,
        location: opp.location,
        workMode: opp.workMode,
        experienceLevel: opp.experienceLevel,
        opportunityType: opp.opportunityType,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        salaryCurrency: opp.salaryCurrency,
        description: opp.description,
        requirements: opp.requirements,
        skills: opp.skills,
        primaryApplyUrl: opp.primaryApplyUrl,
        status: opp.status,
        firstSeenAt: opp.firstSeenAt,
        lastVerifiedAt: opp.lastVerifiedAt,
        matchScore: sr.matchScore,
        rankPosition: sr.rankPosition,
        saved: isSaved,
        sourceListings: opp.sourceListings.map((l) => ({
          sourcePlatform: l.sourcePlatform,
          sourceUrl: l.sourceUrl,
          applyUrl: l.applyUrl,
          externalJobId: l.externalJobId,
          verificationStatus: l.verificationStatus,
          rawSnippet: l.rawSnippet,
          screenshotPath: l.screenshotPath,
          seenAt: l.seenAt,
        })),
      };
    });

    let canonicalIntent: any = {};
    if (searchRecord.canonicalIntent) {
      try {
        canonicalIntent = JSON.parse(searchRecord.canonicalIntent);
      } catch {
        canonicalIntent = {};
      }
    }

    const verifiedCount = structuredResults.length;
    const requestedCount = canonicalIntent.requestedCount || 10;
    const isComplete = verifiedCount >= requestedCount;
    const isPartial = verifiedCount > 0 && verifiedCount < requestedCount;

    let explanation = "";
    const roleName = searchRecord.parsedRole || "opportunity";
    if (searchRecord.status === "STOPPED") {
      explanation = "Search execution was cancelled by user request.";
    } else if (isComplete) {
      explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria.`;
    } else if (isPartial) {
      explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria.`;
    } else if (searchRecord.status === "COMPLETED") {
      explanation = `Search completed. Found ${verifiedCount} opportunities.`;
    } else {
      explanation = `Search is currently ${searchRecord.status.toLowerCase()}...`;
    }

    return NextResponse.json({
      searchId: searchRecord.id,
      executionId: searchRecord.id,
      status: searchRecord.status,
      query: searchRecord.rawQuery,
      intent: canonicalIntent,
      canonicalIntent,
      canonicalIntentHash: searchRecord.canonicalIntentHash,
      requestedCount,
      verifiedCount,
      results: structuredResults,
      stoppingReason: searchRecord.stoppingReason,
      explanation,
      createdAt: searchRecord.createdAt,
      completedAt: searchRecord.completedAt,
      metadata: {
        totalUniqueOpportunities: structuredResults.length,
        returnedCount: structuredResults.length,
        explanation,
      },
    });
  } catch (err: unknown) {
    console.error(`[SearchAPI] Error retrieving search ${executionId}:`, err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve search results." },
      { status: 500 }
    );
  }
}
