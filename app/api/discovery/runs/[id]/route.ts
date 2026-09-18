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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const runId = params.id;

    if (!runId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required run ID." },
        { status: 400 }
      );
    }

    const userId = await resolveAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to view run details." },
        { status: 401 }
      );
    }

    const run = await prisma.discoveryRun.findFirst({
      where: { id: runId, userId },
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
    });

    if (!run) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Discovery run not found." },
        { status: 404 }
      );
    }

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

    return NextResponse.json({
      success: true,
      run: {
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
        totalFound: results.length,
        results,
      },
    });
  } catch (err: unknown) {
    console.error("[DiscoveryRunDetailAPI] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve discovery run." },
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
    const runId = params.id;

    if (!runId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required run ID." },
        { status: 400 }
      );
    }

    const userId = await resolveAuthUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to delete discovery runs." },
        { status: 401 }
      );
    }

    await prisma.discoveryRun.deleteMany({
      where: { id: runId, userId },
    });

    return NextResponse.json({
      success: true,
      message: "Discovery run deleted successfully.",
    });
  } catch (err: unknown) {
    console.error("[DiscoveryRunDeleteAPI] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete discovery run." },
      { status: 500 }
    );
  }
}
