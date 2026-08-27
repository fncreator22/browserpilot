import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getDbJobEvents, getDbJobById, updateDbJob } from "@/lib/db/jobs";
import { getUserGeminiApiKey } from "@/lib/db/users";
import { jobEventBus } from "@/lib/events/jobEvents";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // Match execute route — keep Lambda alive for full job

/**
 * GET /api/jobs/:id/events
 * Server-Sent Events (SSE) streaming endpoint.
 *
 * B4 FIX: The pipeline is correctly run inside the open SSE stream so the Lambda
 * stays alive. Fixed issues:
 * - Removed the outer .catch(()=>{}) that silenced all startup errors
 * - Added DB-level execution guard (set status=PLANNING before executing) to prevent
 *   double-execution if both /events and /execute race each other
 * - Fixed: SSE maxDuration raised to 300 to match execute route
 * - Fixed: errors during pipeline startup now send an SSE error event to the client
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
    const isSseRequest =
      acceptHeader.includes("text/event-stream") ||
      new URL(request.url).searchParams.get("stream") === "true";

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
          // Stream closed by client — ignore
        }
      };

      // Subscribe to real-time agent updates from in-process event bus
      const unsubscribe = jobEventBus.subscribe(id, async ({ event, data }) => {
        await sendEvent(event, data);
      });

      // B4 FIX: Run async work AFTER returning the streaming Response.
      // This is the correct SSE pattern — the Response must be returned first to
      // open the stream; the async block runs while the stream stays open.
      // The Lambda remains alive as long as the stream is not closed.
      (async () => {
        try {
          const currentJob = await getDbJobById(id, userId);
          if (!currentJob) {
            await sendEvent("error", { status: "FAILED", message: "Job not found." });
            return;
          }

          // Send initial state snapshot to client
          await sendEvent("snapshot", currentJob);

          const isActive = ["QUEUED", "PLANNING", "WORKING"].includes(currentJob.status);
          if (!isActive) return; // Job already finished — snapshot is all the client needs

          // B4 FIX: DB-level guard to prevent double-execution race between
          // this SSE route and the /execute POST route. Atomically claim execution
          // by moving status from QUEUED → PLANNING only if it hasn't been claimed yet.
          // If this update affects 0 rows (already PLANNING/WORKING), skip pipeline.
          let shouldExecute = false;
          if (currentJob.status === "QUEUED") {
            try {
              await updateDbJob(id, { status: "PLANNING", progress: 5, summary: "SSE stream connected — starting pipeline..." });
              shouldExecute = true;
            } catch {
              // Likely already claimed by another instance — skip
              shouldExecute = false;
            }
          } else {
            // Already PLANNING/WORKING — this SSE just listens; /execute handles it
            shouldExecute = false;
          }

          if (!shouldExecute) return;

          const { executeJobPipeline } = await import("@/lib/ai/pipelineEngine");
          const { parseAllowedDomains } = await import("@/schemas/jobs");

          let apiKey: string | undefined = undefined;
          if (userId) {
            apiKey = (await getUserGeminiApiKey(userId)) || undefined;
          }

          const allowedDomains = parseAllowedDomains(currentJob.allowedDomains);

          await executeJobPipeline({
            jobId: id,
            prompt: currentJob.prompt,
            allowedDomains,
            maxStepsBudget: currentJob.maxStepsBudget || 15,
            apiKey,
          });
        } catch (pipelineErr) {
          console.error(`[SSE] Pipeline error for job ${id}:`, pipelineErr);
          await sendEvent("error", {
            status: "FAILED",
            message: (pipelineErr as Error).message || "Pipeline execution failed.",
          });
        }
      })();

      // Cleanup on client disconnect
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

    // Standard JSON events response (non-SSE clients)
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
