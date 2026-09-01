import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { parseSearchIntent, executeSearchPipeline, type SearchIntent } from "@/lib/scraper";
import { isOpportunitySaved, getOpportunityByCanonicalHash } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export interface SearchApiRequest {
  query?: string;
  filters?: Partial<SearchIntent>;
  maxResults?: number;
  verifyEvidence?: boolean;
  maxVerificationCandidates?: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id || null;

    const body = (await request.json().catch(() => ({}))) as SearchApiRequest;
    const rawQuery = (body.query || "").trim();
    const filters = body.filters || {};
    const maxResults = Math.min(Math.max(body.maxResults || 20, 1), 50);
    const verifyEvidence = body.verifyEvidence ?? false;
    const maxVerificationCandidates = Math.min(Math.max(body.maxVerificationCandidates || 10, 1), 20);

    if (!rawQuery && !filters.role && !filters.skills?.length && !filters.location) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Please provide a search query or at least one role/skill filter.",
        },
        { status: 400 }
      );
    }

    // 1. Deterministic Intent Extraction
    const intent = parseSearchIntent(rawQuery, filters);

    // 2. Execute Autonomous Search Pipeline
    const pipelineResult = await executeSearchPipeline(intent, {
      userId,
      rawQuery: rawQuery || intent.queryHint,
      persistToDb: true,
      maxResults,
      verifyEvidence,
      maxVerificationCandidates,
      excludeKnown: intent.excludeKnown,
    });

    // 3. Format Structured Results with User-Specific Bookmark State
    const structuredResults = await Promise.all(
      pipelineResult.rankedOpportunities.map(async (item) => {
        let isSaved = false;
        let persistedId = item.opportunity.canonicalHash;

        if (userId) {
          try {
            const dbOpp = await getOpportunityByCanonicalHash(item.opportunity.canonicalHash);
            if (dbOpp) {
              persistedId = dbOpp.id;
              isSaved = await isOpportunitySaved(userId, dbOpp.id);
            }
          } catch {
            // Non-fatal if bookmark check fails
          }
        }

        return {
          id: persistedId,
          canonicalHash: item.opportunity.canonicalHash,
          title: item.opportunity.title,
          companyName: item.opportunity.companyName,
          location: item.opportunity.location,
          workMode: item.opportunity.workMode,
          experienceLevel: item.opportunity.experienceLevel,
          opportunityType: item.opportunity.opportunityType,
          salaryMin: item.opportunity.salaryMin,
          salaryMax: item.opportunity.salaryMax,
          salaryCurrency: item.opportunity.salaryCurrency,
          description: item.opportunity.description,
          requirements: item.opportunity.requirements,
          skills: item.opportunity.skills,
          primaryApplyUrl: item.opportunity.primaryApplyUrl,
          status: item.opportunity.status,
          firstSeenAt: item.opportunity.firstSeenAt,
          lastVerifiedAt: item.opportunity.lastVerifiedAt,
          postedAt: item.opportunity.postedAt || null,
          postedAgoText: item.opportunity.postedAgoText || (item.opportunity.postedAt ? `Posted ${Math.max(0, Math.floor((Date.now() - new Date(item.opportunity.postedAt).getTime()) / (24 * 3600 * 1000)))}d ago` : null),
          metadataConfidence: (item.opportunity as any).metadataConfidence || "VERIFIED",
          sourceListings: item.opportunity.sourceListings.map((l) => ({
            sourcePlatform: l.sourcePlatform,
            sourceUrl: l.sourceUrl,
            applyUrl: l.applyUrl,
            externalJobId: l.externalJobId,
            verificationStatus: l.verificationStatus,
            rawSnippet: l.rawSnippet,
            screenshotPath: l.screenshotPath,
            seenAt: l.seenAt,
            postedAt: l.postedAt,
            postedAgoText: l.postedAgoText,
          })),
          matchScore: item.totalScore,
          rankPosition: item.rankPosition,
          scoreBreakdown: item.breakdown,
          saved: isSaved,
        };
      })
    );

    return NextResponse.json({
      searchId: pipelineResult.searchId,
      status: "COMPLETED",
      query: rawQuery || intent.queryHint,
      intent,
      results: structuredResults,
      explanation: pipelineResult.searchExplanation,
      diagnostics: pipelineResult.searchDiagnostics,
      metadata: {
        providersAttempted: pipelineResult.discovery.telemetry.length,
        providersSucceeded: pipelineResult.discovery.telemetry.filter((t) => t.status === "SUCCESS").length,
        totalDiscovered: pipelineResult.discovery.candidates.length,
        totalUniqueOpportunities: pipelineResult.totalUniqueOpportunities,
        returnedCount: structuredResults.length,
        durationMs: pipelineResult.durationMs,
        telemetry: pipelineResult.discovery.telemetry,
        verification: pipelineResult.verificationTelemetry,
        explanation: pipelineResult.searchExplanation,
        diagnostics: pipelineResult.searchDiagnostics,
      },
    });
  } catch (err: unknown) {
    console.error("[SearchAPI] Execution Error:", err);
    return NextResponse.json(
      {
        error: "SEARCH_EXECUTION_ERROR",
        message: (err as Error).message || "An unexpected error occurred during search execution.",
      },
      { status: 500 }
    );
  }
}
