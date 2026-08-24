import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { retryDbJob, getDbJobById } from "@/lib/db/jobs";
import { enqueueBrowserJob } from "@/lib/queue/jobQueue";
import { checkUserJobLimits } from "@/lib/auth/limits";

/**
 * POST /api/jobs/:id/retry (§27)
 * Ownership-checked retry of completed/failed execution
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

    const existingJob = await getDbJobById(id, userId);
    if (!existingJob) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Job not found or access denied." },
        { status: 404 }
      );
    }

    if (userId) {
      const limitCheck = await checkUserJobLimits(userId);
      if (!limitCheck.allowed) {
        return NextResponse.json(
          {
            error: limitCheck.errorCode,
            message: limitCheck.message,
          },
          { status: 429 }
        );
      }
    }

    let parsedDomains: string[] = [];
    try {
      parsedDomains = JSON.parse(existingJob.allowedDomains);
    } catch {}

    // Dispatch fresh retry job
    const retried = await enqueueBrowserJob({
      prompt: existingJob.prompt,
      userId: existingJob.userId || undefined,
      allowedDomains: parsedDomains,
      maxStepsBudget: existingJob.maxStepsBudget,
    });

    return NextResponse.json({
      success: true,
      message: "Retry job dispatched successfully.",
      originalJobId: id,
      newJobId: retried.jobId,
      status: retried.status,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: "RETRY_FAILED",
        message: (err as Error).message,
      },
      { status: 500 }
    );
  }
}
