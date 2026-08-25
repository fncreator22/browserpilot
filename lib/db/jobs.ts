import { prisma } from "./prisma";
import { type Observation } from "@/schemas/actions";
import { type PlannedStep } from "@/schemas/jobs";
import { artifactStorage } from "@/lib/storage";
import { calculateJobTimeBudget } from "@/lib/capabilities/timeBudget";

export interface CreateJobDbInput {
  id: string;
  prompt: string;
  userId?: string | null;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  maxDurationMs?: number;
}

export interface UpdateJobDbInput {
  status?: "QUEUED" | "PLANNING" | "WORKING" | "VERIFYING" | "COMPLETED" | "FAILED" | "BLOCKED" | "CANCELLED";
  progress?: number;
  goal?: string;
  confidence?: number;
  summary?: string;
  error?: unknown;
  result?: unknown;
  totalDurationMs?: number;
  tokensUsed?: number;
  memoryMb?: number;
  maxDurationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * USER-SCOPED DATABASE CRUD & LOGGING HELPERS (§22 / §23 / §27 / §36)
 */

// In-memory fallback cache for fast lookups across concurrent calls within same runtime
const globalForJobCache = globalThis as unknown as {
  memoryJobCache: Map<string, any> | undefined;
};
export const memoryJobCache = globalForJobCache.memoryJobCache ?? new Map<string, any>();
if (process.env.NODE_ENV !== "production") {
  globalForJobCache.memoryJobCache = memoryJobCache;
}

export async function createDbJob(data: CreateJobDbInput) {
  const calculatedBudget = data.maxDurationMs || calculateJobTimeBudget({
    prompt: data.prompt,
    allowedDomains: data.allowedDomains,
    maxStepsBudget: data.maxStepsBudget,
  }).budgetMs;

  const now = new Date();
  const jobPayload = {
    id: data.id,
    prompt: data.prompt,
    userId: data.userId || null,
    status: "QUEUED",
    progress: 0,
    allowedDomains: JSON.stringify(data.allowedDomains || []),
    maxStepsBudget: data.maxStepsBudget || 15,
    maxDurationMs: calculatedBudget,
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
    goal: null,
    confidence: null,
    summary: null,
    error: null,
    result: null,
    totalDurationMs: null,
    tokensUsed: null,
    memoryMb: null,
    steps: [],
    observations: [],
    artifacts: [],
  };

  // Cache in memory immediately
  memoryJobCache.set(data.id, jobPayload);

  try {
    const created = await prisma.job.create({
      data: {
        id: data.id,
        prompt: data.prompt,
        userId: data.userId || null,
        status: "QUEUED",
        progress: 0,
        allowedDomains: JSON.stringify(data.allowedDomains || []),
        maxStepsBudget: data.maxStepsBudget || 15,
        maxDurationMs: calculatedBudget,
      },
    });
    return created;
  } catch (err) {
    console.warn(`[JobsDB] Prisma create error for job ${data.id} (relying on memory cache):`, err);
    return jobPayload;
  }
}

/**
 * Retrieves a job by ID, with optional strict user ownership validation.
 * Checks Prisma DB first, with fallback to in-memory cache.
 */
export async function getDbJobById(id: string, userId?: string | null) {
  let job: any = null;
  let dbQueriedSuccessfully = false;

  try {
    job = await prisma.job.findUnique({
      where: { id },
      include: {
        steps: {
          orderBy: { stepNumber: "asc" },
        },
        observations: {
          orderBy: { stepIndex: "asc" },
        },
        artifacts: {
          orderBy: { createdAt: "asc" },
        },
      },
    });
    dbQueriedSuccessfully = true;
  } catch (err) {
    console.warn(`[JobsDB] Prisma query error for job ${id}:`, err);
  }

  // Only fall back to memory cache if DB query failed (e.g. cold serverless instance)
  if (!job && !dbQueriedSuccessfully) {
    job = memoryJobCache.get(id) || null;
  } else if (job) {
    // Keep memory cache fresh
    memoryJobCache.set(id, job);
  } else {
    // DB explicitly confirmed row does not exist, purge memory cache
    memoryJobCache.delete(id);
  }

  if (!job) return null;

  // Strict ownership check if userId is provided
  if (userId && job.userId && job.userId !== userId) {
    return null; // Multi-tenancy isolation boundary
  }

  return job;
}

/**
 * Rehydrates a dispatched job into the current database instance if missing.
 */
export async function upsertDbJobFromSync(data: {
  id: string;
  prompt: string;
  userId?: string | null;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  maxDurationMs?: number;
}) {
  const existing = await getDbJobById(data.id, data.userId);
  if (existing) return existing;

  return createDbJob(data);
}

export async function updateDbJob(id: string, updates: UpdateJobDbInput) {
  const dataToUpdate: Record<string, unknown> = {};

  if (updates.status !== undefined) dataToUpdate.status = updates.status;
  if (updates.progress !== undefined) dataToUpdate.progress = updates.progress;
  if (updates.goal !== undefined) dataToUpdate.goal = updates.goal;
  if (updates.confidence !== undefined) dataToUpdate.confidence = updates.confidence;
  if (updates.summary !== undefined) dataToUpdate.summary = updates.summary;
  if (updates.totalDurationMs !== undefined) dataToUpdate.totalDurationMs = updates.totalDurationMs;
  if (updates.tokensUsed !== undefined) dataToUpdate.tokensUsed = updates.tokensUsed;
  if (updates.memoryMb !== undefined) dataToUpdate.memoryMb = updates.memoryMb;
  if (updates.maxDurationMs !== undefined) dataToUpdate.maxDurationMs = updates.maxDurationMs;
  if (updates.startedAt !== undefined) dataToUpdate.startedAt = updates.startedAt;

  if (updates.error !== undefined) {
    dataToUpdate.error = typeof updates.error === "string" ? updates.error : JSON.stringify(updates.error);
  }
  if (updates.result !== undefined) {
    dataToUpdate.result = typeof updates.result === "string" ? updates.result : JSON.stringify(updates.result);
  }
  if (updates.completedAt !== undefined) {
    dataToUpdate.completedAt = updates.completedAt;
  } else if (updates.status === "COMPLETED" || updates.status === "FAILED" || updates.status === "BLOCKED") {
    dataToUpdate.completedAt = new Date();
  }

  return prisma.job.update({
    where: { id },
    data: dataToUpdate,
  });
}

/**
 * Lists jobs filtered by user ownership.
 */
export async function listDbJobs(userId?: string | null, limit = 50) {
  return prisma.job.findMany({
    where: userId ? { userId } : undefined,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          steps: true,
          observations: true,
          artifacts: true,
        },
      },
    },
  });
}

export async function recordDbJobStep(jobId: string, step: PlannedStep) {
  return prisma.jobStep.create({
    data: {
      jobId,
      stepNumber: step.stepNumber,
      tool: step.action.tool,
      actionPayload: JSON.stringify(step.action),
      rationale: step.rationale || null,
      status: "EXECUTED",
    },
  });
}

export async function recordDbObservation(jobId: string, observation: Observation) {
  return prisma.observationRecord.create({
    data: {
      jobId,
      stepIndex: observation.stepIndex,
      tool: observation.action.tool,
      status: observation.status,
      currentUrl: observation.currentUrl,
      title: observation.title,
      pageSummary: observation.pageSummary || null,
      extractedData: observation.extractedData !== undefined ? JSON.stringify(observation.extractedData) : null,
      screenshotPath: observation.screenshotPath || null,
      error: observation.error ? JSON.stringify(observation.error) : null,
      elapsedMs: observation.elapsedMs,
      timestamp: new Date(observation.timestamp),
    },
  });
}

export async function recordDbArtifact(
  jobId: string,
  artifact: {
    filename: string;
    storageKey: string;
    mimeType?: string;
    sizeBytes?: number;
  }
) {
  return prisma.artifactRecord.create({
    data: {
      jobId,
      filename: artifact.filename,
      storageKey: artifact.storageKey,
      mimeType: artifact.mimeType || "image/png",
      sizeBytes: artifact.sizeBytes || 0,
    },
  });
}

export async function getDbJobEvents(jobId: string, userId?: string | null) {
  const job = await getDbJobById(jobId, userId);
  if (!job) return null;

  const [steps, observations] = await Promise.all([
    prisma.jobStep.findMany({
      where: { jobId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.observationRecord.findMany({
      where: { jobId },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  return {
    jobId,
    steps,
    observations,
  };
}

export async function getDbJobArtifacts(jobId: string, userId?: string | null) {
  const job = await getDbJobById(jobId, userId);
  if (!job) return null;

  return prisma.artifactRecord.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Cancel an in-flight job (§27)
 */
export async function cancelDbJob(jobId: string, userId?: string | null) {
  const job = await getDbJobById(jobId, userId);
  if (!job) {
    throw new Error("Job not found or access unauthorized.");
  }

  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "BLOCKED" || job.status === "CANCELLED") {
    return job; // Already in terminal state
  }

  return updateDbJob(jobId, {
    status: "CANCELLED",
    progress: 100,
    summary: "Task was cancelled by user request.",
    error: {
      code: "USER_CANCELLED",
      message: "Job execution was cancelled by user request.",
      userMessage: "Task was cancelled by user request.",
    },
    completedAt: new Date(),
  });
}

/**
 * Retry a completed or failed job (§27)
 */
export async function retryDbJob(jobId: string, userId?: string | null) {
  const job = await getDbJobById(jobId, userId);
  if (!job) {
    throw new Error("Job not found or access unauthorized.");
  }

  return updateDbJob(jobId, {
    status: "QUEUED",
    progress: 0,
    summary: "Job queued for retry execution.",
    error: null,
    result: null,
  });
}

/**
 * Auto-purges terminal jobs and their associated filesystem artifacts older than 24 hours (§Prompt B2)
 */
export async function purgeExpiredTerminalJobs(olderThanMs: number = 24 * 60 * 60 * 1000): Promise<{
  purgedCount: number;
  purgedJobIds: string[];
}> {
  const cutoffDate = new Date(Date.now() - olderThanMs);

  // 1. Find all terminal jobs completed before the cutoff threshold
  const expiredJobs = await prisma.job.findMany({
    where: {
      status: {
        in: ["COMPLETED", "PARTIAL", "BLOCKED", "FAILED", "CANCELLED"],
      },
      completedAt: {
        lte: cutoffDate,
      },
    },
    select: {
      id: true,
      status: true,
      completedAt: true,
    },
  });

  const purgedJobIds: string[] = [];

  for (const job of expiredJobs) {
    // 2. Delete artifact files on filesystem
    await artifactStorage.deleteJobArtifacts(job.id).catch(() => {});

    // 3. Delete from Prisma Database (Cascade deletes steps, observations, artifacts)
    await prisma.job.delete({
      where: { id: job.id },
    }).catch(() => {});

    memoryJobCache.delete(job.id);
    purgedJobIds.push(job.id);
  }

  return {
    purgedCount: purgedJobIds.length,
    purgedJobIds,
  };
}

