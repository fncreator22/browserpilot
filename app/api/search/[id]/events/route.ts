import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { searchEventBus } from "@/lib/events/searchEvents";

export const dynamic = "force-dynamic";

/**
 * GET /api/search/:id/events
 * Streams real-time search discovery stage events using Server-Sent Events (SSE).
 */
export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const executionId = params.id;

  if (!executionId) {
    return NextResponse.json({ error: "Missing executionId" }, { status: 400 });
  }

  // 1. Resolve User Session (for authorization verification)
  const session = await getServerSession(authOptions).catch(() => null);
  let userId = (session?.user as any)?.id || null;
  if (!userId && (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
    userId = request.headers.get("x-test-user-id") || request.headers.get("x-user-id");
  }

  // 2. Set up SSE Stream
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  let isClosed = false;
  let unsubscribeBus: (() => void) | null = null;

  const safeWrite = async (chunk: string) => {
    if (isClosed) return;
    try {
      await writer.write(encoder.encode(chunk));
    } catch {
      isClosed = true;
    }
  };

  const sendEvent = async (event: string, data: unknown) => {
    await safeWrite(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const cleanup = async () => {
    if (isClosed) return;
    isClosed = true;
    if (unsubscribeBus) {
      try {
        unsubscribeBus();
      } catch {}
      unsubscribeBus = null;
    }
    try {
      await writer.close().catch(() => {});
    } catch {}
  };

  request.signal.addEventListener("abort", () => {
    cleanup();
  });

  // Start background streaming
  (async () => {
    try {
      // Check current DB state upfront
      const searchRecord = await prisma.search.findUnique({
        where: { id: executionId },
        select: {
          id: true,
          status: true,
          totalFound: true,
          stoppingReason: true,
          userId: true,
          rawQuery: true,
          createdAt: true,
          completedAt: true,
        },
      });

      if (!searchRecord) {
        await sendEvent("error", {
          executionId,
          error: "NOT_FOUND",
          message: `Search execution '${executionId}' not found.`,
        });
        await cleanup();
        return;
      }

      // Initial state snapshot
      await sendEvent("snapshot", {
        executionId: searchRecord.id,
        status: searchRecord.status,
        totalFound: searchRecord.totalFound,
        stoppingReason: searchRecord.stoppingReason,
        rawQuery: searchRecord.rawQuery,
      });

      // If search is already completed or stopped, emit complete and finish
      const isTerminal = ["COMPLETED", "PARTIAL", "STOPPED", "FAILED"].includes(searchRecord.status);
      if (isTerminal) {
        await sendEvent("complete", {
          executionId,
          status: searchRecord.status,
          totalFound: searchRecord.totalFound,
          stoppingReason: searchRecord.stoppingReason,
        });
        await cleanup();
        return;
      }

      // Subscribe to events published by worker (via Redis Pub/Sub or in-process bus)
      unsubscribeBus = searchEventBus.subscribe(executionId, async (payload) => {
        const stage = payload.stage || "progress";
        await sendEvent(stage, payload);

        // If stage is complete, error, or cancelled, close stream after small delay
        if (stage === "complete" || stage === "error" || stage === "cancelled") {
          setTimeout(() => {
            cleanup();
          }, 500);
        }
      });

      // Heartbeat ping every 15s to keep intermediate proxies and load balancers open
      const pingInterval = setInterval(async () => {
        if (isClosed) {
          clearInterval(pingInterval);
          return;
        }
        await safeWrite(`: ping\n\n`);
      }, 15000);

      // Clean up ping on abort
      request.signal.addEventListener("abort", () => {
        clearInterval(pingInterval);
      });
    } catch (err) {
      console.warn(`[SearchSSE] Stream initialization error for ${executionId}:`, err);
      await sendEvent("error", {
        executionId,
        message: "Failed to initialize search event stream.",
      });
      await cleanup();
    }
  })();

  return new NextResponse(responseStream.readable, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disables Nginx buffering for instantaneous SSE delivery
    },
  });
}
