import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth/authOptions";
import { checkUserJobLimits } from "@/lib/auth/limits";
import { enqueueBrowserJob } from "@/lib/queue/jobQueue";
import { listDbJobs } from "@/lib/db/jobs";
import { getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";
import { isTestHarnessEnvironment } from "@/lib/ai/intent";

const CreateJobRequestSchema = z.object({
  prompt: z.string().min(1, "Task prompt is required").max(2000, "Prompt must be under 2000 characters"),
  userId: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  maxStepsBudget: z.number().int().min(1).max(25).optional(),
  apiKey: z.string().optional(),
});

/**
 * POST /api/jobs
 * Non-blocking job dispatcher with user ownership, BYOK Gemini key resolution, rate limits, and configuration guards (§22 / §27)
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

    const { prompt, allowedDomains, maxStepsBudget, apiKey: explicitKey } = parseResult.data;
    const effectiveUserId = (session?.user as { id?: string })?.id || null;

    // Resolve BYOK Gemini API key: JWT session > explicit request param > env
    // Using session JWT avoids SQLite DB lookup across serverless Lambda instances
    const sessionApiKey = (session?.user as { geminiApiKey?: string })?.geminiApiKey;
    const resolvedApiKey = getEffectiveGeminiApiKey(sessionApiKey || explicitKey);

    // Fail-fast configuration guard: Verify Gemini API key presence outside test harness
    if (!resolvedApiKey && !isTestHarnessEnvironment()) {
      return NextResponse.json(
        {
          error: "MISSING_GEMINI_API_KEY",
          message: "Please configure your Gemini API Key in your Profile settings or enter your API key to dispatch tasks.",
          category: "CONFIGURATION_ERROR",
        },
        { status: 400 }
      );
    }

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

    // Enqueue job into execution engine & persist in DB (non-blocking)
    const enqueued = await enqueueBrowserJob({
      prompt,
      userId: effectiveUserId || undefined,
      allowedDomains,
      maxStepsBudget,
      apiKey: resolvedApiKey || undefined,
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
    const errorMsg = (err as Error).message || "Internal server error";
    console.error("[JobsAPI] Failed creating job:", err);
    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to dispatch autonomous job. Please try again.",
        detail: errorMsg,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/jobs
 * List jobs scoped strictly by authenticated user
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
