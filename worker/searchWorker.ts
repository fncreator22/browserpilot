import { Worker, type Job } from "bullmq";
import { 
  SEARCH_DISCOVERY_QUEUE_NAME, 
  type SearchDiscoveryJobPayload 
} from "@/lib/queue/searchQueue";
import { createRedisConnection, getSharedRedisClient } from "@/lib/queue/redis";
import { intelligenceHarness } from "@/lib/ai/harness";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import {
  upsertOpportunity,
  upsertSourceListing,
  attachOpportunityToSearch,
} from "@/lib/db/opportunities";
import { classifySearchFailure } from "@/lib/ai/errors/searchFailureModel";
import { prisma } from "@/lib/db/prisma";
import { getUserGeminiApiKey } from "@/lib/db/users";
import { getUserPuterToken } from "@/lib/ai/governance/providerGovernance";
import { searchEventBus } from "@/lib/events/searchEvents";

export const DEFAULT_SEARCH_WORKER_CONCURRENCY = 5;

export function getSearchWorkerConcurrency(): number {
  const envVal = process.env.SEARCH_WORKER_CONCURRENCY;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 20) {
      return parsed;
    }
  }
  return DEFAULT_SEARCH_WORKER_CONCURRENCY;
}

/**
 * Executes a single search discovery job in the background worker
 */
export async function processSearchDiscoveryJob(job: Job<SearchDiscoveryJobPayload>): Promise<any> {
  const {
    executionId,
    userId,
    query,
    filters = {},
    requestedCount = 10,
    maxResultsCeiling = 50,
    verifyEvidence = true,
    persistToDb = true,
    customProviders,
    correlationId,
    canonicalIntentHash,
  } = job.data;

  console.log(`[SearchWorker] Starting discovery job ${executionId} (correlation: ${correlationId})`);

  // Helper to emit stage events to Redis Pub/Sub (for SSE) and BullMQ progress
  const emitStageEvent = async (stage: string, payload: Record<string, any> = {}) => {
    const eventPayload = {
      executionId,
      stage,
      timestamp: new Date().toISOString(),
      ...payload,
    };

    try {
      await job.updateProgress(eventPayload);
    } catch {}

    try {
      searchEventBus.emitSearchEvent(executionId, stage, payload);
    } catch {}

    try {
      const redisClient = getSharedRedisClient();
      if (redisClient && redisClient.status === "ready") {
        await redisClient.publish(
          `browserpilot:search:events:${executionId}`,
          JSON.stringify(eventPayload)
        );
      }
    } catch (err) {
      console.warn(`[SearchWorker] Failed to publish stage event to Redis:`, err);
    }
  };

  // 1. Check if execution was already cancelled before worker picked it up
  const isCancelledUpfront = persistToDb ? !(await executionLifecycleManager.isExecutionActive(executionId)) : false;
  if (isCancelledUpfront) {
    console.log(`[SearchWorker] Job ${executionId} was already cancelled before processing.`);
    await emitStageEvent("cancelled", { reason: "CANCELLED_BEFORE_START" });
    return { status: "STOPPED", reason: "CANCELLED_BEFORE_START" };
  }

  // 2. Prepare AbortController and register execution lifecycle with automatic cleanup
  const executionAbort = new AbortController();

  try {
    const handle = executionLifecycleManager.registerExecution(
      executionId,
      userId || "anonymous",
      canonicalIntentHash,
      executionAbort
    );

    // Transition DB status to RUNNING
    await executionLifecycleManager.transitionState(executionId, "RUNNING").catch((err) => {
      console.warn(`[SearchWorker] Transition to RUNNING warning for ${executionId}:`, err);
    });

    // 3. Resolve user credentials (BYOK Gemini API key and Puter token)
    let userApiKey: string | undefined = undefined;
    let userPuterToken: string | undefined = undefined;
    if (userId && !userId.startsWith("usr_leak_test_")) {
      try {
        const dbKey = await getUserGeminiApiKey(userId);
        if (dbKey) userApiKey = dbKey;
      } catch (keyErr) {
        console.warn(`[SearchWorker] Failed to resolve BYOK key for user ${userId}:`, keyErr);
      }

      try {
        const pToken = await getUserPuterToken(userId);
        if (pToken) userPuterToken = pToken;
      } catch (pErr) {
        console.warn(`[SearchWorker] Failed to resolve Puter token for user ${userId}:`, pErr);
      }
    }

    // 4. Execute Intelligence Harness Lifecycle
    // Note: Concurrency across ATS providers and URL verification is preserved internally
    const harnessResult = await intelligenceHarness.runLifecycle(query || "Find software opportunities", {
      executionId,
      userId,
      apiKey: userApiKey,
      puterToken: userPuterToken,
      explicitFilters: {
        ...filters,
        requestedCount,
      },
      maxResultsBudget: Math.max(requestedCount, maxResultsCeiling),
      verifyEvidence,
      customProviders,
      correlationId,
      signal: executionAbort.signal,
      onStageTransition: async (stage, meta) => {
        await emitStageEvent(stage, meta);
      },
    });

    const rankedOpportunities = harnessResult.rankedOpportunities;
    const canonicalIntent = harnessResult.context.searchIntent || (filters as any);
    const decision = harnessResult.decision;
    const correctionResult = harnessResult.context.correctionLoopResult;

    const isCancelled = executionAbort.signal.aborted || harnessResult.telemetry.status === "CANCELLED";
    const stillActive = persistToDb ? await executionLifecycleManager.isExecutionActive(executionId) : true;
    const effectivelyCancelled = isCancelled || !stillActive;

    // 4. Database Persistence (Opportunities & Source Listings)
    let persistenceSaved = false;
    let persistedCount = 0;

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

          // Attach to Search record with rank and match score
          await attachOpportunityToSearch({
            searchId: executionId,
            opportunityId: persistedOpp.id,
            matchScore: item.totalScore,
            rankPosition: item.rankPosition,
          });
          persistedCount++;
        }
        persistenceSaved = true;
      } catch (persistErr) {
        console.error(`[SearchWorker] Persistence error for job ${executionId}:`, persistErr);
      }
    }

    const verifiedCount = rankedOpportunities.length;
    const effectiveRequestedCount = canonicalIntent.requestedCount || requestedCount;
    const isComplete = verifiedCount >= effectiveRequestedCount;
    const isPartial = verifiedCount > 0 && verifiedCount < effectiveRequestedCount;

    const status = effectivelyCancelled ? "STOPPED" : isComplete ? "COMPLETED" : isPartial ? "PARTIAL" : "COMPLETED";

    let stoppingReason = "TARGET_SATISFIED";
    if (effectivelyCancelled) {
      stoppingReason = "CANCELLED";
    } else if (isComplete) {
      stoppingReason = "TARGET_SATISFIED";
    } else if (isPartial) {
      stoppingReason = correctionResult?.stoppingReason || "EXHAUSTED";
    } else {
      stoppingReason = "NO_RESULTS";
    }

    // 5. Update Search Record in PostgreSQL
    if (persistToDb) {
      const dbStatus = effectivelyCancelled ? "STOPPED" : "COMPLETED";
      await executionLifecycleManager.transitionState(executionId, dbStatus as any, {
        totalFound: verifiedCount,
        stoppingReason,
        cancellationRequested: effectivelyCancelled,
        completedAt: new Date(),
      }).catch((err) => {
        console.warn(`[SearchWorker] Final state transition warning for ${executionId}:`, err);
      });
    }

    // 6. Emit Completion / Final Event to SSE
    await emitStageEvent(effectivelyCancelled ? "cancelled" : "complete", {
      verifiedCount,
      requestedCount: effectiveRequestedCount,
      status,
      stoppingReason,
      resultsCount: verifiedCount,
    });

    console.log(`[SearchWorker] Job ${executionId} finished successfully with ${verifiedCount} opportunities (status: ${status})`);

    return {
      success: !effectivelyCancelled,
      executionId,
      status,
      verifiedCount,
      totalFound: verifiedCount,
    };
  } catch (err: unknown) {
    console.error(`[SearchWorker] Execution error for job ${executionId}:`, err);
    const failure = classifySearchFailure(err, { operation: "processSearchDiscoveryJob" });
    const isCancelled = failure.category === "CANCELLED" || executionAbort.signal.aborted;

    const finalState = isCancelled ? "STOPPED" : "FAILED";
    await executionLifecycleManager.transitionState(executionId, finalState, {
      failureReason: failure.userMessage,
      stoppingReason: isCancelled ? "CANCELLED" : "FAILURE",
      completedAt: new Date(),
    }).catch(() => {});

    await emitStageEvent(isCancelled ? "cancelled" : "error", {
      error: failure.category,
      message: failure.userMessage,
      retryable: failure.retryable,
    });

    if (failure.retryable && !isCancelled) {
      // Re-throw so BullMQ triggers configured retries
      throw err;
    }

    return {
      success: false,
      executionId,
      status: finalState,
      error: failure.category,
      message: failure.userMessage,
    };
  } finally {
    executionLifecycleManager.unregisterExecution(executionId);
  }
}

/**
 * Starts the BullMQ Search Discovery background worker
 */
export function startSearchWorker(): Worker<SearchDiscoveryJobPayload> {
  const concurrency = getSearchWorkerConcurrency();
  const connection = createRedisConnection();

  console.log(`[SearchWorker] Initializing worker on queue "${SEARCH_DISCOVERY_QUEUE_NAME}" (concurrency: ${concurrency})`);

  const worker = new Worker<SearchDiscoveryJobPayload>(
    SEARCH_DISCOVERY_QUEUE_NAME,
    async (job: Job<SearchDiscoveryJobPayload>) => {
      return await processSearchDiscoveryJob(job);
    },
    {
      connection,
      concurrency,
      stalledInterval: 60000, // 60s stalled check interval (tuned for Upstash cost)
      drainDelay: 10,         // Low polling overhead when queue is idle
      limiter: {
        max: 30,
        duration: 10000,
      },
    }
  );

  worker.on("ready", () => {
    console.log(`[SearchWorker] Worker is ready and listening for search discovery jobs.`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[SearchWorker] Job ${job?.id} failed:`, err);
  });

  worker.on("stalled", (jobId) => {
    console.warn(`[SearchWorker] Job ${jobId} stalled (worker crash or lock timeout detected).`);
  });

  return worker;
}
