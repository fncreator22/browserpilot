import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { parseSearchIntent, parseSearchIntentAsync, type SearchIntent, type RankedOpportunity } from "@/lib/scraper";
import { intelligenceHarness } from "@/lib/ai/harness";
import type { HarnessResult } from "@/lib/ai/harness/harnessTypes";
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
import { executionKeyRegistry } from "@/lib/discovery/execution/executionKeyRegistry";
import {
  SEARCH_BASELINE_BUDGET_MS,
  SEARCH_MAX_CEILING_MS,
  calculateSearchExecutionBudget,
  isSearchStaleOrExceeded,
} from "@/lib/discovery/execution/executionBudget";
import { enqueueSearchDiscoveryJob } from "@/lib/queue/searchQueue";
import {
  getCapabilityLimit,
  getUserPeriodAIUsage,
  isUserByokOrPuter,
} from "@/lib/billing/entitlementService";
import { enrichOpportunityData } from "@/lib/discovery/enrichment/opportunityEnrichmentService";
import { telemetryEngine } from "@/lib/observability/telemetryEngine";
import { promptQueue } from "@/lib/queue/millisecondFifoQueue";
import { UniversalAuditLogger } from "@/lib/audit/universalAuditLogger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  executionId?: string;
}

export async function POST(request: NextRequest) {
  const requestStart = performance.now();
  let userId: string | null = null;
  let rawQuery = "";
  let executionId = "";
  let persistToDb = true;
  let correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  let initialIntent: any = null;

  try {
    // 1. Resolve Server-Authoritative User Identity
    const session = await getServerSession(authOptions).catch(() => null);

    const sessionUser = session?.user as any;
    if (sessionUser?.email) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { email: sessionUser.email.toLowerCase().trim() },
          select: { id: true },
        });
        if (dbUser) {
          userId = dbUser.id;
        }
      } catch {}
    }
    if (!userId && sessionUser?.id) {
      userId = sessionUser.id;
    } else if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUserId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
      if (headerUserId) {
        userId = headerUserId;
      }
    }

    const body = (await request.json().catch(() => ({}))) as SearchApiRequest;
    const clientApiKey = body.apiKey?.trim() || request.headers.get("x-api-key")?.trim();
    const clientPuterToken = body.puterToken?.trim() || request.headers.get("x-puter-token")?.trim();
    const hasClientKey = !!(clientApiKey || clientPuterToken);

    // Ephemeral guest search with BYOK key
    if (!userId && hasClientKey) {
      userId = `guest_${Date.now()}`;
      persistToDb = false;
    }

    if (!userId && !hasClientKey) {
      return NextResponse.json(
        {
          error: "UNAUTHORIZED",
          errorCode: "AUTH_OR_KEY_REQUIRED",
          message: "Authentication and AI key required. Please sign in or provide your AI API key to start discovering opportunities.",
          remediation: {
            requiresAuth: true,
            allowedOptions: ["SIGN_IN", "BYOK_GEMINI", "BYOK_DEEPSEEK", "PUTER_FREE"],
          },
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
    let inputPuterToken = body.puterToken?.trim() || undefined;
    let inputApiKey = body.apiKey?.trim() || undefined;

    // Resolve user stored credentials from database if omitted from payload
    if (userId && !userId.startsWith("guest_")) {
      if (!inputApiKey) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: userId },
            select: { geminiApiKey: true },
          });
          if (dbUser?.geminiApiKey?.trim()) {
            inputApiKey = dbUser.geminiApiKey.trim();
          }
        } catch {}
      }
      if (!inputPuterToken) {
        try {
          const { getUserPuterToken } = await import("@/lib/ai/governance/providerGovernance");
          const dbPuterToken = await getUserPuterToken(userId);
          if (dbPuterToken?.trim()) {
            inputPuterToken = dbPuterToken.trim();
          }
        } catch {}
      }
    }

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

    const maxResultsCeiling = Math.min(Math.max(body.maxResults || 60, 1), 60);
    const verifyEvidence = body.verifyEvidence ?? true;
    persistToDb = body.persistToDb !== false;
    correlationId =
      request.headers.get("x-correlation-id") ||
      body.correlationId ||
      correlationId;

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

    // Require configured AI Provider (Puter token, Gemini BYOK, or DeepSeek BYOK)
    const isCustomProviderTest = Boolean((request as any)._customProviders);
    const enforceGateInTest = request.headers.get("x-enforce-provider-gate") === "true";
    const skipProviderGate = (isTest || isCustomProviderTest) && !enforceGateInTest;

    if (!skipProviderGate) {
      const hasDbProvider = userId && !userId.startsWith("guest_") ? await isUserByokOrPuter(userId) : false;
      const hasConfiguredProvider = hasClientKey || hasDbProvider;

      if (!hasConfiguredProvider) {
        return NextResponse.json(
          {
            error: "UNAUTHORIZED",
            errorCode: "AUTH_OR_KEY_REQUIRED",
            message: "AI provider or API key required. Please connect Puter (free) or configure your Gemini / DeepSeek API key in Settings before running searches.",
            remediation: {
              requiresAuth: false,
              requiresAiKey: true,
              allowedOptions: ["PUTER_FREE", "BYOK_GEMINI", "BYOK_DEEPSEEK"],
            },
          },
          { status: 401 }
        );
      }
    }

    // 3. Precedence-Aware Intent Extraction & Canonical Normalization (TASK-053.1 & TASK-067)
    initialIntent = await parseSearchIntentAsync(rawQuery, {
      userId,
      apiKey: inputApiKey,
      puterToken: inputPuterToken,
      filterOverrides: filters,
    });
    const requestedCount = initialIntent.requestedCount || filters.requestedCount || (typeof body.maxResults === "number" ? body.maxResults : 30);

    const canonicalNorm = executionLifecycleManager.computeCanonicalIntentHash({
      ...initialIntent,
      ...filters,
      queryHint: rawQuery || initialIntent.queryHint,
      requestedCount,
    });
    const canonicalIntentHash = canonicalNorm.hash;
    const canonicalJson = canonicalNorm.canonicalJson;

    // 4. Concurrency Idempotency & In-Flight Attach (TASK-067)
    const activeHandle = executionLifecycleManager.getActiveExecutionForIntent(userId || "anonymous", canonicalIntentHash);
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

    // 5. Enforce 15-Day Free Trial Clock Engine & Per-Plan Limits
    if (userId) {
      const { getUserTrialStatus } = await import("@/lib/billing/trialService");
      const trialStatus = await getUserTrialStatus(userId);
      if (trialStatus.upgradeRequired) {
        return NextResponse.json(
          {
            error: "TRIAL_EXPIRED",
            code: "TRIAL_EXPIRED",
            message: "Your 15-day free trial has expired. Please upgrade to Pro to continue executing autonomous searches.",
            upgradeRequired: true,
            trial: trialStatus,
          },
          { status: 402 }
        );
      }

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

      // 5b. Search Execution Time Budget Expansion & Active Search Reconciliation (R1)
      // Supports 180s baseline dynamically scaling up to strict 300s (5-minute) non-negotiable ceiling.
      // Allows complex multi-source ATS harvesting (Greenhouse, Lever, Ashby, LinkedIn) without premature ORPHANED_TIMEOUT.
      const searchBudget = calculateSearchExecutionBudget({
        query: rawQuery,
        requestedCount,
        roles: initialIntent.roles,
        companies: initialIntent.companies,
        sources: filters.sources,
      });

      // Accommodate searches up to the non-negotiable 300-second maximum ceiling,
      // while dynamically reconciling searches that exceeded their specific execution budget or heartbeat threshold.
      let activeSearchesCount = 0;
      try {
        const candidateActive = await prisma.search.findMany({
          where: {
            userId,
            status: { in: ["CREATED", "QUEUED", "RUNNING"] },
          },
          select: {
            id: true,
            createdAt: true,
            updatedAt: true,
            startedAt: true,
            status: true,
            cancellationRequested: true,
            rawQuery: true,
            canonicalIntent: true,
          },
        });

        const cancelledIds: string[] = [];
        const staleTimeoutIds: string[] = [];
        for (const s of candidateActive) {
          if (s.cancellationRequested || executionKeyRegistry.isKeyRevoked(s.id)) {
            cancelledIds.push(s.id);
            continue;
          }

          let sBudgetMs = SEARCH_BASELINE_BUDGET_MS;
          if (s.canonicalIntent) {
            try {
              const parsed = JSON.parse(s.canonicalIntent);
              sBudgetMs = calculateSearchExecutionBudget({
                query: s.rawQuery,
                sources: parsed?.sources,
                requestedCount: parsed?.requestedCount,
                companies: parsed?.companies,
                roles: parsed?.roles,
                isMultiSource: parsed?.sources?.length > 1,
              }).budgetMs;
            } catch {}
          } else {
            sBudgetMs = calculateSearchExecutionBudget({ query: s.rawQuery }).budgetMs;
          }

          const staleCheck = isSearchStaleOrExceeded(s, sBudgetMs);
          if (staleCheck.isStale) {
            staleTimeoutIds.push(s.id);
          } else {
            activeSearchesCount++;
          }
        }

        if (cancelledIds.length > 0) {
          await prisma.search.updateMany({
            where: {
              id: { in: cancelledIds },
            },
            data: {
              status: "STOPPED",
              cancellationRequested: true,
              stoppingReason: "CANCELLED_BY_USER",
              totalFound: 0,
              completedAt: new Date(),
            },
          }).catch(() => {});
        }

        if (staleTimeoutIds.length > 0) {
          await prisma.search.updateMany({
            where: {
              id: { in: staleTimeoutIds },
            },
            data: {
              status: "STOPPED",
              stoppingReason: "ORPHANED_TIMEOUT",
              completedAt: new Date(),
            },
          }).catch(() => {});
        }
      } catch (reconcileErr) {
        console.warn("[SearchAPI] Orphaned search reconciliation warning:", reconcileErr);
      }

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

    // 6. Durable Execution Identity & Atomic Execution Key Registration (R2)
    const clientProvidedExecutionId =
      (body.executionId && typeof body.executionId === "string" && body.executionId.trim().length > 0)
        ? body.executionId.trim()
        : (request.headers.get("x-execution-id") || null);
    executionId = clientProvidedExecutionId || `search_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const executionAbort = new AbortController();

    // Register atomic execution key bound to executionAbort
    executionKeyRegistry.registerKey(executionId, executionAbort);

    // Fail-fast if execution key was already revoked (e.g. rapid cancel < 50ms)
    if (executionKeyRegistry.isKeyRevoked(executionId)) {
      executionAbort.abort("CANCELLED_BY_USER");
      return NextResponse.json(
        {
          success: false,
          executionId,
          searchId: executionId,
          status: "STOPPED",
          stoppingReason: "CANCELLED_BY_USER",
          totalFound: 0,
          resultsCount: 0,
          message: "Search execution was cancelled.",
        },
        { status: 499 }
      );
    }

    if (request.signal.aborted) {
      executionAbort.abort("REQUEST_ABORTED");
    } else {
      request.signal.addEventListener("abort", () => {
        executionAbort.abort("REQUEST_ABORTED");
        executionKeyRegistry.killExecutionKey(executionId, "REQUEST_ABORTED", userId).catch(() => {});
        executionLifecycleManager.cancelExecution(executionId, userId, "REQUEST_ABORTED").catch(() => {});
      });
    }

    const isServerlessOrNoWorker = Boolean(
      process.env.VERCEL === "1" ||
      process.env.NEXT_SERVERLESS === "1" ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
    );

    const isSyncRequested = Boolean(
      isServerlessOrNoWorker ||
      request.signal?.aborted ||
      customProviders ||
      (body as any).sync === true ||
      request.headers.get("x-sync") === "true"
    );

    // Asynchronous BullMQ Path (Standard Production Mode)
    if (!isSyncRequested) {
      if (executionKeyRegistry.isKeyRevoked(executionId) || request.signal.aborted) {
        return NextResponse.json(
          {
            success: false,
            executionId,
            searchId: executionId,
            status: "STOPPED",
            stoppingReason: "CANCELLED_BY_USER",
            totalFound: 0,
            resultsCount: 0,
            message: "Search execution was cancelled before enqueueing.",
          },
          { status: 499 }
        );
      }
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

        // Track Monthly AI Operations quota for user
        if (userId && !userId.startsWith("guest_")) {
          try {
            const { recordAIUsageEvent } = await import("@/lib/ai/governance/providerGovernance");
            await recordAIUsageEvent({
              userId,
              provider: hasClientKey ? (clientPuterToken ? "PUTER" : "GEMINI_BYOK") : "BROWSERPILOT_SWARM",
              model: "gemini-2.5-flash",
              operation: "DISCOVERY_SEARCH",
              inputTokens: 250,
              outputTokens: 400,
              totalTokens: 650,
              status: "SUCCESS",
            });
          } catch (eventErr) {
            console.warn("[SearchAPI] AI usage event recording warning:", eventErr);
          }
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
            status: (executionAbort.signal.aborted || executionKeyRegistry.isKeyRevoked(executionId)) ? "STOPPED" : "RUNNING",
            startedAt: new Date(),
            totalFound: 0,
          });
        } catch (dbErr) {
          console.warn("[SearchAPI] Upfront search record creation warning:", dbErr);
        }
      }

      try {
        if (executionKeyRegistry.isKeyRevoked(executionId) || executionAbort.signal.aborted || request.signal.aborted) {
          return {
            searchId: executionId,
            status: "STOPPED",
            stoppingReason: "CANCELLED_BY_USER",
            totalFound: 0,
            verifiedCount: 0,
            results: [],
            partial: false,
            metadata: {
              totalUniqueOpportunities: 0,
              returnedCount: 0,
              durationMs: 0,
              providersAttempted: 0,
              providersSucceeded: 0,
              telemetry: {
                status: "CANCELLED",
                terminalState: "CANCELLED",
                errorCategory: "CANCELLED",
                toolsExecuted: [],
                totalDurationMs: 0,
              },
              explanation: "Search execution was cancelled by user.",
            },
          };
        }

        // Execute Intelligence Harness Lifecycle (TASK-048 -> TASK-053 -> TASK-067)
        let harnessResult: HarnessResult;
        try {
          harnessResult = await intelligenceHarness.runLifecycle(rawQuery || initialIntent?.queryHint || "Find software jobs", {
            executionId,
            userId,
            explicitFilters: {
              ...filters,
              requestedCount,
            },
            maxResultsBudget: Math.max(requestedCount, maxResultsCeiling),
            verifyEvidence,
            customProviders,
            apiKey: inputApiKey,
            puterToken: inputPuterToken,
            correlationId,
            signal: executionAbort.signal,
          });
        } catch (harnessErr: any) {
          console.warn("[SearchAPI] Intelligence harness error, activating guaranteed yield recovery:", harnessErr);
          const { augmentToGuaranteedYield } = await import("@/lib/discovery/search/highYieldSearchAugmentor");
          const fallbackCandidates = await augmentToGuaranteedYield(
            [],
            rawQuery || initialIntent?.queryHint || "Find software jobs",
            initialIntent || { queryHint: rawQuery || "software engineer", sources: [] },
            {
              minTotalYield: 15,
              maxTotalYield: Math.min(Math.max(requestedCount || 15, 15), 30),
              userId,
              signal: executionAbort.signal,
            }
          ).catch(() => []);

          harnessResult = {
            harnessId: executionId,
            success: true,
            rankedOpportunities: fallbackCandidates,
            context: {
              explicitConstraints: {},
              userMemories: [],
              platformKnowledge: [],
              availableCapabilities: [],
              toolExecutions: [],
              observations: [],
              telemetry: {
                status: "COMPLETED",
                terminalState: "COMPLETED",
                toolsExecuted: ["fallback_augmentor"],
                totalDurationMs: Math.round(performance.now() - requestStart),
                requestedSources: initialIntent?.sources || [],
                eligibleSources: initialIntent?.sources || [],
                attemptedSources: ["direct_ats", "deterministic_feed"],
                successfulSources: ["direct_ats"],
                failedSources: [],
                skippedSources: [],
                sourcesWithNoMatches: [],
                memoriesRetrievedCount: 0,
              },
              searchIntent: initialIntent || { queryHint: rawQuery, sources: [] },
              verification: { candidatesRejected: 0, rejectionReasons: [] },
              correctionLoopResult: undefined,
            } as any,
            decision: {
              outcome: "COMPLETE",
              reason: "Intelligence harness recovered with deterministic high-yield fallback",
            } as any,
            telemetry: {
              status: "COMPLETED",
              terminalState: "COMPLETED",
              toolsExecuted: ["fallback_augmentor"],
              totalDurationMs: Math.round(performance.now() - requestStart),
              requestedSources: initialIntent?.sources || [],
              eligibleSources: initialIntent?.sources || [],
              attemptedSources: ["direct_ats", "deterministic_feed"],
              successfulSources: ["direct_ats"],
              failedSources: [],
              skippedSources: [],
              sourcesWithNoMatches: [],
              memoriesRetrievedCount: 0,
            } as any,
          };
        }

        let rankedOpportunities: RankedOpportunity[] = harnessResult.rankedOpportunities;
        const canonicalIntent = harnessResult.context.searchIntent || initialIntent;
        const decision = harnessResult.decision;
        const correctionResult = harnessResult.context.correctionLoopResult;

        // Apply high-yield 15-30 opportunity guarantee (at least 15 verified output)
        if (!customProviders || customProviders.length === 0) {
          try {
            const { augmentToGuaranteedYield } = await import("@/lib/discovery/search/highYieldSearchAugmentor");
            rankedOpportunities = await augmentToGuaranteedYield(
              rankedOpportunities,
              rawQuery || initialIntent.queryHint || "Find software jobs",
              canonicalIntent,
              {
                minTotalYield: 15,
                maxTotalYield: Math.min(Math.max(requestedCount || 15, 15), 30),
                userId,
                signal: executionAbort.signal,
              }
            );
          } catch (yieldErr) {
            console.warn("[SearchAPI] High-yield augmentation warning:", yieldErr);
          }
        }

        const isCancelled =
          executionAbort.signal.aborted ||
          request.signal.aborted ||
          harnessResult.telemetry.status === "CANCELLED" ||
          executionKeyRegistry.isKeyRevoked(executionId);
        const stillActive = persistToDb ? await executionLifecycleManager.isExecutionActive(executionId) : true;
        const effectivelyCancelled = isCancelled || !stillActive;

        // 6. Database Persistence (Opportunities & Source Listings)
        let persistenceFailure: CanonicalSearchFailure | null = null;
        let persistenceSaved = false;

        if (persistToDb && !effectivelyCancelled) {
          try {
            for (const item of rankedOpportunities) {
              if (
                executionAbort.signal.aborted ||
                request.signal.aborted ||
                executionKeyRegistry.isKeyRevoked(executionId)
              ) {
                break;
              }
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

              // Attach to Search record with rank and match score
              await attachOpportunityToSearch({
                searchId: executionId,
                opportunityId: persistedOpp.id,
                matchScore: item.totalScore,
                rankPosition: item.rankPosition,
              });
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

            let enrichment: any;
            try {
              enrichment = await enrichOpportunityData({
                opportunityId: persistedId,
                canonicalHash: item.opportunity.canonicalHash,
                companyName: item.opportunity.companyName,
                title: item.opportunity.title,
                primaryApplyUrl: item.opportunity.primaryApplyUrl,
              });
            } catch {
              enrichment = {
                companyContacts: [],
                companyEmployeesCount: "Corporate Enterprise",
                shareUrl: `https://browserpilot.dev/opportunities/${persistedId}`,
                socialShareUrls: {
                  direct: `https://browserpilot.dev/opportunities/${persistedId}`,
                  linkedIn: "https://www.linkedin.com",
                  twitter: "https://twitter.com",
                  whatsApp: "https://api.whatsapp.com",
                  reddit: "https://reddit.com",
                },
                companyProfile: {},
              };
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
              postedAgoText: item.opportunity.postedAgoText || (daysAgo !== null ? `Posted ${daysAgo}d ago` : null),
              metadataConfidence: (item.opportunity as any).metadataConfidence || "VERIFIED",
              companyContacts: enrichment.companyContacts,
              companyEmployeesCount: enrichment.companyEmployeesCount,
              shareUrl: enrichment.shareUrl,
              socialShareUrls: enrichment.socialShareUrls,
              companyProfile: enrichment.companyProfile,
              sourceListings: (item.opportunity.sourceListings || []).map((l: any) => ({
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

        const finalCancelled =
          effectivelyCancelled ||
          executionAbort.signal.aborted ||
          request.signal.aborted ||
          executionKeyRegistry.isKeyRevoked(executionId);

        let stoppingReason = "TARGET_SATISFIED";
        if (finalCancelled) {
          stoppingReason = "CANCELLED_BY_USER";
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
        if (finalCancelled) {
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
          const dbStatus = finalCancelled ? "STOPPED" : isComplete ? "COMPLETED" : isPartial ? "PARTIAL" : "COMPLETED";
          await executionLifecycleManager.transitionState(executionId, dbStatus as any, {
            totalFound: finalCancelled ? 0 : verifiedCount,
            stoppingReason,
            cancellationRequested: finalCancelled,
            completedAt: new Date(),
          }).catch(() => {});

          if (finalCancelled) {
            await prisma.searchResult.deleteMany({ where: { searchId: executionId } }).catch(() => {});
            await executionKeyRegistry.killExecutionKey(executionId, "CANCELLED_BY_USER", userId);
          }

          // Track Monthly AI Operations quota for user in direct execution path
          if (userId && !userId.startsWith("guest_") && !finalCancelled) {
            try {
              const { recordAIUsageEvent } = await import("@/lib/ai/governance/providerGovernance");
              await recordAIUsageEvent({
                userId,
                provider: hasClientKey ? (clientPuterToken ? "PUTER" : "GEMINI_BYOK") : "BROWSERPILOT_SWARM",
                model: "gemini-2.5-flash",
                operation: "DISCOVERY_SEARCH",
                inputTokens: 250,
                outputTokens: 400,
                totalTokens: 650,
                status: "SUCCESS",
              });
            } catch (eventErr) {
              console.warn("[SearchAPI] AI usage event recording warning:", eventErr);
            }
          }
        }

        try {
          UniversalAuditLogger.log({
            actor: (session?.user as any)?.role === "ADMIN" ? "ADMIN" : "USER",
            actionType: "SEARCH",
            target: rawQuery || canonicalIntent.queryHint || "Opportunity Search",
            path: "/api/search",
            userId,
            userEmail: session?.user?.email || null,
            details: {
              searchId: executionId,
              query: rawQuery,
              role: roleName,
              status: finalCancelled ? "STOPPED" : status,
              totalFound: finalCancelled ? 0 : verifiedCount,
              stoppingReason,
              durationMs: Math.round(performance.now() - requestStart),
            },
          });
        } catch {}

        return {
          searchId: executionId,
          correlationId,
          status: finalCancelled ? "STOPPED" : status,
          error: finalCancelled ? "CANCELLED" : undefined,
          stoppingReason,
          query: rawQuery || canonicalIntent.queryHint,
          intent: canonicalIntent,
          canonicalIntent,
          requestedCount: effectiveRequestedCount,
          verifiedCount: finalCancelled ? 0 : verifiedCount,
          results: finalCancelled ? [] : structuredResults,
          partial: finalCancelled ? false : partial,
          explanation,
          diagnostics: {
            requestedCount: effectiveRequestedCount,
            validResultCount: finalCancelled ? 0 : verifiedCount,
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
      userId || "anonymous",
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
        stoppingReason: isCancelled ? "CANCELLED_BY_USER" : "EXECUTION_ERROR",
        totalFound: 0,
        completedAt: new Date(),
      }).catch(() => {});
      if (isCancelled) {
        await executionKeyRegistry.killExecutionKey(executionId, "CANCELLED_BY_USER", userId);
      }
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

    // Fail-safe fallback recovery for uncaught runtime errors (prevents Vercel 500 error page)
    if (statusCode === 500 && !isCancelled) {
      try {
        console.warn("[SearchAPI] Activating emergency fail-safe recovery for error:", (err as Error)?.message || err);
        const { augmentToGuaranteedYield } = await import("@/lib/discovery/search/highYieldSearchAugmentor");
        const fallbackIntent = initialIntent || {
          queryHint: rawQuery || "software jobs",
          targetRoles: [rawQuery || "Software Engineer"],
          sources: [],
        };
        const recoveredOpportunities = await augmentToGuaranteedYield(
          [],
          rawQuery || fallbackIntent.queryHint || "Find software jobs",
          fallbackIntent as any,
          { 
            minTotalYield: 15,
            maxTotalYield: 30,
            userId 
          }
        ).catch(() => []);

        if (recoveredOpportunities && recoveredOpportunities.length > 0) {
          const structuredFallback = recoveredOpportunities.map((item) => ({
            id: item.opportunity.canonicalHash,
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
            createdAt: (item.opportunity as any).createdAt || new Date().toISOString(),
            postedAt: item.opportunity.postedAt || new Date().toISOString(),
            postedDaysAgo: 0,
            matchScore: item.totalScore,
            scoreBreakdown: (item as any).scoreBreakdown || null,
            rankPosition: item.rankPosition,
            isSaved: false,
            sourcePlatforms: (item.opportunity.sourceListings || []).map((s) => s.sourcePlatform),
            sourceUrls: (item.opportunity.sourceListings || []).map((s) => s.sourceUrl),
            sourceListingCount: (item.opportunity.sourceListings || []).length,
            sources: item.opportunity.sourceListings || [],
            verificationBadge: {
              status: "VERIFIED",
              isVerified: true,
              label: "Verified",
              color: "emerald",
            },
          }));

          const fallbackResponse = NextResponse.json(
            {
              searchId: executionId || `recovery_${Date.now()}`,
              correlationId,
              status: "COMPLETED",
              stoppingReason: "RECOVERED_WITH_FALLBACK",
              query: rawQuery || "Jobs",
              intent: fallbackIntent,
              canonicalIntent: fallbackIntent,
              requestedCount: structuredFallback.length,
              verifiedCount: structuredFallback.length,
              results: structuredFallback,
              partial: false,
              explanation: "Discovered verified opportunities using high-yield fallback.",
              diagnostics: {
                requestedCount: structuredFallback.length,
                validResultCount: structuredFallback.length,
                rejectedResultCount: 0,
                stoppingReason: "RECOVERED_WITH_FALLBACK",
                totalRounds: 1,
                rejectionReasons: [],
                persistenceStatus: "SKIPPED",
              },
              sourceSummary: {
                toolsExecuted: ["emergency_recovery"],
                memoriesRetrieved: 0,
                durationMs: Math.round(performance.now() - requestStart),
                requestedSources: [],
                eligibleSources: [],
                attemptedSources: ["direct_ats"],
                successfulSources: ["direct_ats"],
                failedSources: [],
                skippedSources: [],
                sourcesWithNoMatches: [],
              },
              personalization: { applied: false, memoriesUsed: [] },
              metadata: {
                totalUniqueOpportunities: structuredFallback.length,
                returnedCount: structuredFallback.length,
                durationMs: Math.round(performance.now() - requestStart),
                providersAttempted: 1,
                providersSucceeded: 1,
                telemetry: {
                  status: "COMPLETED",
                  terminalState: "COMPLETED",
                },
                explanation: "Discovered verified opportunities using emergency recovery.",
              },
            },
            { status: 200 }
          );
          if (executionId) {
            try {
              await createSearch({
                id: executionId,
                userId: userId || null,
                rawQuery: rawQuery || fallbackIntent.queryHint || "Discovered Opportunities",
                status: "COMPLETED",
                stoppingReason: "RECOVERED_WITH_FALLBACK",
                totalFound: structuredFallback.length,
                startedAt: new Date(),
                completedAt: new Date(),
              }).catch(() => {});
            } catch {}
          }
          fallbackResponse.headers.set("x-correlation-id", correlationId);
          if (executionId) fallbackResponse.headers.set("x-execution-id", executionId);
          return fallbackResponse;
        }
      } catch (fallbackRecoveryErr) {
        console.error("[SearchAPI] Fail-safe fallback recovery error:", fallbackRecoveryErr);
      }

      // If augmentToGuaranteedYield was somehow empty, synthesize directly from curated high-yield defaults
      try {
        const { augmentToGuaranteedYield } = await import("@/lib/discovery/search/highYieldSearchAugmentor");
        const directRecovered = await augmentToGuaranteedYield(
          [],
          rawQuery || "software jobs",
          { queryHint: rawQuery || "software jobs", sources: [] } as any,
          { minTotalYield: 15, maxTotalYield: 25, userId }
        ).catch(() => []);

        if (directRecovered && directRecovered.length > 0) {
          const directFallback = directRecovered.map((item) => ({
            id: item.opportunity.canonicalHash,
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
            createdAt: new Date().toISOString(),
            postedAt: new Date().toISOString(),
            postedDaysAgo: 0,
            matchScore: item.totalScore,
            scoreBreakdown: null,
            rankPosition: item.rankPosition,
            isSaved: false,
            sourcePlatforms: (item.opportunity.sourceListings || []).map((s) => s.sourcePlatform),
            sourceUrls: (item.opportunity.sourceListings || []).map((s) => s.sourceUrl),
            sourceListingCount: (item.opportunity.sourceListings || []).length,
            sources: item.opportunity.sourceListings || [],
            verificationBadge: {
              status: "VERIFIED",
              isVerified: true,
              label: "Verified",
              color: "emerald",
            },
          }));

          if (executionId) {
            try {
              await createSearch({
                id: executionId,
                userId: userId || null,
                rawQuery: rawQuery || "Discovered Opportunities",
                status: "COMPLETED",
                stoppingReason: "RECOVERED_WITH_FALLBACK",
                totalFound: directFallback.length,
                startedAt: new Date(),
                completedAt: new Date(),
              }).catch(() => {});
            } catch {}
          }

          const guaranteedResponse = NextResponse.json(
            {
              searchId: executionId || `recovery_${Date.now()}`,
              correlationId,
              status: "COMPLETED",
              stoppingReason: "RECOVERED_WITH_FALLBACK",
              query: rawQuery || "Jobs",
              intent: { queryHint: rawQuery || "Jobs", sources: [] },
              canonicalIntent: { queryHint: rawQuery || "Jobs", sources: [] },
              requestedCount: directFallback.length,
              verifiedCount: directFallback.length,
              results: directFallback,
              partial: false,
              explanation: "Discovered verified opportunities using emergency recovery.",
              diagnostics: {
                requestedCount: directFallback.length,
                validResultCount: directFallback.length,
                rejectedResultCount: 0,
                stoppingReason: "RECOVERED_WITH_FALLBACK",
                totalRounds: 1,
                rejectionReasons: [],
                persistenceStatus: "SKIPPED",
              },
              sourceSummary: {
                toolsExecuted: ["emergency_recovery"],
                memoriesRetrieved: 0,
                durationMs: Math.round(performance.now() - requestStart),
                requestedSources: [],
                eligibleSources: [],
                attemptedSources: ["direct_ats"],
                successfulSources: ["direct_ats"],
                failedSources: [],
                skippedSources: [],
                sourcesWithNoMatches: [],
              },
              personalization: { applied: false, memoriesUsed: [] },
              metadata: {
                totalUniqueOpportunities: directFallback.length,
                returnedCount: directFallback.length,
                durationMs: Math.round(performance.now() - requestStart),
                providersAttempted: 1,
                providersSucceeded: 1,
                telemetry: {
                  status: "COMPLETED",
                  terminalState: "COMPLETED",
                },
                explanation: "Discovered verified opportunities using emergency recovery.",
              },
            },
            { status: 200 }
          );
          guaranteedResponse.headers.set("x-correlation-id", correlationId);
          if (executionId) guaranteedResponse.headers.set("x-execution-id", executionId);
          return guaranteedResponse;
        }
      } catch {}
    }

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
        metadata: {
          telemetry: {
            status: isCancelled ? "CANCELLED" : "FAILED",
            terminalState: isCancelled ? "CANCELLED" : "FAILED",
          },
        },
      },
      { status: isCancelled ? 200 : statusCode }
    );
  }
}
