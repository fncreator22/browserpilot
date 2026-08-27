import { NextRequest, NextResponse } from "next/server";
import { getDbJobById } from "@/lib/db/jobs";
import { dispatchWebhook } from "@/lib/events/webhookDispatcher";
import { z } from "zod";

export const dynamic = "force-dynamic";

const WebhookRequestSchema = z.object({
  targetUrl: z.string().url("Must be a valid HTTPS webhook URL"),
  secretKey: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const parsed = WebhookRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "INVALID_WEBHOOK_PAYLOAD", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const job = await getDbJobById(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "JOB_NOT_FOUND", message: `Job ${jobId} not found.` },
        { status: 404 }
      );
    }

    let parsedDataset: unknown = job.result;
    if (typeof job.result === "string") {
      try {
        parsedDataset = JSON.parse(job.result);
      } catch {}
    }

    const result = await dispatchWebhook(
      parsed.data.targetUrl,
      {
        event: job.status === "COMPLETED" ? "job.completed" : "job.failed",
        jobId: job.id,
        goal: job.prompt,
        status: job.status,
        summary: job.summary || "",
        dataset: parsedDataset as Array<Record<string, unknown>>,
        totalDurationMs: job.totalDurationMs || undefined,
        tokensUsed: job.tokensUsed || undefined,
        completedAt: (job.completedAt || new Date()).toISOString(),
      },
      parsed.data.secretKey
    );

    return NextResponse.json({
      success: result.success,
      statusCode: result.statusCode,
      attempts: result.attempts,
      error: result.error,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "WEBHOOK_DISPATCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
