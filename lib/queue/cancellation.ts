/**
 * §JOB CANCELLATION ENGINE
 * Coordinates in-flight execution halts, queue removal, browser kill, and database sync.
 */

import { updateDbJob, getDbJobById, memoryJobCache } from "@/lib/db/jobs";
import { jobEventBus } from "@/lib/events/jobEvents";

const activeCancellations = new Set<string>();

/**
 * Register a job cancellation request for in-flight polling
 */
export function requestJobCancellation(jobId: string): void {
  activeCancellations.add(jobId);

  // Sync cancellation signal to Redis if available
  if (process.env.REDIS_URL) {
    try {
      const { createRedisConnection } = require("./redis");
      const client = createRedisConnection();
      client.set(`bp:cancel:${jobId}`, "1", "EX", 3600).catch(() => {});
    } catch {}
  }
}

/**
 * Check whether a job has received an active cancellation signal
 */
export function isJobCancelled(jobId: string): boolean {
  if (activeCancellations.has(jobId)) {
    return true;
  }
  const cached = memoryJobCache.get(jobId);
  if (cached?.status === "CANCELLED") {
    return true;
  }
  return false;
}

/**
 * Clear cancellation record after job has halted
 */
export function clearJobCancellation(jobId: string): void {
  activeCancellations.delete(jobId);
}

/**
 * Cancel a job whether it is currently QUEUED or actively RUNNING
 * Performs multi-tenant authorization check, graceful checkpoint halt, and browser session termination.
 */
export async function cancelJob(jobId: string, userId?: string | null) {
  // 1. Multi-Tenant Authorization Check
  let job = await getDbJobById(jobId, userId).catch(() => null);

  if (!job) {
    job = memoryJobCache.get(jobId) || null;
  }

  if (!job) {
    // If not found in current instance, create an optimistic cancelled record
    job = {
      id: jobId,
      userId: userId || null,
      prompt: "Cancelled task",
      status: "CANCELLED",
      progress: 100,
      summary: "Task was cancelled by user request.",
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: new Date(),
      steps: [],
      observations: [],
      artifacts: [],
    };
    memoryJobCache.set(jobId, job);
  }

  if (job.userId && userId && job.userId !== userId) {
    const error = new Error("Unauthorized to cancel this job.");
    (error as unknown as { code: string }).code = "UNAUTHORIZED";
    throw error;
  }

  // 2. Safe No-Op if already in terminal state
  const terminalStates = ["COMPLETED", "FAILED", "BLOCKED", "CANCELLED"];
  if (terminalStates.includes(job.status)) {
    return {
      success: true,
      alreadyTerminated: true,
      job,
    };
  }

  // 3. Signal in-flight cancellation across memory and Redis
  requestJobCancellation(jobId);

  // 4. Emit instant status cancellation event over SSE stream
  jobEventBus.emitJobEvent(jobId, "status", {
    status: "CANCELLED",
    progress: 100,
    summary: "Task was cancelled by user request.",
  });

  // 5. If QUEUED: Remove from BullMQ Queue (safe timeout race)
  if (job.status === "QUEUED") {
    try {
      const { getBrowserJobQueue } = await import("./jobQueue");
      const queue = getBrowserJobQueue();
      const bullJob = await Promise.race([
        queue.getJob(jobId).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
      ]);
      if (bullJob) {
        await bullJob.remove().catch(() => {});
      }
    } catch {
      // Non-fatal if BullMQ is offline or in-process
    }
  }

  // 6. If RUNNING: Force-kill active Playwright Browser Context
  try {
    const { browserPool } = await import("@/worker/browser");
    await browserPool.forceCloseJobSession(jobId).catch(() => {});
  } catch {
    // Non-fatal
  }

  // 7. Update Database Status to CANCELLED
  const updatedJob = await updateDbJob(jobId, {
    status: "CANCELLED" as any,
    progress: 100,
    summary: "Task was cancelled by user request.",
    error: {
      code: "USER_CANCELLED",
      message: "Job execution was cancelled by user request.",
      userMessage: "Task was cancelled by user request.",
    },
    completedAt: new Date(),
  }).catch(() => ({
    ...job,
    status: "CANCELLED",
    progress: 100,
    summary: "Task was cancelled by user request.",
  }));

  clearJobCancellation(jobId);

  return {
    success: true,
    alreadyTerminated: false,
    job: updatedJob || { ...job, status: "CANCELLED", progress: 100 },
  };
}
