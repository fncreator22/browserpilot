import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { cancelJob } from "@/lib/queue/cancellation";

/**
 * POST /api/jobs/:id/cancel (§27 / §Prompt C4)
 * Ownership-checked cancellation of in-flight execution, BullMQ queue removal, and browser kill
 */
export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    let userId: string | null = null;
    try {
      const session = await getServerSession(authOptions);
      userId = (session?.user as { id?: string })?.id || null;
    } catch {
      // Allow unauthenticated fallback for public sessions
    }

    const result = await cancelJob(id, userId);

    return NextResponse.json({
      success: true,
      alreadyTerminated: result.alreadyTerminated,
      message: result.alreadyTerminated ? "Job is already in a terminal state." : "Job cancelled successfully.",
      job: result.job,
    });
  } catch (err: unknown) {
    const errorObj = err as Error;
    const errCode = (errorObj as unknown as { code?: string }).code;
    const errorMsg = errorObj.message;

    console.error(`[CancelRoute] Error cancelling job ${id}:`, err);

    if (errCode === "NOT_FOUND" || errorMsg.includes("not found")) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: `Job ${id} does not exist.` },
        { status: 404 }
      );
    }

    if (errCode === "UNAUTHORIZED" || errorMsg.includes("Unauthorized")) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Unauthorized to cancel this job." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        error: "CANCELLATION_FAILED",
        message: errorMsg || "Failed to cancel job.",
      },
      { status: 500 }
    );
  }
}
