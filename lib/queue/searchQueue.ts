import { Queue, type Job } from "bullmq";
import { createRedisConnection } from "./redis";

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
  try {
    const queue = getSearchDiscoveryQueue();
    // Using executionId as the job ID enforces deduplication at the BullMQ layer
    return await queue.add("discover", payload, {
      jobId: payload.executionId,
    });
  } catch (queueErr) {
    console.warn(
      `[SearchQueue] BullMQ Redis enqueue unavailable (${(queueErr as Error).message}), using in-process async worker fallback.`
    );
    // Asynchronous background execution so HTTP responds immediately (< 100ms)
    setImmediate(async () => {
      try {
        const { processSearchDiscoveryJob } = await import("@/worker/searchWorker");
        const syntheticJob = {
          id: payload.executionId,
          data: payload,
          updateProgress: async () => {},
        } as any;
        await processSearchDiscoveryJob(syntheticJob);
      } catch (err) {
        console.error(`[SearchQueue] Fallback worker error for ${payload.executionId}:`, err);
      }
    });
    return { id: payload.executionId };
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
