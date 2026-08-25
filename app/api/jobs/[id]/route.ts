import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobById, upsertDbJobFromSync } from "@/lib/db/jobs";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const session = await getServerSession(authOptions);
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

    // Serverless execution: Execute pipeline steps synchronously within function lifecycle
    if (job.status === "QUEUED") {
      try {
        const { processBrowserJob } = await import("@/worker/index");
        const allowed = typeof job.allowedDomains === "string" ? JSON.parse(job.allowedDomains || "[]") : (job.allowedDomains || []);
        
        await Promise.race([
          processBrowserJob({
            jobId: id,
            prompt: job.prompt,
            allowedDomains: allowed,
            maxStepsBudget: job.maxStepsBudget || 15,
          }),
          new Promise((resolve) => setTimeout(resolve, 8000)),
        ]);

        const refreshed = await getDbJobById(id, userId);
        if (refreshed) job = refreshed;
      } catch (err) {
        console.warn(`[JobSync] Execution step error for ${id}:`, err);
      }
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
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || null;
    const body = await request.json().catch(() => ({}));

    const prompt = body.prompt || "Autonomous web automation task";
    const allowedDomains = body.allowedDomains || [];
    const maxStepsBudget = body.maxStepsBudget || 15;

    let job = await upsertDbJobFromSync({
      id,
      prompt,
      userId,
      allowedDomains,
      maxStepsBudget,
    });

    // Serverless execution trigger
    if (job.status === "QUEUED") {
      try {
        const { processBrowserJob } = await import("@/worker/index");
        await Promise.race([
          processBrowserJob({
            jobId: id,
            prompt: job.prompt,
            allowedDomains,
            maxStepsBudget,
          }),
          new Promise((resolve) => setTimeout(resolve, 8000)),
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
