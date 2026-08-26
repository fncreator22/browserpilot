import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobById, upsertDbJobFromSync } from "@/lib/db/jobs";
import { getEffectiveUserGeminiApiKey } from "@/lib/db/users";
import { getEffectiveGeminiApiKey } from "@/lib/ai/modelSelector";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      // Outside active request scope or header context
    }
    const userId = (session?.user as { id?: string })?.id || null;

    let job = await getDbJobById(id, userId);

    // If not found, check if client passed URL query parameters to auto-hydrate across serverless containers
    if (!job) {
      const url = new URL(request.url);
      const queryPrompt = url.searchParams.get("prompt");
      if (queryPrompt) {
        job = await upsertDbJobFromSync({
          id,
          prompt: queryPrompt,
          userId,
        });
      }
    }

    if (!job) {
      return NextResponse.json(
        {
          error: "JOB_NOT_FOUND",
          message: `Job with ID "${id}" was not found or access is unauthorized.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      job,
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

/**
 * POST /api/jobs/[id]
 * Re-hydrate or sync job across stateless serverless container instances
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    let session = null;
    try {
      session = await getServerSession(authOptions);
    } catch {
      // Outside active request scope or header context
    }
    const userId = (session?.user as { id?: string })?.id || null;
    const userEmail = (session?.user as { email?: string })?.email || null;
    const body = await request.json().catch(() => ({}));

    const prompt = body.prompt || "Autonomous web automation task";
    const { parseAllowedDomains } = await import("@/schemas/jobs");
    const allowedDomains = parseAllowedDomains(body.allowedDomains);
    const maxStepsBudget = body.maxStepsBudget || 15;

    let job = await upsertDbJobFromSync({
      id,
      prompt,
      userId,
      allowedDomains,
      maxStepsBudget,
    });

    // Serverless execution trigger
    if (["QUEUED", "PLANNING"].includes(job.status)) {
      try {
        const { executeJobPipeline } = await import("@/lib/ai/pipelineEngine");
        const resolvedKey = await getEffectiveUserGeminiApiKey(userId || userEmail || job.userId);
        const apiKey = getEffectiveGeminiApiKey(body.apiKey || resolvedKey);

        await Promise.race([
          executeJobPipeline({
            jobId: id,
            prompt: job.prompt,
            allowedDomains,
            maxStepsBudget,
            apiKey: apiKey || undefined,
          }),
          new Promise((resolve) => setTimeout(resolve, 15000)),
        ]);

        const refreshed = await getDbJobById(id, userId);
        if (refreshed) job = refreshed;
      } catch (err) {
        console.warn(`[JobSync] Execution error for ${id}:`, err);
      }
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "SYNC_FAILED",
        message: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
