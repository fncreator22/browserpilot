import { Queue } from "bullmq";
import { createRedisConnection, checkRedisHealth } from "./redis";
import { jobStore, type JobRecord } from "./store";
import { createDbJob } from "@/lib/db/jobs";

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
 * Enqueue a new BrowserPilot autonomous job
 * Persists to Prisma DB and dispatches either via BullMQ Redis queue or in-process worker
 */
export async function enqueueBrowserJob(input: EnqueueJobInput): Promise<{
  jobId: string;
  status: "QUEUED";
  createdAt: Date;
  job: JobRecord;
}> {
  const jobId = input.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const prompt = input.prompt.trim();
  const allowedDomains = input.allowedDomains || [];
  const maxStepsBudget = input.maxStepsBudget || 15;

  // 1. Persist to Prisma Database
  await createDbJob({
    id: jobId,
    prompt,
    userId: input.userId,
    allowedDomains,
    maxStepsBudget,
  }).catch((err) => {
    console.error(`[JobQueue] Failed to persist job ${jobId} to database:`, err);
  });

  // 2. Create in-memory cache record
  const job = jobStore.createJob({
    id: jobId,
    prompt,
    allowedDomains,
    maxStepsBudget,
  });

  // 3. Dispatch to BullMQ Queue, with automatic in-process worker fallback for standalone dev
  try {
    const queue = getBrowserJobQueue();
    await queue.add(
      "execute-pipeline",
      {
        jobId,
        prompt,
        allowedDomains,
        maxStepsBudget,
      },
      { jobId }
    );
  } catch (err: unknown) {
    // Graceful fallback for local development without standalone Redis server
    console.log(`[JobQueue] Redis not available, running job ${jobId} in background in-process worker...`);
    import("@/worker/index").then(({ processBrowserJob }) => {
      processBrowserJob({
        jobId,
        prompt,
        allowedDomains,
        maxStepsBudget,
      }).catch((workerErr) => {
        console.error(`[JobQueue] In-process execution error for ${jobId}:`, workerErr);
      });
    });
  }

  return {
    jobId,
    status: "QUEUED",
    createdAt: job.createdAt,
    job,
  };
}
