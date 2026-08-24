import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobArtifacts } from "@/lib/db/jobs";

/**
 * GET /api/jobs/:id/artifacts (§27)
 * Returns artifact metadata with ownership validation
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || null;

    const artifacts = await getDbJobArtifacts(id, userId);
    if (!artifacts) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Job not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      jobId: id,
      artifacts,
      count: artifacts.length,
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
