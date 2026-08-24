import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobById } from "@/lib/db/jobs";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id || null;

    const job = await getDbJobById(id, userId);
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
