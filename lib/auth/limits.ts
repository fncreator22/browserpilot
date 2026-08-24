import { prisma } from "@/lib/db/prisma";

/**
 * MULTI-TENANCY CONCURRENCY & RATE LIMITS (§22 / §36)
 */
export const MAX_CONCURRENT_JOBS_PER_USER = parseInt(
  process.env.MAX_CONCURRENT_JOBS_PER_USER || "2",
  10
);

export const MAX_HOURLY_JOBS_PER_USER = parseInt(
  process.env.MAX_HOURLY_JOBS_PER_USER || "20",
  10
);

export interface UserLimitCheckResult {
  allowed: boolean;
  errorCode?: "CONCURRENT_LIMIT_EXCEEDED" | "HOURLY_LIMIT_EXCEEDED";
  message?: string;
  activeCount: number;
  maxActive: number;
  hourlyCount: number;
  maxHourly: number;
}

/**
 * Checks whether the user is within their allowed concurrent and hourly limits.
 */
export async function checkUserJobLimits(
  userId: string
): Promise<UserLimitCheckResult> {
  // If guest or dev without user ID, default to single slot
  if (!userId) {
    return {
      allowed: true,
      activeCount: 0,
      maxActive: MAX_CONCURRENT_JOBS_PER_USER,
      hourlyCount: 0,
      maxHourly: MAX_HOURLY_JOBS_PER_USER,
    };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [activeCount, hourlyCount] = await Promise.all([
    // Active jobs in flight
    prisma.job.count({
      where: {
        userId,
        status: {
          in: ["QUEUED", "PLANNING", "WORKING", "VERIFYING"],
        },
      },
    }),
    // Hourly jobs created
    prisma.job.count({
      where: {
        userId,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    }),
  ]);

  if (activeCount >= MAX_CONCURRENT_JOBS_PER_USER) {
    return {
      allowed: false,
      errorCode: "CONCURRENT_LIMIT_EXCEEDED",
      message: `Concurrency limit reached: You have ${activeCount} active job(s) running (max ${MAX_CONCURRENT_JOBS_PER_USER}). Please wait for current jobs to complete before dispatching more.`,
      activeCount,
      maxActive: MAX_CONCURRENT_JOBS_PER_USER,
      hourlyCount,
      maxHourly: MAX_HOURLY_JOBS_PER_USER,
    };
  }

  if (hourlyCount >= MAX_HOURLY_JOBS_PER_USER) {
    return {
      allowed: false,
      errorCode: "HOURLY_LIMIT_EXCEEDED",
      message: `Hourly rate limit reached: You have dispatched ${hourlyCount} jobs in the past hour (max ${MAX_HOURLY_JOBS_PER_USER}). Please wait before dispatching new jobs.`,
      activeCount,
      maxActive: MAX_CONCURRENT_JOBS_PER_USER,
      hourlyCount,
      maxHourly: MAX_HOURLY_JOBS_PER_USER,
    };
  }

  return {
    allowed: true,
    activeCount,
    maxActive: MAX_CONCURRENT_JOBS_PER_USER,
    hourlyCount,
    maxHourly: MAX_HOURLY_JOBS_PER_USER,
  };
}
