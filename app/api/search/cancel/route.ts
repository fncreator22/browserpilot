import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id || null;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to cancel an execution." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const executionId = body.executionId || body.searchId;

    if (!executionId || typeof executionId !== "string") {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required executionId parameter." },
        { status: 400 }
      );
    }

    const cancelResult = await executionLifecycleManager.cancelExecution(
      executionId,
      userId,
      body.reason || "CANCELLED_BY_USER"
    );

    return NextResponse.json({
      success: cancelResult.success,
      executionId,
      status: cancelResult.status,
      alreadyStopped: cancelResult.alreadyStopped ?? false,
    });
  } catch (err: unknown) {
    const msg = (err as Error).message || "Failed to cancel search execution.";
    const isAuth = msg.includes("Unauthorized");
    return NextResponse.json(
      { error: isAuth ? "FORBIDDEN" : "INTERNAL_ERROR", message: msg },
      { status: isAuth ? 403 : 500 }
    );
  }
}
