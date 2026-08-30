import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserDiscoveryEvents } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

/**
 * GET /api/discovery/events
 * Retrieves novel opportunity discovery events for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to view discovery events." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const classification = searchParams.get("classification") || undefined;
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);

    const events = await getUserDiscoveryEvents(userId, {
      classification,
      limit,
    });

    return NextResponse.json({
      events: events.map((e) => ({
        id: e.id,
        runId: e.runId,
        classification: e.classification,
        matchScore: e.matchScore,
        freshnessClass: e.freshnessClass,
        notificationCreated: e.notificationCreated,
        discoveredAt: e.discoveredAt,
        opportunity: {
          id: e.opportunity.id,
          canonicalHash: e.opportunity.canonicalHash,
          title: e.opportunity.title,
          companyName: e.opportunity.companyName,
          location: e.opportunity.location,
          workMode: e.opportunity.workMode,
          experienceLevel: e.opportunity.experienceLevel,
          opportunityType: e.opportunity.opportunityType,
          salaryMin: e.opportunity.salaryMin,
          salaryMax: e.opportunity.salaryMax,
          salaryCurrency: e.opportunity.salaryCurrency,
          description: e.opportunity.description,
          skills: JSON.parse(e.opportunity.skills || "[]"),
          requirements: JSON.parse(e.opportunity.requirements || "[]"),
          primaryApplyUrl: e.opportunity.primaryApplyUrl,
          status: e.opportunity.status,
          firstSeenAt: e.opportunity.firstSeenAt,
          lastVerifiedAt: e.opportunity.lastVerifiedAt,
          sourceListings: e.opportunity.sourceListings.map((l) => ({
            sourcePlatform: l.sourcePlatform,
            sourceUrl: l.sourceUrl,
            applyUrl: l.applyUrl,
            verificationStatus: l.verificationStatus,
            screenshotPath: l.screenshotPath,
            rawSnippet: l.rawSnippet,
            seenAt: l.seenAt,
          })),
        },
      })),
    });
  } catch (err: unknown) {
    console.error("[DiscoveryEventsAPI] GET Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve discovery events." },
      { status: 500 }
    );
  }
}
