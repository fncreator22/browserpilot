/**
 * UNIFIED AUTONOMOUS AGENT PIPELINE ENGINE
 * Shared by Serverless execution endpoints, active SSE streams, and background workers.
 * Provides unified state transitions, time budget watchdogs, database persistence, and answer synthesis.
 */

import { config } from "dotenv";
import path from "node:path";
import { 
  updateDbJob, 
  recordDbJobStep, 
  recordDbObservation, 
  recordDbArtifact 
} from "@/lib/db/jobs";
import { runAutonomousPipeline, type PipelineResult } from "@/lib/ai/pipeline";
import { synthesizeFinalAnswerWithMetadata } from "@/lib/ai/synthesizer";
import { calculateJobTimeBudget } from "@/lib/capabilities/timeBudget";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";
import { jobEventBus } from "@/lib/events/jobEvents";

config();

export interface PipelineExecutionInput {
  jobId: string;
  prompt: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
  apiKey?: string;
  headless?: boolean;
}

/**
 * Execute an autonomous browser job through the full unified pipeline
 */
export async function executeJobPipeline(
  input: PipelineExecutionInput
): Promise<PipelineResult> {
  const { jobId, prompt, allowedDomains = [], maxStepsBudget = 15, apiKey, headless } = input;
  console.log(`\n[PipelineEngine] 🚀 Running Job ${jobId} -> "${prompt.slice(0, 60)}..."`);

  const budgetResult = calculateJobTimeBudget({
    prompt,
    allowedDomains,
    maxStepsBudget,
  });
  const maxDurationMs = budgetResult.budgetMs;
  const startedAt = new Date();

  // 1. Initial State: PLANNING
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
      console.warn(`[PipelineEngine] ⏱️ Time budget (${maxDurationMs}ms) exceeded for Job ${jobId}`);
      reject(new Error("TASK_TIMED_OUT: This task took longer than expected and was stopped automatically."));
    }, maxDurationMs);
  });

  try {
    const pipelineResult = await Promise.race([
      runAutonomousPipeline(prompt, {
        jobId,
        allowedDomains,
        maxStepsBudget,
        apiKey,
        headless,
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

    // 2. Persist Observations and Visual Artifacts
    if (pipelineResult.execution) {
      for (const obs of pipelineResult.execution.observations) {
        await recordDbObservation(jobId, obs).catch(() => {});
        if (obs.screenshotPath) {
          const actualFilename = path.basename(obs.screenshotPath);
          await recordDbArtifact(jobId, {
            filename: actualFilename,
            storageKey: obs.screenshotStorageKey || obs.screenshotPath,
            mimeType: "image/png",
          }).catch(() => {});
        }
        jobEventBus.emitJobEvent(jobId, "observation", obs);
      }
    }

    // 3. Synthesize Grounded Final Answer
    const observations = pipelineResult.execution?.observations || [];
    const extractedData = observations
      .filter((o) => o.extractedData)
      .map((o) => o.extractedData)
      .join("\n");
    const pageContext = observations.map((o) => `${o.title}: ${o.pageSummary || ""}`.trim()).join(". ");

    let finalAnswer = "";
    let structuredResult: string | undefined = undefined;
    let answerTokens = 0;

    if (pipelineResult.success && observations.length > 0) {
      await updateDbJob(jobId, {
        status: "VERIFYING",
        progress: 92,
        summary: "Synthesizing final answer and structured dataset...",
      }).catch(() => {});
      jobEventBus.emitJobEvent(jobId, "status", { status: "VERIFYING", progress: 92 });

      // 1. Textual Executive Synthesis
      const synthesis = await synthesizeFinalAnswerWithMetadata({
        goal: prompt,
        verificationStatus: "PARTIAL",
        extractedData: extractedData || pageContext,
        observations,
        apiKey,
      }).catch(() => ({ answer: extractedData || pageContext || "Task completed.", tokensUsed: 0 }));

      finalAnswer = synthesis.answer;
      answerTokens = synthesis.tokensUsed || 0;

      // 2. Autonomous Structured Dataset Extraction (if prompt requests data/list/table/products/jobs)
      try {
        const fullContent = extractedData || pageContext;
        if (fullContent && fullContent.length > 50) {
          const { inferExtractionSchema, extractStructuredData } = await import("@/lib/scraper/schemaInferrer");
          const { distillHtml } = await import("@/lib/scraper/distiller");

          const cleanedText = distillHtml(fullContent, { maxCharacters: 25000 });
          const schema = await inferExtractionSchema(prompt, apiKey);
          const dataset = await extractStructuredData(cleanedText, schema, prompt, apiKey);

          if (dataset.items && dataset.items.length > 0) {
            const { normalizeAndDeduplicateJobs } = await import("@/lib/scraper/normalizer");
            const normalized = normalizeAndDeduplicateJobs(dataset.items);
            structuredResult = JSON.stringify(normalized.length > 0 ? normalized : dataset.items, null, 2);
          }
        }
      } catch (extractErr) {
        console.warn(`[PipelineEngine] Structured table extraction fallback:`, extractErr);
      }
    }

    const totalDurationMs = Date.now() - startedAt.getTime();
    const rssMemoryMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const intentTokens = (pipelineResult.intent as unknown as { tokensUsed?: number })?.tokensUsed || 0;
    const planTokens = (pipelineResult.plan as unknown as { tokensUsed?: number })?.tokensUsed || 0;
    const totalTokens = intentTokens + planTokens + answerTokens;

    const isBlocked = 
      pipelineResult.guard?.classification === "BLOCKED" ||
      pipelineResult.guard?.classification === "REQUIRES_AUTH" ||
      pipelineResult.execution?.status === "BLOCKED" ||
      pipelineResult.error?.code === "SECURITY_POLICY_VIOLATION" ||
      pipelineResult.error?.code === "REQUIRES_AUTHENTICATION";

    const finalStatus = pipelineResult.success
      ? "COMPLETED"
      : (isBlocked ? "BLOCKED" : "FAILED");

    const summaryText = pipelineResult.success
      ? (finalAnswer || "Task completed successfully.")
      : (pipelineResult.error?.userMessage || "Task failed.");

    await updateDbJob(jobId, {
      status: finalStatus as "COMPLETED" | "FAILED" | "BLOCKED",
      progress: 100,
      summary: summaryText,
      result: structuredResult || finalAnswer || undefined,
      completedAt: new Date(),
      totalDurationMs,
      tokensUsed: totalTokens,
      memoryMb: rssMemoryMb,
    }).catch(() => {});

    jobEventBus.emitJobEvent(jobId, "complete", {
      status: finalStatus,
      summary: summaryText,
      result: structuredResult || finalAnswer || undefined,
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

    const failedStatus = isTimeout
      ? "FAILED"
      : (humanError.code === "SECURITY_POLICY_VIOLATION" ? "BLOCKED" : "FAILED");

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
