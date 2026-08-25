import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobEvents, getDbJobById } from "@/lib/db/jobs";
import { jobEventBus } from "@/lib/events/jobEvents";

export const dynamic = "force-dynamic";

/**
 * GET /api/jobs/:id/events (§27)
 * High-concurrency Server-Sent Events (SSE) streaming & JSON timeline endpoint
 */
export async function GET(
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
      // Public session support
    }

    const acceptHeader = request.headers.get("accept") || "";
    const isSseRequest = acceptHeader.includes("text/event-stream") || new URL(request.url).searchParams.get("stream") === "true";

    // Handle Server-Sent Events (SSE) Stream
    if (isSseRequest) {
      const responseStream = new TransformStream();
      const writer = responseStream.writable.getWriter();
      const encoder = new TextEncoder();

      const sendEvent = async (event: string, data: unknown) => {
        try {
          const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          await writer.write(encoder.encode(payload));
        } catch {
          // Stream closed by client
        }
      };

      // Send initial state snapshot
      getDbJobById(id, userId).then(async (currentJob) => {
        if (currentJob) {
          await sendEvent("snapshot", currentJob);
        }
      }).catch(() => {});

      // Subscribe to real-time agent updates
      const unsubscribe = jobEventBus.subscribe(id, async ({ event, data }) => {
        await sendEvent(event, data);
      });

      // Cleanup on abort
      request.signal.addEventListener("abort", () => {
        unsubscribe();
        writer.close().catch(() => {});
      });

      return new Response(responseStream.readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    }

    // Standard JSON events response
    const events = await getDbJobEvents(id, userId);
    if (!events) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Job not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json(events);
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
