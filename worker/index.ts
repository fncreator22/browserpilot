import { Worker, type Job } from "bullmq";
import { config } from "dotenv";
import { 
  BROWSER_JOBS_QUEUE_NAME, 
  type BrowserJobPayload 
} from "@/lib/queue/jobQueue";
import { createRedisConnection, checkRedisHealth } from "@/lib/queue/redis";
import { executeJobPipeline } from "@/lib/ai/pipelineEngine";
import { type PipelineResult } from "@/lib/ai/pipeline";
import { validateGeminiCredentialsOnStartup } from "@/lib/ai/intent";
import { startAutoPurgeScheduler, stopAutoPurgeScheduler } from "./cleanup";

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
 * Executes an individual browser job through the unified autonomous pipeline with DB persistence
 */
export async function processBrowserJob(
  jobData: BrowserJobPayload
): Promise<PipelineResult> {
  return await executeJobPipeline({
    jobId: jobData.jobId,
    prompt: jobData.prompt,
    allowedDomains: jobData.allowedDomains,
    maxStepsBudget: jobData.maxStepsBudget,
    apiKey: jobData.apiKey,
  });
}

/**
 * Background Queue Worker Service (BullMQ)
 */
export async function startWorker() {
  const concurrency = getWorkerConcurrency();
  console.log("\n=================================================");
  console.log("  BROWSERPILOT BACKGROUND WORKER (BullMQ)");
  console.log("=================================================");
  console.log(`[Config] Queue Name: "${BROWSER_JOBS_QUEUE_NAME}"`);
  console.log(`[Config] Concurrency Limit: ${concurrency} parallel browser jobs`);

  // Verify Gemini API credentials presence outside test harness
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
