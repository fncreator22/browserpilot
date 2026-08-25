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
import { runAutonomousPipeline, type PipelineResult } from "@/lib/ai/pipeline";
import { validateGeminiCredentialsOnStartup } from "@/lib/ai/intent";
import { startAutoPurgeScheduler, stopAutoPurgeScheduler } from "./cleanup";
import { browserPool } from "./browser";

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

  // 1. Update status to WORKING in DB
  await updateDbJob(jobId, {
    status: "WORKING",
    progress: 10,
    summary: "Initializing worker & evaluating capability boundaries...",
  }).catch(() => {});

  try {
    // 2. Run the complete pipeline (Capability Guard → Planner → Plan Validator → Playwright Execution)
    const pipelineResult = await runAutonomousPipeline(prompt, {
      jobId,
      allowedDomains,
      maxStepsBudget,
      onIntentClassified: async (intent) => {
        await updateDbJob(jobId, {
          progress: 25,
          summary: `Intent classified as ${intent.classification}`,
        }).catch(() => {});
      },
      onGuardEvaluated: async (guard) => {
        await updateDbJob(jobId, {
          progress: 40,
          summary: guard.userMessage,
        }).catch(() => {});
      },
      onPlanGenerated: async (plan) => {
        await updateDbJob(jobId, {
          progress: 55,
          summary: `Plan generated with ${plan.steps.length} tool steps.`,
        }).catch(() => {});

        // Persist planned steps directly to database
        for (const step of plan.steps) {
          await recordDbJobStep(jobId, step).catch(() => {});
        }
      },
      onPlanValidated: async (validation) => {
        await updateDbJob(jobId, {
          progress: 65,
          summary: validation.summary,
        }).catch(() => {});
      },
      onStepProgress: async (stepNum, total, tool) => {
        const pct = Math.min(65 + Math.round((stepNum / total) * 30), 95);
        await updateDbJob(jobId, {
          progress: pct,
          summary: `Executing Step ${stepNum}/${total} [${tool}]...`,
        }).catch(() => {});
      },
    });

    // 3. Persist Observations and Artifacts to Database
    if (pipelineResult.execution) {
      for (const obs of pipelineResult.execution.observations) {
        await recordDbObservation(jobId, obs).catch(() => {});

        if (obs.screenshotPath) {
          await recordDbArtifact(jobId, {
            filename: `step_${obs.stepIndex}_screenshot.png`,
            storageKey: obs.screenshotPath,
            mimeType: "image/png",
          }).catch(() => {});
        }
      }
    }

    // 4. Update final status in DB
    if (pipelineResult.success && pipelineResult.execution) {
      console.log(`[Worker] ✅ Job ${jobId} COMPLETED in ${pipelineResult.durationMs}ms`);

      await updateDbJob(jobId, {
        status: "COMPLETED",
        progress: 100,
        summary: pipelineResult.execution.finalObservation?.pageSummary || "Task completed successfully.",
        result: pipelineResult.execution.finalObservation?.extractedData,
        totalDurationMs: pipelineResult.durationMs,
        tokensUsed: pipelineResult.tokensUsed,
        memoryMb: pipelineResult.memoryMb,
      }).catch(() => {});
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
    }

    return pipelineResult;
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || String(err);
    console.error(`[Worker] ❌ Fatal error on Job ${jobId}:`, err);

    await updateDbJob(jobId, {
      status: "FAILED",
      progress: 100,
      summary: "Fatal worker execution error.",
      error: { code: "FATAL_WORKER_ERROR", message: errorMsg },
    }).catch(() => {});

    throw err;
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
    await browserPool.closeAll();
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
