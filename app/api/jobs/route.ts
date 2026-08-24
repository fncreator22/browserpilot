import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth/authOptions";
import { checkUserJobLimits } from "@/lib/auth/limits";
import { enqueueBrowserJob } from "@/lib/queue/jobQueue";
import { listDbJobs } from "@/lib/db/jobs";

const CreateJobRequestSchema = z.object({
  prompt: z.string().min(1, "Task prompt is required").max(2000, "Prompt must be under 2000 characters"),
  userId: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  maxStepsBudget: z.number().int().min(1).max(25).optional(),
});

/**
 * POST /api/jobs
 * Non-blocking job dispatcher with user ownership and concurrency rate limits (§22 / §27)
 */
export async function POST(request: Request) {
  const startTime = Date.now();

  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const parseResult = CreateJobRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: "Invalid job creation payload.",
          details: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { prompt, allowedDomains, maxStepsBudget } = parseResult.data;
    const effectiveUserId = (session?.user as { id?: string })?.id || parseResult.data.userId || null;

    // Multi-tenant concurrency & rate limit check (§22)
    if (effectiveUserId) {
      const limitCheck = await checkUserJobLimits(effectiveUserId);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.errorCode,
            message: limitCheck.message,
            activeCount: limitCheck.activeCount,
            maxActive: limitCheck.maxActive,
          },
          { status: 429 }
        );
      }
    }

    // Enqueue job into BullMQ & persist in DB (non-blocking)
    const enqueued = await enqueueBrowserJob({
      prompt,
      userId: effectiveUserId || undefined,
      allowedDomains,
      maxStepsBudget,
    });

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json(
      {
        jobId: enqueued.jobId,
        status: enqueued.status,
        createdAt: enqueued.createdAt,
        elapsedMs,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    const isRedisError = errorMsg.includes("Redis") || errorMsg.includes("connect");

    return NextResponse.json(
      {
        error: isRedisError ? "REDIS_UNAVAILABLE" : "JOB_CREATION_FAILED",
        message: errorMsg,
      },
      { status: isRedisError ? 503 : 500 }
    );
  }
}

/**
 * GET /api/jobs
 * List jobs scoped strictly by authenticated user ID (§22 multi-tenancy)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || null;

    const jobs = await listDbJobs(userId);
    return NextResponse.json({
      jobs,
      count: jobs.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "DATABASE_ERROR",
        message: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
