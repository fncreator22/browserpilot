/**
 * §CANONICAL BACKGROUND JOB & QUEUE ABSTRACTION (TASK-036)
 * 
 * Provides unified background job representation, bounded retry policies,
 * error categorization, and a pluggable queue interface for local and cloud runtimes.
 */

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";

export type JobType =
  | "DISCOVERY_SCAN"
  | "LIFECYCLE_ALERT"
  | "EMAIL_NOTIFICATION"
  | "OPPORTUNITY_REVALIDATION";

export type JobErrorCategory =
  | "TRANSIENT_NETWORK"
  | "RATE_LIMITED"
  | "PROVIDER_ERROR"
  | "PERMANENT_VALIDATION"
  | "DATABASE_ERROR";

export interface BackgroundJob<T = Record<string, unknown>> {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: T;
  attempts: number;
  maxAttempts: number;
  lockedAt?: Date | null;
  lockOwner?: string | null;
  scheduledAt: Date;
  startedAt?: Date | null;
  completedAt?: Date | null;
  lastError?: {
    category: JobErrorCategory;
    message: string;
    timestamp: Date;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobQueueAdapter {
  enqueue<T>(type: JobType, payload: T, options?: { scheduledAt?: Date; maxAttempts?: number }): Promise<BackgroundJob<T>>;
  claimNext(workerId: string, types?: JobType[]): Promise<BackgroundJob | null>;
  complete(jobId: string, workerId: string): Promise<boolean>;
  fail(jobId: string, workerId: string, error: { category: JobErrorCategory; message: string }): Promise<boolean>;
  getJob(jobId: string): Promise<BackgroundJob | null>;
}

export class MemoryJobQueue implements JobQueueAdapter {
  private jobs: Map<string, BackgroundJob<any>> = new Map();

  public async enqueue<T>(
    type: JobType,
    payload: T,
    options: { scheduledAt?: Date; maxAttempts?: number } = {}
  ): Promise<BackgroundJob<T>> {
    const now = new Date();
    const id = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const job: BackgroundJob<T> = {
      id,
      type,
      status: "QUEUED",
      payload,
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      scheduledAt: options.scheduledAt ?? now,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    return job;
  }

  public async claimNext(workerId: string, types?: JobType[]): Promise<BackgroundJob | null> {
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (
        job.status === "QUEUED" &&
        job.scheduledAt <= now &&
        (!types || types.includes(job.type))
      ) {
        job.status = "PROCESSING";
        job.attempts += 1;
        job.lockedAt = now;
        job.lockOwner = workerId;
        job.startedAt = now;
        job.updatedAt = now;
        return job;
      }
    }
    return null;
  }

  public async complete(jobId: string, workerId: string): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.lockOwner !== workerId || job.status !== "PROCESSING") return false;

    job.status = "COMPLETED";
    job.lockedAt = null;
    job.lockOwner = null;
    job.completedAt = new Date();
    job.updatedAt = new Date();
    return true;
  }

  public async fail(
    jobId: string,
    workerId: string,
    error: { category: JobErrorCategory; message: string }
  ): Promise<boolean> {
    const job = this.jobs.get(jobId);
    if (!job || job.lockOwner !== workerId) return false;

    job.lastError = {
      category: error.category,
      message: error.message,
      timestamp: new Date(),
    };

    const isPermanent = error.category === "PERMANENT_VALIDATION";
    if (isPermanent || job.attempts >= job.maxAttempts) {
      job.status = "FAILED";
      job.lockedAt = null;
      job.lockOwner = null;
    } else {
      // Exponential backoff retry: 1s * 2^(attempts-1)
      const backoffMs = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000);
      job.status = "QUEUED";
      job.lockedAt = null;
      job.lockOwner = null;
      job.scheduledAt = new Date(Date.now() + backoffMs);
    }

    job.updatedAt = new Date();
    return true;
  }

  public async getJob(jobId: string): Promise<BackgroundJob | null> {
    return this.jobs.get(jobId) || null;
  }
}

export const defaultJobQueue: JobQueueAdapter = new MemoryJobQueue();
