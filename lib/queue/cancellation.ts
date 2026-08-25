/**
 * §JOB CANCELLATION ENGINE (Prompt C4)
 * Coordinates in-flight execution halts, BullMQ queue removal, and Playwright session termination.
 */

import { getBrowserJobQueue } from "./jobQueue";
import { browserPool } from "@/worker/browser";
import { updateDbJob, getDbJobById, memoryJobCache } from "@/lib/db/jobs";

const activeCancellations = new Set<string>();

/**
 * Register a job cancellation request for in-flight polling
 */
export function requestJobCancellation(jobId: string): void {
  activeCancellations.add(jobId);
}

/**
 * Check whether a job has received an active cancellation signal
 */
export function isJobCancelled(jobId: string): boolean {
  return activeCancellations.has(jobId);
}

/**
 * Clear cancellation record after job has halted
 */
export function clearJobCancellation(jobId: string): void {
  activeCancellations.delete(jobId);
}

/**
 * Cancel a job whether it is currently QUEUED or actively RUNNING
 * Performs multi-tenant ownership check, graceful checkpoint halt, and force-kills Chromium.
 */
export async function cancelJob(jobId: string, userId?: string | null) {
  // 1. Multi-Tenant Authorization Check via resilient getDbJobById (with memory cache fallback)
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

  // 3. Signal in-flight cancellation
  requestJobCancellation(jobId);

  // 4. If QUEUED: Remove from BullMQ Queue (safe timeout race)
  if (job.status === "QUEUED") {
    try {
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

  // 5. If RUNNING: Force-kill active Playwright Browser Context
  try {
    await browserPool.forceCloseJobSession(jobId).catch(() => {});
  } catch {
    // Non-fatal
  }

  // 6. Update Database Status to CANCELLED
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
