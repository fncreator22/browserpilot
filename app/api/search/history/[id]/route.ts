import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getSearchSession, deleteSearchSession, isOpportunitySaved } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const searchId = params.id;

    if (!searchId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required search ID parameter." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id || null;

    const search = await getSearchSession(searchId, userId);

    if (!search) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Search session not found or unauthorized." },
        { status: 404 }
      );
    }

    // Format results with user's current saved bookmark status
    const results = await Promise.all(
      search.results.map(async (sr) => {
        const opp = sr.opportunity;
        let isSaved = false;
        if (userId) {
          try {
            isSaved = await isOpportunitySaved(userId, opp.id);
          } catch {
            // Non-fatal
          }
        }

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
          requirements: opp.requirements ? (typeof opp.requirements === "string" ? JSON.parse(opp.requirements) : opp.requirements) : [],
          skills: opp.skills ? (typeof opp.skills === "string" ? JSON.parse(opp.skills) : opp.skills) : [],
          primaryApplyUrl: opp.primaryApplyUrl,
          status: opp.status,
          firstSeenAt: opp.firstSeenAt,
          lastVerifiedAt: opp.lastVerifiedAt,
          matchScore: sr.matchScore,
          rankPosition: sr.rankPosition,
          saved: isSaved,
          sourceListings: opp.sourceListings.map((l) => ({
            id: l.id,
            sourcePlatform: l.sourcePlatform,
            sourceUrl: l.sourceUrl,
            applyUrl: l.applyUrl,
            externalJobId: l.externalJobId,
            verificationStatus: l.verificationStatus,
            screenshotPath: l.screenshotPath,
            rawSnippet: l.rawSnippet,
            seenAt: l.seenAt,
          })),
        };
      })
    );

    return NextResponse.json({
      search: {
        id: search.id,
        rawQuery: search.rawQuery,
        intentType: search.intentType,
        parsedRole: search.parsedRole,
        parsedSkills: search.parsedSkills,
        parsedLocation: search.parsedLocation,
        parsedWorkMode: search.parsedWorkMode,
        targetGradYear: search.targetGradYear,
        totalFound: search.totalFound,
        status: search.status,
        createdAt: search.createdAt,
        results,
      },
    });
  } catch (err: unknown) {
    console.error("[SearchHistoryDetailAPI] Error retrieving search session:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve search session." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const searchId = params.id;

    if (!searchId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required search ID parameter." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to delete search history." },
        { status: 401 }
      );
    }

    const result = await deleteSearchSession(searchId, userId);

    if (!result.deleted) {
      return NextResponse.json(
        { error: "NOT_FOUND_OR_FORBIDDEN", message: "Search entry not found or you do not have permission to delete it." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Search history session deleted successfully.",
    });
  } catch (err: unknown) {
    console.error("[SearchHistoryDeleteAPI] Error deleting search session:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete search session." },
      { status: 500 }
    );
  }
}
