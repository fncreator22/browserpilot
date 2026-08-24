import { type Observation } from "@/schemas/actions";

export type JobStatus = "QUEUED" | "WORKING" | "COMPLETED" | "FAILED" | "BLOCKED";

export interface JobRecord {
  id: string;
  prompt: string;
  status: JobStatus;
  progress: number;
  allowedDomains: string[];
  maxStepsBudget: number;
  currentStepNumber?: number;
  currentStepDescription?: string;
  observations: Observation[];
  screenshotPaths: string[];
  error?: {
    code: string;
    message: string;
    userMessage: string;
    detail?: unknown;
  };
  result?: {
    extractedData?: unknown;
    summary?: string;
    totalDurationMs?: number;
  };
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * In-Memory Temporary Job Store
 * Replaced with Prisma PostgreSQL database persistence in Prompt 14
 */
class InMemoryJobStore {
  private jobs: Map<string, JobRecord> = new Map();

  createJob(data: {
    id: string;
    prompt: string;
    allowedDomains?: string[];
    maxStepsBudget?: number;
  }): JobRecord {
    const job: JobRecord = {
      id: data.id,
      prompt: data.prompt,
      status: "QUEUED",
      progress: 0,
      allowedDomains: data.allowedDomains || [],
      maxStepsBudget: data.maxStepsBudget || 15,
      observations: [],
      screenshotPaths: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.jobs.set(data.id, job);
    return job;
  }

  getJob(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<Omit<JobRecord, "id" | "createdAt">>): JobRecord | undefined {
    const existing = this.jobs.get(id);
    if (!existing) return undefined;

    const updated: JobRecord = {
      ...existing,
      ...updates,
      updatedAt: new Date(),
    };

    if (updates.status === "COMPLETED" || updates.status === "FAILED" || updates.status === "BLOCKED") {
      updated.completedAt = new Date();
    }

    this.jobs.set(id, updated);
    return updated;
  }

  listJobs(): JobRecord[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  deleteJob(id: string): boolean {
    return this.jobs.delete(id);
  }

  clear(): void {
    this.jobs.clear();
  }
}

// Global default singleton store instance
export const jobStore = new InMemoryJobStore();
