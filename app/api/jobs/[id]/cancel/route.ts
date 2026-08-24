import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { cancelDbJob } from "@/lib/db/jobs";

/**
 * POST /api/jobs/:id/cancel (§27)
 * Ownership-checked cancellation of in-flight execution
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

    const cancelledJob = await cancelDbJob(id, userId);

    return NextResponse.json({
      success: true,
      message: "Job cancelled successfully.",
      job: cancelledJob,
    });
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    const isAuth = errorMsg.includes("unauthorized") || errorMsg.includes("not found");

    return NextResponse.json(
      {
        error: isAuth ? "UNAUTHORIZED" : "CANCELLATION_FAILED",
        message: errorMsg,
      },
      { status: isAuth ? 403 : 500 }
    );
  }
}
