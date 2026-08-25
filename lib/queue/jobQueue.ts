import { Queue } from "bullmq";
import { createRedisConnection } from "./redis";
import { createDbJob } from "@/lib/db/jobs";
import { jobEventBus } from "@/lib/events/jobEvents";

export const BROWSER_JOBS_QUEUE_NAME = "browser-jobs";

export interface BrowserJobPayload {
  jobId: string;
  prompt: string;
  allowedDomains: string[];
  maxStepsBudget: number;
}

export interface EnqueueJobInput {
  prompt: string;
  userId?: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  jobId?: string;
}

export interface EnqueueJobResult {
  jobId: string;
  status: "QUEUED" | "PLANNING" | "WORKING";
  createdAt: Date;
}

let browserQueue: Queue<BrowserJobPayload> | null = null;

export function getBrowserJobQueue(): Queue<BrowserJobPayload> {
  if (!browserQueue) {
    const connection = createRedisConnection();
    browserQueue = new Queue<BrowserJobPayload>(BROWSER_JOBS_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 1, // Deterministic browser jobs do not retry blind crashes
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return browserQueue;
}

/**
 * Enqueue & Instantly Dispatch a new BrowserPilot autonomous job
 * Persists directly to Prisma DB and launches execution immediately without queue delays.
 */
export async function enqueueBrowserJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  const jobId = input.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const prompt = input.prompt.trim();
  const allowedDomains = input.allowedDomains || [];
  const maxStepsBudget = input.maxStepsBudget || 15;
  const createdAt = new Date();

  // 1. Persist directly to Prisma Database
  await createDbJob({
    id: jobId,
    prompt,
    userId: input.userId,
    allowedDomains,
    maxStepsBudget,
  }).catch((err) => {
    console.error(`[JobQueue] Failed to persist job ${jobId} to database:`, err);
  });

  // Emit initial creation event to SSE bus
  jobEventBus.emitJobEvent(jobId, "created", {
    jobId,
    prompt,
    status: "PLANNING",
    createdAt,
  });

  // 2. Launch background execution immediately for zero-queue latency
  import("@/worker/index").then(({ processBrowserJob }) => {
    processBrowserJob({
      jobId,
      prompt,
      allowedDomains,
      maxStepsBudget,
    }).catch((workerErr) => {
      console.error(`[JobQueue] Immediate execution error for ${jobId}:`, workerErr);
    });
  }).catch(() => {});

  // Optional: Also sync to Redis queue if running in distributed cluster
  try {
    const queue = getBrowserJobQueue();
    queue.add(
      "execute-pipeline",
      {
        jobId,
        prompt,
        allowedDomains,
        maxStepsBudget,
      },
      { jobId }
    ).catch(() => {});
  } catch {
    // Non-fatal if Redis is not configured
  }

  return {
    jobId,
    status: "QUEUED",
    createdAt,
  };
}
