import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobById } from "@/lib/db/jobs";
import { getEffectiveUserGeminiApiKey } from "@/lib/db/users";
import { getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";
import { runServerlessPipeline } from "@/lib/serverlessPipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Up to 60s max serverless duration

/**
 * POST /api/jobs/:id/execute
 * Direct Active Serverless Execution Endpoint.
 * Executes the full autonomous Gemini agent pipeline within the active HTTP request,
 * guaranteeing zero Lambda freeze and streaming real-time status updates to the database & UI.
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id: jobId } = params;
  const startTime = Date.now();

  try {
    let sessionUserId: string | null = null;
    let sessionUserEmail: string | null = null;

    try {
      const session = await getServerSession(authOptions);
      sessionUserId = (session?.user as { id?: string })?.id || null;
      sessionUserEmail = (session?.user as { email?: string })?.email || null;
    } catch {
      // Session retrieval fallback
    }

    // 1. Fetch current job
    const job = await getDbJobById(jobId, sessionUserId);
    if (!job) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job ${jobId} not found.` },
        { status: 404 }
      );
    }

    // If job is already in a terminal state, return existing record
    if (["COMPLETED", "FAILED", "BLOCKED", "CANCELLED"].includes(job.status)) {
      return NextResponse.json({
        success: job.status === "COMPLETED",
        status: job.status,
        job,
      });
    }

    // 2. Resolve Gemini API Key (BYOK)
    let bodyApiKey: string | undefined = undefined;
    try {
      const body = await request.json().catch(() => ({}));
      bodyApiKey = body?.apiKey;
    } catch {}

    const resolvedUserKey = 
      (await getEffectiveUserGeminiApiKey(sessionUserId)) ||
      (await getEffectiveUserGeminiApiKey(sessionUserEmail)) ||
      (await getEffectiveUserGeminiApiKey(job.userId));

    const finalApiKey = getEffectiveGeminiApiKey(bodyApiKey || resolvedUserKey);

    if (!finalApiKey && process.env.NODE_ENV !== "test" && process.env.IS_TEST_HARNESS !== "true") {
      return NextResponse.json(
        {
          error: "MISSING_GEMINI_API_KEY",
          message: "Please configure your Gemini API Key in Profile Settings to execute tasks.",
        },
        { status: 400 }
      );
    }

    // 3. Parse allowedDomains and budget
    let allowedDomains: string[] = [];
    try {
      allowedDomains = typeof job.allowedDomains === "string" 
        ? JSON.parse(job.allowedDomains || "[]") 
        : (job.allowedDomains || []);
    } catch {
      allowedDomains = [];
    }

    const maxStepsBudget = job.maxStepsBudget || 15;

    // 4. Run autonomous pipeline directly within this active request
    console.log(`[ExecuteRoute] 🚀 Executing active pipeline for job ${jobId}...`);
    const pipelineResult = await runServerlessPipeline({
      jobId,
      prompt: job.prompt,
      allowedDomains,
      maxStepsBudget,
      apiKey: finalApiKey || undefined,
    });

    // 5. Fetch updated job state
    const updatedJob = await getDbJobById(jobId);

    return NextResponse.json({
      success: pipelineResult.success,
      status: updatedJob?.status || (pipelineResult.success ? "COMPLETED" : "FAILED"),
      job: updatedJob,
      elapsedMs: Date.now() - startTime,
    });
  } catch (err: unknown) {
    console.error(`[ExecuteRoute] ❌ Fatal error executing job ${jobId}:`, err);
    return NextResponse.json(
      {
        error: "EXECUTION_ERROR",
        message: (err as Error).message || "An unexpected error occurred during execution.",
      },
      { status: 500 }
    );
  }
}
