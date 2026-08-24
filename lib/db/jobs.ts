import { prisma } from "./prisma";
import { type Observation } from "@/schemas/actions";
import { type PlannedStep } from "@/schemas/jobs";

export interface CreateJobDbInput {
  id: string;
  prompt: string;
  userId?: string | null;
  allowedDomains?: string[];
  maxStepsBudget?: number;
}

export interface UpdateJobDbInput {
  status?: "QUEUED" | "PLANNING" | "WORKING" | "VERIFYING" | "COMPLETED" | "FAILED" | "BLOCKED";
  progress?: number;
  goal?: string;
  confidence?: number;
  summary?: string;
  error?: unknown;
  result?: unknown;
  totalDurationMs?: number;
  completedAt?: Date;
}

/**
 * USER-SCOPED DATABASE CRUD & LOGGING HELPERS (§22 / §23 / §27 / §36)
 */

export async function createDbJob(data: CreateJobDbInput) {
  return prisma.job.create({
    data: {
      id: data.id,
      prompt: data.prompt,
      userId: data.userId || null,
      status: "QUEUED",
      progress: 0,
      allowedDomains: JSON.stringify(data.allowedDomains || []),
      maxStepsBudget: data.maxStepsBudget || 15,
    },
  });
}

/**
 * Retrieves a job by ID, with optional strict user ownership validation.
 */
export async function getDbJobById(id: string, userId?: string | null) {
  const job = await prisma.job.findUnique({
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

  if (!job) return null;

  // Strict ownership check if userId is provided
  if (userId && job.userId && job.userId !== userId) {
    return null; // Multi-tenancy isolation boundary
  }

  return job;
}

export async function updateDbJob(id: string, updates: UpdateJobDbInput) {
  const dataToUpdate: Record<string, unknown> = {};

  if (updates.status !== undefined) dataToUpdate.status = updates.status;
  if (updates.progress !== undefined) dataToUpdate.progress = updates.progress;
  if (updates.goal !== undefined) dataToUpdate.goal = updates.goal;
  if (updates.confidence !== undefined) dataToUpdate.confidence = updates.confidence;
  if (updates.summary !== undefined) dataToUpdate.summary = updates.summary;
  if (updates.totalDurationMs !== undefined) dataToUpdate.totalDurationMs = updates.totalDurationMs;

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

  if (job.status === "COMPLETED" || job.status === "FAILED" || job.status === "BLOCKED") {
    return job; // Already in terminal state
  }

  return updateDbJob(jobId, {
    status: "BLOCKED",
    progress: 100,
    summary: "Task was cancelled by user request.",
    error: {
      code: "USER_CANCELLED",
      message: "Job execution was aborted by the user.",
      userMessage: "You cancelled this job execution.",
    },
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
