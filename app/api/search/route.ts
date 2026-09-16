import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { parseSearchIntent, parseSearchIntentAsync, type SearchIntent } from "@/lib/scraper";
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
import { rateLimiter } from "@/lib/security/rateLimiter";
import { prisma } from "@/lib/db/prisma";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { enqueueSearchDiscoveryJob } from "@/lib/queue/searchQueue";
import {
  getCapabilityLimit,
  getUserPeriodAIUsage,
  isUserByokOrPuter,
} from "@/lib/billing/entitlementService";
import { enrichOpportunityData } from "@/lib/discovery/enrichment/opportunityEnrichmentService";
import { telemetryEngine } from "@/lib/observability/telemetryEngine";
import { promptQueue } from "@/lib/queue/millisecondFifoQueue";

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
  strictAi?: boolean;
  allowDeterministicFallback?: boolean;
  apiKey?: string;
  puterToken?: string;
}

export async function POST(request: NextRequest) {
  const requestStart = performance.now();
  let userId: string | null = null;
  let rawQuery = "";
  let executionId = "";
  let persistToDb = true;

  try {
    // 1. Resolve Server-Authoritative User Identity
    const session = await getServerSession(authOptions).catch(() => null);

    const sessionUser = session?.user as any;
    if (sessionUser?.id) {
      userId = sessionUser.id;
    } else if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true") {
      const headerUserId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
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

    // 2. Enforce Rate Limiting (Abuse Prevention - TASK-058)
    const isTest = process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true";
    const forceRateLimit = request.headers.get("x-test-rate-limit") === "true" || (process.env as any).ENFORCE_RATE_LIMIT_IN_TESTS === "true";
    const skipRateLimit = isTest && !forceRateLimit && (process.env as any).SKIP_RATE_LIMIT_FOR_TESTS !== "false";

    if (!skipRateLimit) {
      const rateCheck = await rateLimiter.check(`search:${userId}`, 60, 60);
      if (!rateCheck.success) {
        return NextResponse.json(
          {
            error: "RATE_LIMITED",
            message: "Search rate limit exceeded. Please wait a moment before trying again.",
            retryAfter: rateCheck.resetSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(rateCheck.resetSeconds),
            },
          }
        );
      }
    }

    const body = (await request.json().catch(() => ({}))) as SearchApiRequest;
    rawQuery = (body.query || (body as any).rawQuery || "").trim();
    if (rawQuery) {
      try {
        promptQueue.enqueue({ query: rawQuery, userId }, 10, {
          correlationId: request.headers.get("x-correlation-id") || undefined,
        });
      } catch {}
    }
    const customProviders = (request as any)._customProviders || body.customProviders;
    const filters = body.filters || {};
    const inputPuterToken = body.puterToken?.trim() || undefined;
    const inputApiKey = body.apiKey?.trim() || undefined;

    // Auto-persist Puter token to ProviderConnection if provided from client
    if (inputPuterToken && userId) {
      try {
        const { upsertPuterConnection } = await import("@/lib/ai/governance/providerGovernance");
        await upsertPuterConnection(userId, { username: "Puter User", token: inputPuterToken }).catch(() => {});
      } catch {}
    }

    // Resolve Global User Connector Preferences (Single Source of Truth)
    if ((!filters.sources || filters.sources.length === 0) && userId) {
      try {
        const userWatch = await prisma.discoveryWatch.findFirst({
          where: { userId, enabled: true },
          orderBy: { createdAt: "desc" },
          select: { preferredSources: true },
        });
        if (userWatch?.preferredSources) {
          const parsed = JSON.parse(userWatch.preferredSources);
          if (Array.isArray(parsed) && parsed.length > 0) {
            filters.sources = parsed;
          }
        }
      } catch (prefErr) {
        console.warn("[SearchAPI] Could not load user connector preferences:", prefErr);
      }
    }

    const maxResultsCeiling = Math.min(Math.max(body.maxResults || 50, 1), 50);
    const verifyEvidence = body.verifyEvidence ?? true;
    persistToDb = body.persistToDb !== false;
    const correlationId =
      request.headers.get("x-correlation-id") ||
      body.correlationId ||
      `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // 2. Validate Request Boundaries
    const hasQuery = Boolean(rawQuery);
    const hasRoleFilter = Boolean(filters.role || (filters.roles && filters.roles.length > 0));
    const hasSkillFilter = Boolean(filters.skills && filters.skills.length > 0);
    const hasLocationFilter = Boolean(filters.location || (filters.locations && filters.locations.length > 0));
    const hasCompanyFilter = Boolean(filters.company || (filters.companies && filters.companies.length > 0));
    const hasOtherFilter = Boolean(filters.opportunityType || filters.workMode || filters.freshnessWindowHours);

    if (!hasQuery && !hasRoleFilter && !hasSkillFilter && !hasLocationFilter && !hasCompanyFilter && !hasOtherFilter) {
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

    // 3. Precedence-Aware Intent Extraction & Canonical Normalization (TASK-053.1 & TASK-067)
    const initialIntent = await parseSearchIntentAsync(rawQuery, {
      userId,
      apiKey: inputApiKey,
      puterToken: inputPuterToken,
      filterOverrides: filters,
    });
    const requestedCount = initialIntent.requestedCount || filters.requestedCount || (typeof body.maxResults === "number" ? body.maxResults : 10);

    const canonicalNorm = executionLifecycleManager.computeCanonicalIntentHash({
      ...initialIntent,
      ...filters,
      queryHint: rawQuery || initialIntent.queryHint,
      requestedCount,
    });
    const canonicalIntentHash = canonicalNorm.hash;
    const canonicalJson = canonicalNorm.canonicalJson;

    // 4. Concurrency Idempotency & In-Flight Attach (TASK-067)
    const activeHandle = executionLifecycleManager.getActiveExecutionForIntent(userId, canonicalIntentHash);
    if (activeHandle) {
      if (activeHandle.promise) {
        const sharedResult = await activeHandle.promise;
        const isStopped = sharedResult.status === "STOPPED" || sharedResult.error === "CANCELLED";
        const response = NextResponse.json(sharedResult, {
          status: isStopped ? 499 : 200,
        });
        response.headers.set("x-correlation-id", correlationId);
        response.headers.set("x-execution-id", activeHandle.executionId);
        response.headers.set("x-idempotent-attach", "true");
        return response;
      } else {
        const response = NextResponse.json({
          success: true,
          executionId: activeHandle.executionId,
          searchId: activeHandle.executionId,
          status: "QUEUED",
          query: rawQuery || initialIntent.queryHint,
          intent: initialIntent,
          canonicalIntent: initialIntent,
          canonicalIntentHash,
          requestedCount,
          idempotentAttach: true,
        });
        response.headers.set("x-correlation-id", correlationId);
        response.headers.set("x-execution-id", activeHandle.executionId);
        response.headers.set("x-idempotent-attach", "true");
        return response;
      }
    }

    // 5. Enforce Per-Plan Limits (PlanCapability System)
    if (userId) {
      // 5a. Enforce Monthly AI Operations Quota
      // Q5 Option A: BYOK/Puter bypasses MONTHLY_AI_OPERATIONS quota specifically
      const hasByokOrPuter = Boolean(inputPuterToken || inputApiKey) || (await isUserByokOrPuter(userId));
      if (!hasByokOrPuter) {
        const usage = await getUserPeriodAIUsage(userId);
        const maxOperations = (await getCapabilityLimit(userId, "MONTHLY_AI_OPERATIONS")) ?? 100;

        if (usage.used >= maxOperations) {
          const resetDateStr = usage.periodEnd.toISOString().split("T")[0];
          const response = NextResponse.json(
            {
              error: "QUOTA_EXCEEDED",
              code: "MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED",
              message: `You have reached your monthly AI operations limit of ${maxOperations}. Resets on ${resetDateStr}. Please upgrade your plan or configure your own Gemini API key in Settings to continue.`,
              currentUsage: usage.used,
              limit: maxOperations,
              resetsAt: usage.periodEnd.toISOString(),
              upgradeUrl: "/app/plans",
            },
            { status: 429 }
          );
          response.headers.set("x-quota-remaining", "0");
          response.headers.set("x-quota-limit", String(maxOperations));
          return response;
        }
      }

      // 5a.2 Strict AI Enforcement & Agent Configuration Check (TASK-METHOD-2)
      // If strictAi is requested (or default in user searches) and fallback is not explicitly permitted:
      const isStrictAiRequested = !customProviders && (body.strictAi ?? (body.persistToDb !== false));
      if (isStrictAiRequested && !body.allowDeterministicFallback) {
        const hasSystemAi = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
        const hasAiBackend = isTest || hasSystemAi || hasByokOrPuter;

        if (!hasAiBackend) {
          return NextResponse.json(
            {
              success: false,
              status: "MODEL_CONFIGURATION_REQUIRED",
              errorCode: "MODEL_CONFIGURATION_REQUIRED",
              message:
                "Autonomous AI Agent execution is locked. Please connect Puter (free 1-click) or configure a Gemini API key in Settings to execute genuine agentic search.",
              availableOptions: {
                puterAvailable: true,
                byokAvailable: true,
                allowFallback: true,
              },
              query: rawQuery,
            },
            { status: 200 }
          );
        }
      }

      // 5b. Self-Healing Concurrency & Active Search Reconciliation (TASK-067 Hardening)
      // Automatically reconcile stranded or orphaned searches older than 30s (worker lease timeout)
      const activeLeaseCutoff = new Date(Date.now() - 30 * 1000);
      try {
        const orphaned = await prisma.search.findMany({
          where: {
            userId,
            status: { in: ["CREATED", "QUEUED", "RUNNING"] },
            createdAt: { lt: activeLeaseCutoff },
          },
          select: { id: true },
        });

        if (orphaned.length > 0) {
          await prisma.search.updateMany({
            where: {
              id: { in: orphaned.map((s) => s.id) },
            },
            data: {
              status: "STOPPED",
              stoppingReason: "ORPHANED_TIMEOUT",
              completedAt: new Date(),
            },
          });
        }
      } catch (reconcileErr) {
        console.warn("[SearchAPI] Orphaned search reconciliation warning:", reconcileErr);
      }

      // Count active searches strictly within the live 30s lease window
      const activeSearchesCount = await prisma.search.count({
        where: {
          userId,
          status: { in: ["CREATED", "QUEUED", "RUNNING"] },
          createdAt: { gte: activeLeaseCutoff },
        },
      });

      const maxConcurrent = (await getCapabilityLimit(userId, "MAX_CONCURRENT_SEARCHES")) ?? 1;

      if (activeSearchesCount >= maxConcurrent) {
        return NextResponse.json(
          {
            error: "CONCURRENT_SEARCH_LIMIT_EXCEEDED",
            message: `You have reached your limit of ${maxConcurrent} concurrent active search${maxConcurrent > 1 ? "es" : ""}. Please wait for your ongoing search to complete or upgrade your plan.`,
            activeSearches: activeSearchesCount,
            limit: maxConcurrent,
          },
          { status: 429 }
        );
      }
    }

    // 6. Durable Execution Identity & Isolated AbortSignal (TASK-067)
    executionId = `search_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const executionAbort = new AbortController();

    if (request.signal.aborted) {
      executionAbort.abort("REQUEST_ABORTED");
    } else {
      request.signal.addEventListener("abort", () => {
        executionAbort.abort("REQUEST_ABORTED");
        executionLifecycleManager.cancelExecution(executionId, userId, "REQUEST_ABORTED").catch(() => {});
      });
    }

    const isSyncRequested = Boolean(
      request.signal?.aborted ||
      customProviders ||
      (body as any).sync === true ||
      request.headers.get("x-sync") === "true"
    );

    // Asynchronous BullMQ Path (Standard Production Mode)
    if (!isSyncRequested) {
      if (persistToDb) {
        try {
          await createSearch({
            id: executionId,
            userId: userId || null,
            rawQuery: rawQuery || initialIntent.queryHint || "",
            canonicalIntentHash,
            canonicalIntent: canonicalJson,
            intentType: (initialIntent as any).intentType || "JOB_SEARCH_GENERAL",
            parsedRole: initialIntent.roles?.[0] || initialIntent.role || null,
            parsedSkills: initialIntent.skills || [],
            parsedLocation: initialIntent.locations?.[0] || initialIntent.location || null,
            parsedWorkMode: initialIntent.workModes?.[0] || initialIntent.workMode || "ANY",
            targetGradYear: typeof initialIntent.targetGradYear === "number" ? initialIntent.targetGradYear : null,
            status: "QUEUED",
            startedAt: new Date(),
            totalFound: 0,
          });
        } catch (dbErr) {
          console.warn("[SearchAPI] Upfront search record creation warning:", dbErr);
        }
      }

      await enqueueSearchDiscoveryJob({
        executionId,
        userId,
        query: rawQuery || initialIntent.queryHint || "Find software jobs",
        filters,
        maxResultsCeiling,
        requestedCount,
        verifyEvidence,
        persistToDb,
        correlationId,
        canonicalIntentHash,
        canonicalJson,
      });

      const response = NextResponse.json(
        {
          success: true,
          executionId,
          searchId: executionId,
          status: "QUEUED",
          query: rawQuery || initialIntent.queryHint,
          intent: initialIntent,
          canonicalIntent: initialIntent,
          canonicalIntentHash,
          requestedCount,
          createdAt: new Date().toISOString(),
        },
        { status: 200 }
      );
      response.headers.set("x-correlation-id", correlationId);
      response.headers.set("x-execution-id", executionId);
      response.headers.set("x-queue-status", "QUEUED");
      return response;
    }

    const executionPromise = (async () => {
      if (persistToDb) {
        try {
          await createSearch({
            id: executionId,
            userId: userId || null,
            rawQuery: rawQuery || initialIntent.queryHint || "",
            canonicalIntentHash,
            canonicalIntent: canonicalJson,
            intentType: (initialIntent as any).intentType || "JOB_SEARCH_GENERAL",
            parsedRole: initialIntent.roles?.[0] || initialIntent.role || null,
            parsedSkills: initialIntent.skills || [],
            parsedLocation: initialIntent.locations?.[0] || initialIntent.location || null,
            parsedWorkMode: initialIntent.workModes?.[0] || initialIntent.workMode || "ANY",
            targetGradYear: typeof initialIntent.targetGradYear === "number" ? initialIntent.targetGradYear : null,
            status: executionAbort.signal.aborted ? "STOPPED" : "RUNNING",
            startedAt: new Date(),
            totalFound: 0,
          });
        } catch (dbErr) {
          console.warn("[SearchAPI] Upfront search record creation warning:", dbErr);
        }
      }

      try {
        // Execute Intelligence Harness Lifecycle (TASK-048 -> TASK-053 -> TASK-067)
        const harnessResult = await intelligenceHarness.runLifecycle(rawQuery || initialIntent.queryHint || "Find software jobs", {
          executionId,
          userId,
          explicitFilters: {
            ...filters,
            requestedCount,
          },
          maxResultsBudget: Math.max(requestedCount, maxResultsCeiling),
          verifyEvidence,
          customProviders,
          correlationId,
          signal: executionAbort.signal,
        });

        const rankedOpportunities = harnessResult.rankedOpportunities;
        const canonicalIntent = harnessResult.context.searchIntent || initialIntent;
        const decision = harnessResult.decision;
        const correctionResult = harnessResult.context.correctionLoopResult;

        const isCancelled = executionAbort.signal.aborted || request.signal.aborted || harnessResult.telemetry.status === "CANCELLED";
        const stillActive = persistToDb ? await executionLifecycleManager.isExecutionActive(executionId) : true;
        const effectivelyCancelled = isCancelled || !stillActive;

        // 6. Database Persistence (Opportunities & Source Listings)
        let persistenceFailure: CanonicalSearchFailure | null = null;
        let persistenceSaved = false;

        if (persistToDb) {
          try {
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
                  screenshotPath: listing.screenshotPath,
                  verificationStatus: listing.verificationStatus,
                });
              }
            }
            persistenceSaved = true;
          } catch (persistErr: unknown) {
            persistenceFailure = classifySearchFailure(persistErr, {
              operation: "persistSearchOpportunities",
            });
            console.error("[SearchAPI] Persistence Error:", persistErr);
          }
        }

        // 7. Check User Saved Opportunities
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

        // 8. Structure UI Response Payload
        const structuredResults = await Promise.all(
          rankedOpportunities.map(async (item) => {
            let isSaved = false;
            let persistedId = item.opportunity.canonicalHash;
            if (userId) {
              try {
                const record = await prisma.opportunity.findUnique({
                  where: { canonicalHash: item.opportunity.canonicalHash },
                  select: { id: true },
                });
                if (record) {
                  persistedId = record.id;
                  isSaved = userSavedOpportunityIds.has(record.id);
                }
              } catch {}
            }

            const daysAgo = item.opportunity.postedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(item.opportunity.postedAt).getTime()) / (24 * 3600 * 1000)))
              : null;

            const enrichment = await enrichOpportunityData({
              opportunityId: persistedId,
              canonicalHash: item.opportunity.canonicalHash,
              companyName: item.opportunity.companyName,
              title: item.opportunity.title,
              primaryApplyUrl: item.opportunity.primaryApplyUrl,
            });

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
              companyContacts: enrichment.companyContacts,
              companyEmployeesCount: enrichment.companyEmployeesCount,
              shareUrl: enrichment.shareUrl,
              socialShareUrls: enrichment.socialShareUrls,
              companyProfile: enrichment.companyProfile,
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
              matchType: item.matchType,
              matchBadge: item.matchBadge,
              saved: isSaved,
            };
          })
        );

        const verifiedCount = structuredResults.length;
        const effectiveRequestedCount = canonicalIntent.requestedCount || requestedCount;
        const isComplete = verifiedCount >= effectiveRequestedCount;
        const isPartial = verifiedCount > 0 && verifiedCount < effectiveRequestedCount;

        const status = effectivelyCancelled ? "STOPPED" : isComplete ? "COMPLETE" : isPartial ? "PARTIAL" : "NO_RESULTS";
        const partial = isPartial || effectivelyCancelled;

        let stoppingReason = "TARGET_SATISFIED";
        if (effectivelyCancelled) {
          stoppingReason = "CANCELLED";
        } else if (isComplete) {
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

        let explanation = "";
        const roleName = canonicalIntent.roles?.[0] || canonicalIntent.role || "opportunity";
        if (effectivelyCancelled) {
          explanation = "Search execution was cancelled by user request.";
        } else if (isComplete) {
          explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria.`;
        } else if (isPartial) {
          const shortfall = effectiveRequestedCount - verifiedCount;
          explanation = `Found ${verifiedCount} verified ${roleName} opportunities matching your criteria. ${shortfall} additional opportunities could not be verified within the requested window.`;
        } else {
          explanation = `No verified ${roleName} opportunities found matching your criteria.`;
        }

        if (persistToDb) {
          const dbStatus = effectivelyCancelled ? "STOPPED" : isComplete ? "COMPLETED" : isPartial ? "PARTIAL" : "COMPLETED";
          await executionLifecycleManager.transitionState(executionId, dbStatus as any, {
            totalFound: verifiedCount,
            stoppingReason,
            cancellationRequested: effectivelyCancelled,
            completedAt: new Date(),
          }).catch(() => {});
        }

        return {
          searchId: executionId,
          correlationId,
          status,
          error: effectivelyCancelled ? "CANCELLED" : undefined,
          stoppingReason,
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
            requestedSources: harnessResult.telemetry.requestedSources || canonicalIntent.sources || [],
            eligibleSources: harnessResult.telemetry.eligibleSources || canonicalIntent.sources || [],
            attemptedSources: harnessResult.telemetry.attemptedSources || [],
            successfulSources: harnessResult.telemetry.successfulSources || [],
            failedSources: harnessResult.telemetry.failedSources || [],
            skippedSources: harnessResult.telemetry.skippedSources || [],
            sourcesWithNoMatches: harnessResult.telemetry.sourcesWithNoMatches || [],
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
      } finally {
        executionLifecycleManager.unregisterExecution(executionId);
      }
    })();

    executionLifecycleManager.registerExecution(
      executionId,
      userId,
      canonicalIntentHash,
      executionAbort,
      executionPromise
    );

    const finalResult = await executionPromise;
    const isCancelledFinal = finalResult.status === "STOPPED" || finalResult.error === "CANCELLED";

    const response = NextResponse.json(finalResult, { status: 200 });
    response.headers.set("x-correlation-id", correlationId);
    response.headers.set("x-execution-id", executionId);
    try {
      telemetryEngine.recordRequest({
        method: "POST",
        path: "/api/search",
        statusCode: 200,
        latencyMs: Math.round(performance.now() - requestStart),
      });
    } catch {}
    return response;
  } catch (err: unknown) {
    console.error("[SearchAPI] Execution Error:", err);
    const failure = classifySearchFailure(err, { operation: "searchRoute" });
    const isCancelled = failure.category === "CANCELLED" || request.signal?.aborted;

    if (executionId && persistToDb) {
      const targetState = isCancelled ? "STOPPED" : "FAILED";
      await executionLifecycleManager.transitionState(executionId, targetState as any, {
        failureReason: failure.userMessage || String(err),
        stoppingReason: isCancelled ? "CANCELLED" : "EXECUTION_ERROR",
        completedAt: new Date(),
      }).catch(() => {});
    } else if (isCancelled && userId) {
      try {
        await createSearch({
          userId: userId || null,
          rawQuery: rawQuery || "Cancelled Search",
          intentType: "JOB_SEARCH_GENERAL",
          status: "STOPPED",
          totalFound: 0,
        }).catch(() => {});
      } catch {}
    }

    const statusCode =
      failure.category === "AUTH_REQUIRED"
        ? 401
        : failure.category === "RATE_LIMITED"
        ? 429
        : isCancelled
        ? 499
        : 500;

    try {
      telemetryEngine.recordRequest({
        method: "POST",
        path: "/api/search",
        statusCode,
        latencyMs: Math.round(performance.now() - requestStart),
      });
    } catch {}

    return NextResponse.json(
      {
        error: isCancelled ? "CANCELLED" : failure.category,
        message: isCancelled ? "Search was cancelled by user request." : failure.userMessage,
        category: isCancelled ? "CANCELLED" : failure.category,
        retryable: isCancelled ? true : failure.retryable,
        stoppingReason: isCancelled ? "CANCELLED" : undefined,
      },
      { status: statusCode }
    );
  }
}
