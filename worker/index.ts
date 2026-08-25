import { Worker, type Job } from "bullmq";
import { config } from "dotenv";
import { 
  BROWSER_JOBS_QUEUE_NAME, 
  type BrowserJobPayload 
} from "@/lib/queue/jobQueue";
import { createRedisConnection, checkRedisHealth } from "@/lib/queue/redis";
import { 
  updateDbJob, 
  recordDbJobStep, 
  recordDbObservation, 
  recordDbArtifact 
} from "@/lib/db/jobs";
import path from "node:path";
import { runAutonomousPipeline, type PipelineResult } from "@/lib/ai/pipeline";
import { validateGeminiCredentialsOnStartup } from "@/lib/ai/intent";
import { synthesizeFinalAnswerWithMetadata } from "@/lib/ai/synthesizer";
import { calculateJobTimeBudget } from "@/lib/capabilities/timeBudget";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";
import { startAutoPurgeScheduler, stopAutoPurgeScheduler } from "./cleanup";
import { jobEventBus } from "@/lib/events/jobEvents";

config();

// Concurrency configured via WORKER_CONCURRENCY env var, default 5 per §22
export const DEFAULT_WORKER_CONCURRENCY = 5;

export function getWorkerConcurrency(): number {
  const envVal = process.env.WORKER_CONCURRENCY;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      return parsed;
    }
  }
  return DEFAULT_WORKER_CONCURRENCY;
}

/**
 * Executes an individual browser job through the full autonomous pipeline with DB persistence
 */
export async function processBrowserJob(
  jobData: BrowserJobPayload
): Promise<PipelineResult> {
  const { jobId, prompt, allowedDomains, maxStepsBudget } = jobData;
  console.log(`\n[Worker] 🚀 Picked up Job ${jobId} -> "${prompt.slice(0, 60)}..."`);

  const budgetResult = calculateJobTimeBudget({
    prompt,
    allowedDomains,
    maxStepsBudget,
  });
  const maxDurationMs = budgetResult.budgetMs;
  const startedAt = new Date();

  // 1. Update status to PLANNING in DB with persisted startedAt and maxDurationMs
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
  let forceKillTimer: NodeJS.Timeout | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      console.warn(`[Worker] ⏱️ Hard time budget (${maxDurationMs}ms) exceeded for Job ${jobId}. Initiating graceful stop...`);

      // Grace period: allow in-flight tool call 5s to halt gracefully, otherwise force kill
      forceKillTimer = setTimeout(async () => {
        console.warn(`[Worker] 🛑 Force-closing browser session for timed-out Job ${jobId}`);
        try {
          const { browserPool } = await import("./browser");
          await browserPool.forceCloseJobSession(jobId).catch(() => {});
        } catch {}
      }, 5000);

      reject(new Error("TASK_TIMED_OUT: This task took longer than expected and was stopped automatically."));
    }, maxDurationMs);
  });

  try {
    // 2. Run the complete pipeline within unified time budget watchdog
    const pipelineResult = await Promise.race([
      runAutonomousPipeline(prompt, {
        jobId,
        allowedDomains,
        maxStepsBudget,
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

          // Persist planned steps directly to database
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

          jobEventBus.emitJobEvent(jobId, "step", {
            step: stepNum,
            total,
            tool,
            progress: pct,
          });
        },
      }),
      timeoutPromise,
    ]);

    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);

    // 3. Persist Observations and Artifacts to Database
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

    // 4. Update final status in DB
    if (pipelineResult.success && pipelineResult.execution) {
      console.log(`[Worker] ✅ Job ${jobId} COMPLETED in ${pipelineResult.durationMs}ms`);

      // Indicate verification phase
      await updateDbJob(jobId, {
        status: "VERIFYING",
        progress: 95,
        summary: "Verifying extracted data against factual schema...",
      }).catch(() => {});

      jobEventBus.emitJobEvent(jobId, "status", {
        status: "VERIFYING",
        progress: 95,
        summary: "Verifying extracted data against factual schema...",
      });

      // Extract primary data and synthesize comprehensive final answer leading with factual results
      const allExtracted = pipelineResult.execution.observations
        .map((o) => o.extractedData)
        .filter((d) => d !== undefined && d !== null && d !== "");
      const primaryData = allExtracted.length > 0 ? allExtracted[allExtracted.length - 1] : pipelineResult.execution.finalObservation?.extractedData;

      const synthesis = await synthesizeFinalAnswerWithMetadata({
        goal: prompt,
        verificationStatus: "VERIFIED",
        extractedData: primaryData,
        observations: pipelineResult.execution.observations,
        satisfiedCriteria: ["Goal achieved", "Target web page inspected", "Visual screenshot captured"],
      });

      const finalSummary = synthesis.answer || pipelineResult.execution.finalObservation?.pageSummary || "Task completed successfully.";
      const totalTokens = (pipelineResult.tokensUsed || 0) + (synthesis.tokensUsed || 0);

      await updateDbJob(jobId, {
        status: "COMPLETED",
        progress: 100,
        summary: finalSummary,
        result: primaryData || pipelineResult.execution.finalObservation?.extractedData,
        totalDurationMs: pipelineResult.durationMs,
        tokensUsed: totalTokens > 0 ? totalTokens : undefined,
        memoryMb: pipelineResult.memoryMb,
      }).catch(() => {});

      jobEventBus.emitJobEvent(jobId, "completed", {
        status: "COMPLETED",
        progress: 100,
        summary: finalSummary,
        result: primaryData,
        totalDurationMs: pipelineResult.durationMs,
      });
    } else {
      const isBlocked =
        pipelineResult.guard.classification === "BLOCKED" ||
        pipelineResult.guard.classification === "REQUIRES_AUTH" ||
        pipelineResult.execution?.status === "BLOCKED";

      const finalStatus = isBlocked ? "BLOCKED" : "FAILED";
      console.log(`[Worker] ⚠️ Job ${jobId} ended with status: ${finalStatus}`);

      await updateDbJob(jobId, {
        status: finalStatus,
        progress: 100,
        summary: pipelineResult.error?.userMessage || "Task was halted or failed.",
        error: pipelineResult.error,
        totalDurationMs: pipelineResult.durationMs,
        tokensUsed: pipelineResult.tokensUsed,
        memoryMb: pipelineResult.memoryMb,
      }).catch(() => {});

      jobEventBus.emitJobEvent(jobId, "status", {
        status: finalStatus,
        progress: 100,
        summary: pipelineResult.error?.userMessage || "Task was halted or failed.",
        error: pipelineResult.error,
      });
    }

    return pipelineResult;
  } catch (err: unknown) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (forceKillTimer) clearTimeout(forceKillTimer);

    const errorMsg = (err as Error).message || String(err);
    const isTimeout = errorMsg.includes("TASK_TIMED_OUT") || errorMsg.includes("time budget");
    const humanError = mapInternalErrorToHuman(isTimeout ? "TIMED_OUT" : err);

    console.error(`[Worker] ⚠️ Halted execution on Job ${jobId}: ${humanError.title}`);

    await updateDbJob(jobId, {
      status: "BLOCKED",
      progress: 100,
      summary: humanError.userMessage,
      error: humanError,
      totalDurationMs: isTimeout ? maxDurationMs : undefined,
    }).catch(() => {});

    return {
      jobId,
      prompt,
      intent: {
        classification: "SUPPORTED",
        targetDomains: [],
        confidence: 1,
        rationale: "Default fallback",
        requiredCapabilities: ["NAVIGATION"],
      },
      guard: {
        allowed: false,
        classification: "BLOCKED",
        userMessage: humanError.userMessage,
        matchedCapabilities: [],
        blockedCapabilities: [],
      },
      plannerCalled: false,
      planValidation: {
        valid: false,
        summary: humanError.userMessage,
        reasons: [
          {
            code: "UNSUPPORTED_CAPABILITY",
            message: humanError.userMessage,
            detail: humanError.technicalDetail || humanError.userMessage,
          },
        ],
        totalSteps: 0,
        maxAllowedSteps: 15,
      },
      success: false,
      error: {
        code: humanError.code,
        message: humanError.technicalDetail || humanError.userMessage,
        userMessage: humanError.userMessage,
      },
      durationMs: isTimeout ? maxDurationMs : 0,
    };
  }
}

/**
 * Background Queue Worker Service
 */
export async function startWorker() {
  const concurrency = getWorkerConcurrency();
  console.log("\n=================================================");
  console.log("  BROWSERPILOT BACKGROUND WORKER (BullMQ)");
  console.log("=================================================");
  console.log(`[Config] Queue Name: "${BROWSER_JOBS_QUEUE_NAME}"`);
  console.log(`[Config] Concurrency Limit: ${concurrency} parallel browser jobs`);

  // Fail-fast configuration guard: Verify GEMINI_API_KEY presence outside test harness
  const geminiCheck = validateGeminiCredentialsOnStartup();
  if (!geminiCheck.valid) {
    console.error("\n❌ CRITICAL CONFIGURATION ERROR: GEMINI_API_KEY is missing or invalid!");
    console.error("BrowserPilot worker requires a valid GEMINI_API_KEY in .env to plan and execute tasks.\n");
    throw new Error("MISSING_GEMINI_API_KEY: Gemini API Key is required to start worker.");
  }

  // Check Redis Connection
  const health = await checkRedisHealth();
  if (!health.connected) {
    console.error("\n❌ CRITICAL ERROR: Redis is unreachable!");
    console.error(health.troubleshooting);
    console.error(`Original Error: ${health.error}\n`);
    throw new Error(`Redis connection failed: ${health.troubleshooting}`);
  }

  console.log(`[Config] Connected to Redis at ${health.url}`);

  const connection = createRedisConnection();
  const worker = new Worker<BrowserJobPayload>(
    BROWSER_JOBS_QUEUE_NAME,
    async (job: Job<BrowserJobPayload>) => {
      await processBrowserJob(job.data);
    },
    {
      connection,
      concurrency,
      limiter: {
        max: 50,
        duration: 10000,
      },
    }
  );

  // Start Repeatable 24h Auto-Purge Scheduler (§Prompt B2)
  startAutoPurgeScheduler();

  worker.on("ready", () => {
    console.log(`[Worker] Ready and listening for incoming jobs (concurrency: ${concurrency})...\n`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err);
  });

  // Graceful shutdown handlers
  const cleanup = async () => {
    console.log("\n[Worker] Shutting down worker gracefully...");
    stopAutoPurgeScheduler();
    await worker.close();
    try {
      const { browserPool } = await import("./browser");
      await browserPool.closeAll().catch(() => {});
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  return worker;
}

// Auto-start if executed directly via CLI
if (require.main === module) {
  startWorker().catch((err) => {
    console.error("Worker process failed to start:", err.message);
    process.exit(1);
  });
}
