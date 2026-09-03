import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { parseSearchIntent, type SearchIntent } from "@/lib/scraper";
import { intelligenceHarness } from "@/lib/ai/harness";
import {
  isOpportunitySaved,
  getOpportunityByCanonicalHash,
  createSearch,
  upsertOpportunity,
  upsertSourceListing,
  attachOpportunityToSearch,
} from "@/lib/db/opportunities";
import {
  classifySearchFailure,
  sanitizeSearchTelemetry,
  type CanonicalSearchFailure,
} from "@/lib/ai/errors/searchFailureModel";

export const dynamic = "force-dynamic";

export interface SearchApiRequest {
  query?: string;
  filters?: Partial<SearchIntent>;
  maxResults?: number;
  verifyEvidence?: boolean;
  maxVerificationCandidates?: number;
  persistToDb?: boolean;
  customProviders?: any[];
  correlationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Resolve Server-Authoritative User Identity
    const session = await getServerSession(authOptions).catch(() => null);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let userId: string | null = sessionUser?.id || null;

    // Test harness override for multi-tenant integration testing ONLY in test environments
    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUserId = request.headers.get("x-test-user-id");
      if (headerUserId) {
        userId = headerUserId;
      }
    }

    // CASE A — Unauthenticated production API request
    if (!userId) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          message: "Authentication required to perform an opportunity search. Please sign in.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as SearchApiRequest;
    const customProviders = (request as any)._customProviders || body.customProviders;
    const rawQuery = (body.query || "").trim();
    const filters = body.filters || {};
    const maxResultsCeiling = Math.min(Math.max(body.maxResults || 50, 1), 50);
    const verifyEvidence = body.verifyEvidence ?? true;
    const persistToDb = body.persistToDb !== false;
    const correlationId =
      request.headers.get("x-correlation-id") ||
      body.correlationId ||
      `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 2. Validate Request Boundaries
    if (!rawQuery && !filters.role && !filters.skills?.length && !filters.location && !filters.companies?.length && !filters.company) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Please provide a search query or at least one role/skill/location filter.",
        },
        { status: 400 }
      );
    }

    if (rawQuery.length > 500) {
      return NextResponse.json(
        {
          error: "INVALID_REQUEST",
          message: "Search query exceeds the maximum allowed length of 500 characters.",
        },
        { status: 400 }
      );
    }

    // 3. Precedence-Aware Intent Extraction (TASK-053.1 Count Priority)
    // Priority: Explicit natural-language count > Explicit structured request count > maxResults ceiling > system default (10)
    const initialIntent = parseSearchIntent(rawQuery, filters);
    const requestedCount = initialIntent.requestedCount || filters.requestedCount || (typeof body.maxResults === "number" ? body.maxResults : 10);

    // 4. Execute Intelligence Harness Lifecycle (TASK-048 -> TASK-053)
    // Runs: Intent -> Brain/Memory -> Plan -> Validate -> Execute -> Evidence -> Judge -> Correction Loop -> Dedup -> Rank
    const harnessResult = await intelligenceHarness.runLifecycle(rawQuery || initialIntent.queryHint || "Find software jobs", {
      userId,
      explicitFilters: {
        ...filters,
        requestedCount,
      },
      maxResultsBudget: Math.max(requestedCount, maxResultsCeiling),
      verifyEvidence,
      customProviders,
      correlationId,
      signal: request.signal,
    });

    const rankedOpportunities = harnessResult.rankedOpportunities;
    const canonicalIntent = harnessResult.context.searchIntent || initialIntent;
    const decision = harnessResult.decision;
    const correctionResult = harnessResult.context.correctionLoopResult;

    // 5. Database Persistence (Prisma Search, Opportunities, Listings)
    let persistenceFailure: CanonicalSearchFailure | null = null;
    let persistenceSaved = false;

    if (persistToDb) {
      try {
        const searchRecord = await createSearch({
          id: harnessResult.harnessId,
          userId: userId || null,
          rawQuery: rawQuery || canonicalIntent.queryHint || "",
          intentType: (canonicalIntent as any).intentType || "JOB_SEARCH_GENERAL",
          parsedRole: canonicalIntent.roles?.[0] || canonicalIntent.role || null,
          parsedSkills: canonicalIntent.skills || [],
          parsedLocation: canonicalIntent.locations?.[0] || canonicalIntent.location || null,
          parsedWorkMode: canonicalIntent.workModes?.[0] || canonicalIntent.workMode || "ANY",
          targetGradYear: typeof canonicalIntent.targetGradYear === "number" ? canonicalIntent.targetGradYear : null,
          status: decision.outcome === "COMPLETE" ? "COMPLETED" : "PARTIAL",
          totalFound: rankedOpportunities.length,
        });

        for (const item of rankedOpportunities) {
          const opp = item.opportunity;
          const persistedOpp = await upsertOpportunity({
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
          });

          for (const listing of opp.sourceListings || []) {
            await upsertSourceListing({
              opportunityId: persistedOpp.id,
              sourcePlatform: listing.sourcePlatform,
              externalJobId: listing.externalJobId,
              sourceUrl: listing.sourceUrl,
              applyUrl: listing.applyUrl,
              rawSnippet: listing.rawSnippet,
              verificationStatus: listing.verificationStatus,
              screenshotPath: listing.screenshotPath,
            });
          }

          await attachOpportunityToSearch({
            searchId: searchRecord.id,
            opportunityId: persistedOpp.id,
            matchScore: item.totalScore,
            rankPosition: item.rankPosition,
          });
        }
        persistenceSaved = true;
      } catch (dbErr) {
        console.warn("[SearchAPI] Persistence non-fatal warning:", dbErr);
        persistenceFailure = classifySearchFailure(dbErr, {
          operation: "database_persistence",
          correlationId,
        });
      }
    }

    // 6. Format Structured Results with User Bookmark State
    const structuredResults = await Promise.all(
      rankedOpportunities.map(async (item) => {
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
            // Non-fatal bookmark check
          }
        }

        const daysAgo = item.opportunity.postedAt
          ? Math.max(0, Math.floor((Date.now() - new Date(item.opportunity.postedAt).getTime()) / (24 * 3600 * 1000)))
          : null;

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
          postedAgoText: item.opportunity.postedAgoText || (daysAgo !== null ? `Posted ${daysAgo}d ago` : null),
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

    // 7. Determine Search Status & Shortfall State Invariants (TASK-053.1)
    const verifiedCount = structuredResults.length;
    const effectiveRequestedCount = canonicalIntent.requestedCount || requestedCount;
    const isComplete = verifiedCount >= effectiveRequestedCount;
    const isPartial = verifiedCount > 0 && verifiedCount < effectiveRequestedCount;
    const isNoResults = verifiedCount === 0;

    // Status Invariants:
    // COMPLETE: verifiedCount >= requestedCount -> partial = false, status = "COMPLETE", stoppingReason = "TARGET_SATISFIED"
    // PARTIAL: 0 < verifiedCount < requestedCount -> partial = true, status = "PARTIAL", stoppingReason != "TARGET_SATISFIED"
    // NO_RESULTS: verifiedCount = 0 -> status = "NO_RESULTS", partial = false
    const status = isComplete ? "COMPLETE" : isPartial ? "PARTIAL" : "NO_RESULTS";
    const partial = isPartial;

    let stoppingReason = "TARGET_SATISFIED";
    if (isComplete) {
      stoppingReason = "TARGET_SATISFIED";
    } else if (isPartial) {
      if (correctionResult?.stoppingReason && correctionResult.stoppingReason !== "TARGET_SATISFIED") {
        stoppingReason = correctionResult.stoppingReason;
      } else {
        stoppingReason = "EXHAUSTED";
      }
    } else {
      if (correctionResult?.stoppingReason && correctionResult.stoppingReason !== "TARGET_SATISFIED") {
        stoppingReason = correctionResult.stoppingReason;
      } else {
        stoppingReason = "NO_RESULTS";
      }
    }

    // Explanation Invariant: Must accurately reflect verified vs requested counts
    let explanation = "";
    const roleName = canonicalIntent.roles?.[0] || canonicalIntent.role || "opportunity";
    if (isComplete) {
      explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria.`;
    } else if (isPartial) {
      const shortfall = effectiveRequestedCount - verifiedCount;
      explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria. ${shortfall} additional opportunities could not be verified within the requested window.`;
    } else {
      explanation = `No verified ${roleName} opportunities found matching your criteria.`;
    }

    // 8. Return Authoritative Response Contract
    const responsePayload = {
      searchId: harnessResult.harnessId,
      correlationId,
      status,
      query: rawQuery || canonicalIntent.queryHint,
      intent: canonicalIntent,
      canonicalIntent,
      requestedCount: effectiveRequestedCount,
      verifiedCount,
      results: structuredResults,
      partial,
      explanation,
      diagnostics: {
        requestedCount: effectiveRequestedCount,
        validResultCount: verifiedCount,
        rejectedResultCount: harnessResult.context.verification?.candidatesRejected || 0,
        stoppingReason,
        totalRounds: correctionResult?.totalRounds || 1,
        rejectionReasons: harnessResult.context.verification?.rejectionReasons || [],
        persistenceStatus: persistenceSaved ? "SAVED" : persistenceFailure ? "FAILED" : "SKIPPED",
        persistenceError: persistenceFailure
          ? {
              category: persistenceFailure.category,
              retryable: persistenceFailure.retryable,
              userMessage: persistenceFailure.userMessage,
            }
          : undefined,
      },
      correctionState: correctionResult
        ? {
            roundsExecuted: correctionResult.totalRounds,
            stoppingReason,
            totalActions: correctionResult.totalActions,
            history: correctionResult.correctionHistory.map((h) => ({
              roundNumber: h.roundNumber,
              reason: h.reason,
              strategy: h.strategy,
              verifiedGained: h.newVerifiedGained,
              durationMs: h.durationMs,
            })),
          }
        : undefined,
      sourceSummary: {
        toolsExecuted: harnessResult.telemetry.toolsExecuted,
        memoriesRetrieved: harnessResult.telemetry.memoriesRetrievedCount,
        durationMs: harnessResult.telemetry.totalDurationMs,
      },
      personalization: (harnessResult.context.userMemories?.length || 0) > 0
        ? {
            applied: true,
            memoriesUsed: (harnessResult.context.userMemories || []).map((m) => ({
              category: m.category,
              key: m.key,
              value: m.value,
            })),
            summary: `Personalized using your saved preferences: ${(harnessResult.context.userMemories || []).map((m) => m.value).join(" · ")}`,
          }
        : {
            applied: false,
            memoriesUsed: [],
          },
      metadata: {
        totalUniqueOpportunities: structuredResults.length,
        returnedCount: structuredResults.length,
        durationMs: harnessResult.telemetry.totalDurationMs,
        providersAttempted: harnessResult.telemetry.toolsExecuted.length,
        providersSucceeded: harnessResult.telemetry.toolsExecuted.length,
        telemetry: harnessResult.telemetry,
        explanation,
      },
    };

    const response = NextResponse.json(responsePayload);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  } catch (err: unknown) {
    console.error("[SearchAPI] Execution Error:", err);
    const failure = classifySearchFailure(err, { operation: "searchRoute" });
    const statusCode =
      failure.category === "AUTH_REQUIRED"
        ? 401
        : failure.category === "RATE_LIMITED"
        ? 429
        : failure.category === "CANCELLED"
        ? 499
        : 500;

    return NextResponse.json(
      {
        error: failure.category,
        message: failure.userMessage,
        category: failure.category,
        retryable: failure.retryable,
      },
      { status: statusCode }
    );
  }
}
