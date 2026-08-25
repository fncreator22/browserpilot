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
  apiKey?: string;
}

export interface EnqueueJobInput {
  prompt: string;
  userId?: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  jobId?: string;
  apiKey?: string;
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
        attempts: 1,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });
  }
  return browserQueue;
}

/**
 * Enqueue & Instantly Dispatch a new BrowserPilot autonomous job
 * Persists directly to Prisma DB and triggers execution pipeline.
 */
export async function enqueueBrowserJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  const jobId = input.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const prompt = input.prompt.trim();
  const allowedDomains = input.allowedDomains || [];
  const maxStepsBudget = input.maxStepsBudget || 15;
  const apiKey = input.apiKey;
  const createdAt = new Date();

  // 1. Persist directly to Database
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

  // 2. Launch serverless-safe execution immediately (BullMQ-free)
  import("@/lib/serverlessPipeline").then(({ runServerlessPipeline }) => {
    runServerlessPipeline({
      jobId,
      prompt,
      allowedDomains,
      maxStepsBudget,
      apiKey,
    }).catch((workerErr) => {
      console.error(`[JobQueue] Execution error for ${jobId}:`, workerErr);
    });
  }).catch(() => {});

  return {
    jobId,
    status: "PLANNING",
    createdAt,
  };
}
