import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getOpportunityWithSourceListings, isOpportunitySaved } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const oppId = params.id;

    if (!oppId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required opportunity ID parameter." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id || null;

    const opp = await getOpportunityWithSourceListings(oppId);

    if (!opp) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Opportunity not found." },
        { status: 404 }
      );
    }

    let isSaved = false;
    if (userId) {
      try {
        isSaved = await isOpportunitySaved(userId, opp.id);
      } catch {
        // Non-fatal if bookmark check fails
      }
    }

    // Safely parse JSON array fields
    let skillsList: string[] = [];
    if (opp.skills) {
      try {
        skillsList = typeof opp.skills === "string" ? JSON.parse(opp.skills) : opp.skills;
      } catch {
        skillsList = [opp.skills];
      }
    }

    let reqsList: string[] = [];
    if (opp.requirements) {
      try {
        reqsList = typeof opp.requirements === "string" ? JSON.parse(opp.requirements) : opp.requirements;
      } catch {
        reqsList = [opp.requirements];
      }
    }

    return NextResponse.json({
      opportunity: {
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
        requirements: reqsList,
        skills: skillsList,
        primaryApplyUrl: opp.primaryApplyUrl,
        status: opp.status,
        firstSeenAt: opp.firstSeenAt,
        lastVerifiedAt: opp.lastVerifiedAt,
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
      },
    });
  } catch (err: unknown) {
    console.error("[OpportunityDetailAPI] Error fetching opportunity detail:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: (err as Error).message || "Failed to retrieve opportunity details.",
      },
      { status: 500 }
    );
  }
}
