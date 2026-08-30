import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getSavedOpportunities } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "AUTHENTICATION_REQUIRED", message: "You must be signed in to view saved opportunities." },
        { status: 401 }
      );
    }

    const savedRecords = await getSavedOpportunities(userId);

    const formatted = savedRecords.map((rec) => {
      const opp = rec.opportunity;
      return {
        savedId: rec.id,
        savedAt: rec.createdAt,
        notes: rec.notes,
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
          requirements: opp.requirements ? JSON.parse(opp.requirements) : [],
          skills: opp.skills ? JSON.parse(opp.skills) : [],
          primaryApplyUrl: opp.primaryApplyUrl,
          status: opp.status,
          firstSeenAt: opp.firstSeenAt,
          lastVerifiedAt: opp.lastVerifiedAt,
          sourceListings: (opp.sourceListings || []).map((l) => ({
            sourcePlatform: l.sourcePlatform,
            sourceUrl: l.sourceUrl,
            applyUrl: l.applyUrl,
            externalJobId: l.externalJobId,
            verificationStatus: l.verificationStatus,
            rawSnippet: l.rawSnippet,
            screenshotPath: l.screenshotPath,
            seenAt: l.seenAt,
          })),
        },
      };
    });

    return NextResponse.json({
      savedOpportunities: formatted,
      total: formatted.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SAVED_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
