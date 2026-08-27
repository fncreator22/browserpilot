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
 * Enqueue a new BrowserPilot autonomous job.
 *
 * B11 FIX: Removed fire-and-forget pipeline execution from this function.
 * The pipeline is now executed ONLY inside the active SSE stream connection
 * (/api/jobs/:id/events) and the /api/jobs/:id/execute route.
 * This prevents the Lambda from being killed mid-execution after returning
 * the HTTP 201 response.
 *
 * Execution flow:
 *   POST /api/jobs → create DB record → return 201 with jobId
 *   Client navigates to /app/jobs/:id → opens SSE to /api/jobs/:id/events
 *   SSE route detects job is QUEUED → executes pipeline inside open stream
 */
export async function enqueueBrowserJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  const jobId = input.jobId || `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const prompt = input.prompt.trim();
  const allowedDomains = input.allowedDomains || [];
  const maxStepsBudget = input.maxStepsBudget || 15;
  const createdAt = new Date();

  // 1. Persist to Database
  await createDbJob({
    id: jobId,
    prompt,
    userId: input.userId,
    allowedDomains,
    maxStepsBudget,
  }).catch((err) => {
    console.error(`[JobQueue] Failed to persist job ${jobId} to database:`, err);
  });

  // 2. Emit creation event to SSE bus (in-process listeners, if any)
  jobEventBus.emitJobEvent(jobId, "created", {
    jobId,
    prompt,
    status: "QUEUED",
    createdAt,
  });

  // NOTE: Pipeline execution is intentionally NOT started here.
  // It will be triggered by the client opening the SSE stream
  // at /api/jobs/:id/events, which keeps the Lambda alive for the duration.

  return {
    jobId,
    status: "QUEUED",
    createdAt,
  };
}
