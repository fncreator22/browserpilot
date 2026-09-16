import { Queue, type Job } from "bullmq";
import { createRedisConnection, isRedisCircuitAvailable } from "./redis";

export const WATCH_DISCOVERY_QUEUE_NAME = "watch-discovery";

export interface WatchJobPayload {
  watchId: string;
  userId: string;
  companyTargets?: string[];
  roleTitle?: string;
  timeBudgetMs?: number;
  correlationId?: string;
  mockFetcher?: (url: string, timeoutMs?: number) => Promise<string | null>;
}

let watchQueue: Queue<WatchJobPayload> | null = null;

export function getWatchDiscoveryQueue(): Queue<WatchJobPayload> {
  if (!watchQueue) {
    const connection = createRedisConnection();
    watchQueue = new Queue<WatchJobPayload>(WATCH_DISCOVERY_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600,
          count: 500,
        },
        removeOnFail: {
          age: 86400,
          count: 1000,
        },
      },
    });
  }
  return watchQueue;
}

/**
 * Enqueues a watch discovery job into BullMQ with graceful fallback
 */
export async function enqueueWatchDiscoveryJob(payload: WatchJobPayload): Promise<any> {
  const runFallback = () => {
    setImmediate(async () => {
      try {
        const { processWatchDiscoveryJob } = await import("@/worker/processors/watchProcessor");
        const syntheticJob = {
          id: payload.watchId,
          data: payload,
          opts: {},
          updateProgress: async () => {},
        } as unknown as Job<WatchJobPayload>;
        await processWatchDiscoveryJob(syntheticJob);
      } catch (err) {
        console.warn(`[WatchQueue] Fallback watch processing warning for ${payload.watchId}:`, err);
      }
    });
    return {
      id: `synthetic-watch-${payload.watchId}`,
      data: payload,
      isSynthetic: true,
    };
  };

  if (!process.env.REDIS_URL || !isRedisCircuitAvailable()) {
    return runFallback();
  }

  try {
    const q = getWatchDiscoveryQueue();
    return await q.add(`watch:${payload.watchId}`, payload, {
      jobId: `watch-${payload.watchId}-${Date.now()}`,
    });
  } catch (enqueueErr) {
    console.warn(`[WatchQueue] Failed to enqueue to Redis, running fallback:`, enqueueErr);
    return runFallback();
  }
}
