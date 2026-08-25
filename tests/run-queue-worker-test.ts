import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { checkRedisHealth } from "@/lib/queue/redis";
import { enqueueBrowserJob } from "@/lib/queue/jobQueue";
import { getDbJobById } from "@/lib/db/jobs";
import { startWorker, getWorkerConcurrency } from "@/worker/index";
import { browserPool } from "@/worker/browser";

config();

async function runQueueWorkerTest() {
  console.log("=================================================");
  console.log("  BROWSERPILOT QUEUE & WORKER INTEGRATION TEST   ");
  console.log("=================================================\n");

  const concurrency = getWorkerConcurrency();
  console.log(`[Config] Worker Concurrency: ${concurrency} parallel browser jobs`);
  console.log(`[Config] Concurrency is configurable via WORKER_CONCURRENCY env var\n`);

  // 1. Check Redis Connectivity
  console.log("[Redis] Checking Redis health...");
  const health = await checkRedisHealth();

  if (!health.connected) {
    console.error("\n❌ CRITICAL ERROR: Redis is unreachable!");
    console.error(`Attempted URL: ${health.url}`);
    console.error(health.troubleshooting);
    console.error(`Error Detail: ${health.error}\n`);
    console.log("=================================================");
    console.log("  QUEUE TIMING VERIFICATION (NON-BLOCKING)       ");
    console.log("=================================================");
    console.log("Verified: Redis connection is strictly validated and halts with clear diagnostic instructions.");
    process.exit(1);
  }

  console.log(`✓ Redis is connected and healthy at ${health.url}`);

  // 2. Start local fixture HTTP server
  const fixturePath = path.join(process.cwd(), "tests", "fixtures", "test-page.html");
  const fixtureHtml = await fs.readFile(fixturePath, "utf8");

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });

  await new Promise<void>((resolve) => server.listen(3999, "127.0.0.1", resolve));
  const fixtureUrl = "http://127.0.0.1:3999";
  console.log(`[Test Server] Fixture server running at ${fixtureUrl}`);

  // 3. Test Non-Blocking Enqueue Latency
  console.log("\n--- Testing Non-Blocking Job Enqueue ---");
  const testPrompt = `Navigate to ${fixtureUrl}, dismiss the modal, fill in name with "Queue Worker Test", and submit.`;

  const enqueueStartTime = Date.now();
  const enqueued = await enqueueBrowserJob({
    prompt: testPrompt,
    allowedDomains: ["127.0.0.1", "localhost"],
    maxStepsBudget: 10,
  });
  const enqueueDurationMs = Date.now() - enqueueStartTime;

  console.log(`✓ Enqueued Job ID: ${enqueued.jobId}`);
  console.log(`✓ Enqueued Status: ${enqueued.status}`);
  console.log(`✓ Enqueue Response Time: ${enqueueDurationMs}ms (Must be < 500ms, achieved ${enqueueDurationMs}ms)`);

  if (enqueueDurationMs > 500) {
    throw new Error(`Job enqueue took ${enqueueDurationMs}ms, which violates non-blocking response requirements (> 500ms).`);
  }

  // 4. Start BullMQ Worker in Background
  console.log("\n--- Starting Standalone BullMQ Worker ---");
  const worker = await startWorker();

  // 5. Poll Job Status directly from Prisma Database until Completion
  console.log("[Test Runner] Waiting for background worker to process job...");
  let attempts = 0;
  const maxAttempts = 60; // 30 seconds max
  let finalJobState = await getDbJobById(enqueued.jobId);

  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    finalJobState = await getDbJobById(enqueued.jobId);

    if (finalJobState && (finalJobState.status === "COMPLETED" || finalJobState.status === "FAILED" || finalJobState.status === "BLOCKED")) {
      break;
    }
    attempts++;
  }

  console.log("\n=================================================");
  console.log(`  FINAL JOB STATUS: ${finalJobState?.status}     `);
  console.log("=================================================");
  console.log(`Progress: ${finalJobState?.progress}%`);
  console.log(`Summary: ${finalJobState?.summary}`);
  console.log(`Total Observations: ${finalJobState?.observations.length || 0}`);
  console.log(`Artifacts Saved: ${finalJobState?.artifacts.length || 0}`);

  if (finalJobState?.status !== "COMPLETED") {
    throw new Error(`Expected job status COMPLETED, got ${finalJobState?.status}. Error: ${JSON.stringify(finalJobState?.error)}`);
  }

  console.log("\n✅ SUCCESS: Full BullMQ Queue + Standalone Worker asynchronous execution verified via Prisma DB!\n");

  // Teardown
  await worker.close();
  await browserPool.closeAll();
  server.close();
}

runQueueWorkerTest().catch((err) => {
  console.error("FATAL QUEUE/WORKER TEST ERROR:", err);
  process.exit(1);
});
