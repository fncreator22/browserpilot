import { Worker, type Job } from "bullmq";
import { config } from "dotenv";
import { 
  BROWSER_JOBS_QUEUE_NAME, 
  type BrowserJobPayload 
} from "@/lib/queue/jobQueue";
import { createRedisConnection, checkRedisHealth } from "@/lib/queue/redis";
import { jobStore } from "@/lib/queue/store";
import { 
  updateDbJob, 
  recordDbJobStep, 
  recordDbObservation, 
  recordDbArtifact 
} from "@/lib/db/jobs";
import { runAutonomousPipeline, type PipelineResult } from "@/lib/ai/pipeline";
import { validateGeminiCredentialsOnStartup } from "@/lib/ai/intent";
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

  // 1. Update status to WORKING in DB & cache
  await updateDbJob(jobId, {
    status: "WORKING",
    progress: 10,
    summary: "Initializing worker & evaluating capability boundaries...",
  }).catch(() => {});

  jobStore.updateJob(jobId, {
    status: "WORKING",
    progress: 10,
    currentStepDescription: "Initializing worker & evaluating capability boundaries...",
  });

  try {
    // 2. Run the complete pipeline (Capability Guard → Planner → Plan Validator → Playwright Execution)
    const pipelineResult = await runAutonomousPipeline(prompt, {
      jobId,
      allowedDomains,
      maxStepsBudget,
      onIntentClassified: (intent) => {
        jobStore.updateJob(jobId, {
          progress: 25,
          currentStepDescription: `Intent classified as ${intent.classification}`,
        });
      },
      onGuardEvaluated: (guard) => {
        jobStore.updateJob(jobId, {
          progress: 40,
          currentStepDescription: guard.userMessage,
        });
      },
      onPlanGenerated: async (plan) => {
        jobStore.updateJob(jobId, {
          progress: 55,
          currentStepDescription: `Plan generated with ${plan.steps.length} tool steps.`,
        });

        // Persist planned steps to database
        for (const step of plan.steps) {
          await recordDbJobStep(jobId, step).catch(() => {});
        }
      },
      onPlanValidated: (validation) => {
        jobStore.updateJob(jobId, {
          progress: 65,
          currentStepDescription: validation.summary,
        });
      },
      onStepProgress: (stepNum, total, tool) => {
        const pct = Math.min(65 + Math.round((stepNum / total) * 30), 95);
        jobStore.updateJob(jobId, {
          progress: pct,
          currentStepNumber: stepNum,
          currentStepDescription: `Executing Step ${stepNum}/${total} [${tool}]...`,
        });
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

    // 4. Update final status in DB & Store
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

      jobStore.updateJob(jobId, {
        status: "COMPLETED",
        progress: 100,
        currentStepDescription: "Task completed successfully. All artifacts persisted.",
        observations: pipelineResult.execution.observations,
        screenshotPaths: pipelineResult.execution.screenshotPaths,
        result: {
          extractedData: pipelineResult.execution.finalObservation?.extractedData,
          summary: pipelineResult.execution.finalObservation?.pageSummary,
          totalDurationMs: pipelineResult.durationMs,
        },
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

      jobStore.updateJob(jobId, {
        status: finalStatus,
        progress: 100,
        currentStepDescription: pipelineResult.error?.userMessage || "Task was halted or failed.",
        observations: pipelineResult.execution?.observations || [],
        screenshotPaths: pipelineResult.execution?.screenshotPaths || [],
        error: {
          code: pipelineResult.error?.code || "PIPELINE_ERROR",
          message: pipelineResult.error?.message || "Execution halted.",
          userMessage: pipelineResult.error?.userMessage || "Task could not be completed.",
          detail: pipelineResult.error?.reasons,
        },
      });
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

    jobStore.updateJob(jobId, {
      status: "FAILED",
      progress: 100,
      currentStepDescription: "Fatal worker execution error.",
      error: {
        code: "FATAL_WORKER_ERROR",
        message: errorMsg,
        userMessage: "An unexpected internal worker error occurred during execution.",
      },
    });

    throw err;
  }
}

/**
 * Start the Standalone BullMQ Worker Process
 */
export async function startWorker(): Promise<Worker<BrowserJobPayload>> {
  const concurrency = getWorkerConcurrency();
  console.log("=================================================");
  console.log("  BROWSERPILOT STANDALONE BULLMQ WORKER ENGINE   ");
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

  worker.on("ready", () => {
    console.log(`[Worker] Ready and listening for incoming jobs (concurrency: ${concurrency})...\n`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Worker] Job ${job?.id} failed with error:`, err);
  });

  // Graceful shutdown handlers
  const cleanup = async () => {
    console.log("\n[Worker] Shutting down worker gracefully...");
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
