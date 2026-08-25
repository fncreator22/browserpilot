/**
 * SERVERLESS-SAFE pipeline runner.
 * Exports ONLY processBrowserJob without importing BullMQ, Redis, or Worker — 
 * which would crash Vercel serverless lambdas immediately on module load.
 *
 * The SSE events route imports THIS file, not worker/index.ts.
 */

import { config } from "dotenv";
import { 
  updateDbJob, 
  recordDbJobStep, 
  recordDbObservation, 
  recordDbArtifact 
} from "@/lib/db/jobs";
import path from "node:path";
import { runAutonomousPipeline, type PipelineResult } from "@/lib/ai/pipeline";
import { synthesizeFinalAnswerWithMetadata } from "@/lib/ai/synthesizer";
import { calculateJobTimeBudget } from "@/lib/capabilities/timeBudget";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";
import { jobEventBus } from "@/lib/events/jobEvents";

config();

export interface ServerlessBrowserJobPayload {
  jobId: string;
  prompt: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  apiKey?: string;
}

/**
 * Serverless-safe pipeline executor.
 * Identical execution logic to worker/index.ts processBrowserJob
 * but with NO BullMQ/Redis imports so it can safely run in Vercel Lambda.
 */
export async function runServerlessPipeline(
  jobData: ServerlessBrowserJobPayload
): Promise<PipelineResult> {
  const { jobId, prompt, allowedDomains = [], maxStepsBudget = 15 } = jobData;
  console.log(`\n[Serverless] 🚀 Running Job ${jobId} -> "${prompt.slice(0, 60)}..."`);

  const budgetResult = calculateJobTimeBudget({
    prompt,
    allowedDomains,
    maxStepsBudget,
  });
  const maxDurationMs = budgetResult.budgetMs;
  const startedAt = new Date();

  // 1. Update status to PLANNING
  await updateDbJob(jobId, {
    status: "PLANNING",
    progress: 10,
    startedAt,
    maxDurationMs,
    summary: `Decomposing goal into structured tool steps (time budget: ${Math.round(maxDurationMs / 1000)}s)...`,
  }).catch(() => {});

  jobEventBus.emitJobEvent(jobId, "status", {
    status: "PLANNING",
    progress: 10,
    summary: "Decomposing goal into structured tool steps...",
  });

  let timeoutTimer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      console.warn(`[Serverless] ⏱️ Time budget (${maxDurationMs}ms) exceeded for Job ${jobId}`);
      reject(new Error("TASK_TIMED_OUT: This task took longer than expected and was stopped automatically."));
    }, maxDurationMs);
  });

  try {
    const pipelineResult = await Promise.race([
      runAutonomousPipeline(prompt, {
        jobId,
        allowedDomains,
        maxStepsBudget,
        apiKey: jobData.apiKey,
        onIntentClassified: async (intent) => {
          await updateDbJob(jobId, {
            status: "PLANNING",
            progress: 25,
            summary: `Intent classified as ${intent.classification}`,
          }).catch(() => {});
          jobEventBus.emitJobEvent(jobId, "intent", intent);
        },
        onGuardEvaluated: async (guard) => {
          await updateDbJob(jobId, {
            status: "PLANNING",
            progress: 40,
            summary: guard.userMessage,
          }).catch(() => {});
          jobEventBus.emitJobEvent(jobId, "guard", guard);
        },
        onPlanGenerated: async (plan) => {
          await updateDbJob(jobId, {
            status: "PLANNING",
            progress: 55,
            summary: `Plan generated with ${plan.steps.length} tool steps.`,
          }).catch(() => {});
          for (const step of plan.steps) {
            await recordDbJobStep(jobId, step).catch(() => {});
          }
          jobEventBus.emitJobEvent(jobId, "plan", plan);
        },
        onPlanValidated: async (validation) => {
          await updateDbJob(jobId, {
            status: "PLANNING",
            progress: 65,
            summary: validation.summary,
          }).catch(() => {});
          jobEventBus.emitJobEvent(jobId, "plan_validated", validation);
        },
        onStepProgress: async (stepNum, total, tool) => {
          const pct = Math.min(65 + Math.round((stepNum / total) * 25), 90);
          await updateDbJob(jobId, {
            status: "WORKING",
            progress: pct,
            summary: `Executing Step ${stepNum}/${total} [${tool}]...`,
          }).catch(() => {});
          jobEventBus.emitJobEvent(jobId, "step", { step: stepNum, total, tool, progress: pct });
        },
      }),
      timeoutPromise,
    ]);

    if (timeoutTimer) clearTimeout(timeoutTimer);

    // 2. Persist Observations and Artifacts
    if (pipelineResult.execution) {
      for (const obs of pipelineResult.execution.observations) {
        await recordDbObservation(jobId, obs).catch(() => {});
        if (obs.screenshotPath) {
          const actualFilename = path.basename(obs.screenshotPath);
          await recordDbArtifact(jobId, {
            filename: actualFilename,
            storageKey: obs.screenshotPath,
            mimeType: "image/png",
          }).catch(() => {});
        }
        jobEventBus.emitJobEvent(jobId, "observation", obs);
      }
    }

    // 3. Synthesize final answer
    const observations = pipelineResult.execution?.observations || [];
    const extractedData = observations
      .filter((o) => o.extractedData)
      .map((o) => o.extractedData)
      .join("\n");
    const pageContext = observations.map((o) => `${o.title}: ${o.pageSummary || ""}`.trim()).join(". ");

    let finalAnswer = "";
    let answerTokens = 0;

    if (pipelineResult.success && observations.length > 0) {
      await updateDbJob(jobId, {
        status: "VERIFYING",
        progress: 92,
        summary: "Synthesizing final answer and verification...",
      }).catch(() => {});
      jobEventBus.emitJobEvent(jobId, "status", { status: "VERIFYING", progress: 92 });

      const synthesis = await synthesizeFinalAnswerWithMetadata({
        goal: prompt,
        verificationStatus: "PARTIAL",
        extractedData: extractedData || pageContext,
        observations,
        apiKey: jobData.apiKey,
      }).catch(() => ({ answer: extractedData || pageContext || "Task completed.", tokensUsed: 0 }));

      finalAnswer = synthesis.answer;
      answerTokens = synthesis.tokensUsed || 0;
    }

    const totalDurationMs = Date.now() - startedAt.getTime();
    const rssMemoryMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const intentTokens = (pipelineResult.intent as unknown as { tokensUsed?: number })?.tokensUsed || 0;
    const planTokens = (pipelineResult.plan as unknown as { tokensUsed?: number })?.tokensUsed || 0;
    const totalTokens = intentTokens + planTokens + answerTokens;

    const finalStatus = pipelineResult.success ? "COMPLETED" : (pipelineResult.execution?.status === "BLOCKED" ? "BLOCKED" : "FAILED");

    await updateDbJob(jobId, {
      status: finalStatus as "COMPLETED" | "FAILED" | "BLOCKED",
      progress: 100,
      summary: pipelineResult.success ? (finalAnswer || "Task completed successfully.") : (pipelineResult.error?.userMessage || "Task failed."),
      completedAt: new Date(),
      totalDurationMs,
      tokensUsed: totalTokens,
      memoryMb: rssMemoryMb,
    }).catch(() => {});

    jobEventBus.emitJobEvent(jobId, "complete", {
      status: finalStatus,
      summary: finalAnswer || pipelineResult.error?.userMessage || "Task completed.",
      progress: 100,
      durationMs: totalDurationMs,
      tokensUsed: totalTokens,
      memoryMb: rssMemoryMb,
    });

    return pipelineResult;
  } catch (err: unknown) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    const isTimeout = (err instanceof Error) && err.message.startsWith("TASK_TIMED_OUT:");
    const humanError = mapInternalErrorToHuman(err);
    const totalDurationMs = Date.now() - startedAt.getTime();

    const failedStatus = isTimeout ? "FAILED" : (humanError.code === "SECURITY_POLICY_VIOLATION" ? "BLOCKED" : "FAILED");

    await updateDbJob(jobId, {
      status: failedStatus as "FAILED" | "BLOCKED",
      progress: 100,
      summary: humanError.userMessage,
      completedAt: new Date(),
      totalDurationMs,
    }).catch(() => {});

    jobEventBus.emitJobEvent(jobId, "error", {
      status: failedStatus,
      code: humanError.code,
      message: humanError.userMessage,
      progress: 100,
    });

    return {
      jobId,
      prompt,
      intent: null as any,
      guard: null as any,
      plannerCalled: false,
      success: false,
      durationMs: totalDurationMs,
      error: {
        code: humanError.code,
        message: humanError.technicalDetail || humanError.userMessage,
        userMessage: humanError.userMessage,
      },
    };
  }
}
