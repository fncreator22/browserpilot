import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobEvents, getDbJobById } from "@/lib/db/jobs";
import { getUserGeminiApiKey } from "@/lib/db/users";
import { jobEventBus } from "@/lib/events/jobEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Max serverless stream duration

/**
 * GET /api/jobs/:id/events (§27)
 * Server-Sent Events (SSE) streaming endpoint.
 * Executes the autonomous pipeline INSIDE the active SSE stream connection
 * to prevent Vercel Lambda freeze (frozen background promises).
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

      // Subscribe to real-time agent updates from in-process event bus
      const unsubscribe = jobEventBus.subscribe(id, async ({ event, data }) => {
        await sendEvent(event, data);
      });

      // Send initial snapshot and trigger pipeline inside the open stream
      getDbJobById(id, userId).then(async (currentJob) => {
        if (currentJob) {
          await sendEvent("snapshot", currentJob);

          // Execute pipeline INSIDE active stream connection (prevents serverless freeze)
          const isActive = ["QUEUED", "PLANNING", "WORKING"].includes(currentJob.status);
          if (isActive) {
            try {
              // CRITICAL: import serverlessPipeline (NOT worker/index which has BullMQ)
              const { runServerlessPipeline } = await import("@/lib/serverlessPipeline");

              let apiKey: string | undefined = undefined;
              if (userId) {
                apiKey = (await getUserGeminiApiKey(userId)) || undefined;
              }

              let allowedDomains: string[] = [];
              try { allowedDomains = JSON.parse(currentJob.allowedDomains || "[]"); } catch { allowedDomains = []; }

              await runServerlessPipeline({
                jobId: id,
                prompt: currentJob.prompt,
                allowedDomains,
                maxStepsBudget: currentJob.maxStepsBudget || 15,
                apiKey,
              });
            } catch (pipelineErr) {
              console.error(`[SSE Pipeline Error for ${id}]:`, pipelineErr);
              await sendEvent("error", {
                status: "FAILED",
                message: (pipelineErr as Error).message || "Pipeline execution failed.",
              });
            }
          }
        }
      }).catch(() => {});

      // Cleanup on disconnect
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
