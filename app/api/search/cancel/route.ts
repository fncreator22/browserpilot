import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { executionKeyRegistry } from "@/lib/discovery/execution/executionKeyRegistry";
import { getSearchDiscoveryQueue } from "@/lib/queue/searchQueue";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id || null;

    if (
      !userId &&
      (process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV === "test" ||
        (process.env as any).IS_TEST_HARNESS === "true")
    ) {
      const headerUser = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
      if (headerUser) userId = headerUser;
    }

    const body = await request.json().catch(() => ({}));
    let targetExecutionId = (body.executionId || body.searchId) as string | undefined;
    if (typeof targetExecutionId !== "string" || !targetExecutionId.trim()) {
      targetExecutionId = undefined;
    } else {
      targetExecutionId = targetExecutionId.trim();
    }

    if (!userId && !targetExecutionId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication or executionId required to cancel an execution." },
        { status: 401 }
      );
    }

    const isAdmin = (session?.user as any)?.role === "ADMIN" || (session?.user as any)?.role === "SUPERADMIN";

    // Multi-tenant protection: verify ownership BEFORE revoking or killing the key
    if (targetExecutionId) {
      const existing = await prisma.search.findUnique({
        where: { id: targetExecutionId },
        select: { userId: true },
      }).catch(() => null);

      if (existing?.userId && !isAdmin) {
        if (!userId || existing.userId !== userId) {
          return NextResponse.json(
            { error: "FORBIDDEN", message: "You do not have permission to cancel this search execution." },
            { status: 403 }
          );
        }
      }
    }

    if (body.cancelActive || !targetExecutionId) {
      if (!userId) {
        return NextResponse.json(
          { error: "UNAUTHORIZED", message: "Authentication required to cancel active searches." },
          { status: 401 }
        );
      }
      const activeSearches = await prisma.search.findMany({
        where: { userId, status: { in: ["CREATED", "QUEUED", "RUNNING"] } },
        select: { id: true },
      });
      for (const s of activeSearches) {
        await executionKeyRegistry.killExecutionKey(s.id, body.reason || "CANCELLED_BY_USER", userId);
        await executionLifecycleManager.cancelExecution(s.id, userId, body.reason || "CANCELLED_BY_USER");
      }
      if (!targetExecutionId && activeSearches.length > 0) {
        targetExecutionId = activeSearches[0].id;
      }
    }

    if (!targetExecutionId) {
      return NextResponse.json({
        success: true,
        status: "STOPPED",
        stoppingReason: "CANCELLED_BY_USER",
        message: "No active execution was found to cancel.",
      });
    }

    const cancellationReason = body.reason || "CANCELLED_BY_USER";

    // 1. Atomic Execution Key Kill: instantly revoke key from memory registry, Redis, and AbortControllers
    await executionKeyRegistry.killExecutionKey(targetExecutionId, cancellationReason, userId);

    // 2. Try to remove from BullMQ queue if still waiting
    try {
      const queue = getSearchDiscoveryQueue();
      const job = await queue.getJob(targetExecutionId);
      if (job && (await job.isWaiting())) {
        await job.remove();
      }
    } catch {}

    // 3. Signal in-flight cancellation across worker and Redis channels
    try {
      const { cancelJob } = await import("@/lib/queue/cancellation");
      await cancelJob(targetExecutionId, userId);
    } catch {}

    const cancelResult = await executionLifecycleManager.cancelExecution(
      targetExecutionId,
      userId,
      cancellationReason
    );

    return NextResponse.json({
      success: true,
      executionId: targetExecutionId,
      status: "STOPPED",
      stoppingReason: cancellationReason,
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
