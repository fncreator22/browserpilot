import { Queue, type Job } from "bullmq";
import { createRedisConnection, isRedisCircuitAvailable } from "./redis";
import { hasCapability } from "@/lib/billing/entitlementService";

export const SEARCH_DISCOVERY_QUEUE_NAME = "search-discovery";

export interface SearchDiscoveryJobPayload {
  executionId: string;
  userId?: string | null;
  query: string;
  filters?: Record<string, any>;
  maxResultsCeiling?: number;
  requestedCount?: number;
  verifyEvidence?: boolean;
  persistToDb?: boolean;
  customProviders?: any[];
  correlationId: string;
  canonicalIntentHash: string;
  canonicalJson?: string;
}

let searchQueue: Queue<SearchDiscoveryJobPayload> | null = null;

export function getSearchDiscoveryQueue(): Queue<SearchDiscoveryJobPayload> {
  if (!searchQueue) {
    const connection = createRedisConnection();
    searchQueue = new Queue<SearchDiscoveryJobPayload>(SEARCH_DISCOVERY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 3000,
        },
        removeOnComplete: {
          age: 3600, // keep completed jobs up to 1 hour
          count: 500,
        },
        removeOnFail: {
          age: 86400, // keep failed jobs up to 24 hours for diagnostics
          count: 1000,
        },
      },
    });
  }
  return searchQueue;
}

/**
 * Enqueue a search discovery job into BullMQ
 */
export async function enqueueSearchDiscoveryJob(
  payload: SearchDiscoveryJobPayload
): Promise<any> {
  let priority = 10;
  if (payload.userId) {
    try {
      const isPriority = await hasCapability(payload.userId, "PRIORITY_EXECUTION");
      if (isPriority) {
        priority = 1;
      }
    } catch (capErr) {
      console.warn(
        `[SearchQueue] Failed to evaluate PRIORITY_EXECUTION for user ${payload.userId}:`,
        capErr
      );
    }
  }

  const runFallbackWorker = () => {
    setImmediate(async () => {
      try {
        const { processSearchDiscoveryJob } = await import("@/worker/searchWorker");
        const syntheticJob = {
          id: payload.executionId,
          data: payload,
          opts: { priority },
          updateProgress: async () => {},
        } as any;
        await processSearchDiscoveryJob(syntheticJob);
      } catch (err) {
        console.error(`[SearchQueue] Fallback worker error for ${payload.executionId}:`, err);
      }
    });
    return { id: payload.executionId, priority, opts: { priority } };
  };

  const redisActive = await isRedisCircuitAvailable();
  if (!redisActive) {
    return runFallbackWorker();
  }

  try {
    const queue = getSearchDiscoveryQueue();
    // In BullMQ, lower integer priority executes first: 1 = Enterprise priority, 10 = standard
    return await queue.add("discover", payload, {
      jobId: payload.executionId,
      priority,
    });
  } catch (queueErr) {
    return runFallbackWorker();
  }
}

/**
 * Closes the search queue connection (for testing and graceful shutdowns)
 */
export async function closeSearchDiscoveryQueue(): Promise<void> {
  if (searchQueue) {
    await searchQueue.close();
    searchQueue = null;
  }
}
