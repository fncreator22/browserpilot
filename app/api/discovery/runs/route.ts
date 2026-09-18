import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

async function resolveAuthUserId(request?: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions).catch(() => null);
  const sessionUserId = (session?.user as { id?: string })?.id;
  if (sessionUserId) return sessionUserId;

  if (
    process.env.IS_TEST_HARNESS === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.NODE_ENV === "development"
  ) {
    return (
      request?.headers.get("x-user-id") ||
      request?.headers.get("x-test-user-id") ||
      null
    );
  }

  return null;
}

/**
 * GET /api/discovery/runs
 * Retrieves historical autonomous radar scan runs for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveAuthUserId(request);

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to view discovery runs." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "30", 10), 1), 100);

    const runs = await prisma.discoveryRun.findMany({
      where: { userId },
      include: {
        events: {
          include: {
            opportunity: {
              include: {
                sourceListings: true,
              },
            },
          },
        },
      },
      orderBy: { startedAt: "desc" },
      take: limit,
    });

    const formattedRuns = runs.map((run) => {
      const results = run.events.map((ev, idx) => {
        const opp = ev.opportunity;
        const primaryListing = opp?.sourceListings?.[0];
        let reqs: string[] = [];
        let skills: string[] = [];
        try {
          reqs = JSON.parse(opp?.requirements || "[]");
        } catch {}
        try {
          skills = JSON.parse(opp?.skills || "[]");
        } catch {}

        return {
          id: opp?.id || ev.id,
          title: opp?.title || "Discovered Opportunity",
          companyName: opp?.companyName || "Unknown Employer",
          location: opp?.location || "Remote",
          workMode: opp?.workMode || "REMOTE",
          experienceLevel: opp?.experienceLevel || "ENTRY_LEVEL",
          opportunityType: opp?.opportunityType || "FULL_TIME",
          salaryMin: opp?.salaryMin,
          salaryMax: opp?.salaryMax,
          salaryCurrency: opp?.salaryCurrency,
          description: opp?.description || "",
          requirements: Array.isArray(reqs) ? reqs : [],
          skills: Array.isArray(skills) ? skills : [],
          primaryApplyUrl: opp?.primaryApplyUrl || primaryListing?.applyUrl || primaryListing?.sourceUrl,
          applyUrl: opp?.primaryApplyUrl || primaryListing?.applyUrl || primaryListing?.sourceUrl,
          status: opp?.status || "VERIFIED_LIVE",
          verificationStatus: primaryListing?.verificationStatus || opp?.status || "VERIFIED_LIVE",
          matchScore: ev.matchScore || 85,
          classification: ev.classification,
          rankPosition: idx + 1,
          sourceListings: opp?.sourceListings?.map((l) => ({
            id: l.id,
            sourcePlatform: l.sourcePlatform,
            sourceUrl: l.sourceUrl,
            applyUrl: l.applyUrl,
            verificationStatus: l.verificationStatus,
          })) || [],
        };
      });

      return {
        id: run.id,
        triggerType: run.triggerType,
        status: run.status,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || null,
        durationMs: run.durationMs,
        providersAttempted: run.providersAttempted,
        providersSucceeded: run.providersSucceeded,
        providersFailed: run.providersFailed,
        candidatesFound: run.candidatesFound,
        validCandidates: run.validCandidates,
        newOpportunities: run.newOpportunities,
        notificationsCreated: run.notificationsCreated,
        errorMessage: run.errorMessage,
        totalFound: results.length,
        results,
      };
    });

    return NextResponse.json({
      success: true,
      runs: formattedRuns,
    });
  } catch (err: unknown) {
    console.error("[DiscoveryRunsAPI] Error retrieving discovery runs:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve discovery runs." },
      { status: 500 }
    );
  }
}
