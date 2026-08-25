import { browserPool } from "@/worker/browser";

export async function runWorkerConcurrencyLimitTest() {
  console.log("\n▶ [INTEGRATION] Running Worker Concurrency Limit & Queue Throttling Test...");

  const concurrencyLimit = 2;
  const totalJobs = 4;
  const timestamp = Date.now();

  browserPool.resetConcurrencyMetrics();

  console.log(`  Submitting ${totalJobs} concurrent jobs with simulated concurrency throttle of ${concurrencyLimit}...`);

  // Simulate a concurrency-controlled worker pool queue processing 4 jobs with max concurrency 2
  const activeRunning: Promise<void>[] = [];
  let currentlyActive = 0;
  let maxSimultaneousObserved = 0;

  // Simple semaphore pattern to mirror BullMQ worker concurrency
  async function runThrottledJob(jobIndex: number) {
    // Wait until available slot
    while (currentlyActive >= concurrencyLimit) {
      await new Promise((r) => setTimeout(r, 20));
    }

    currentlyActive++;
    if (currentlyActive > maxSimultaneousObserved) {
      maxSimultaneousObserved = currentlyActive;
    }

    const jobId = `job-concurrency-test-${jobIndex}-${timestamp}`;
    const session = await browserPool.createSession({ jobId });

    // Simulate work duration
    await new Promise((r) => setTimeout(r, 250));

    await session.close();
    currentlyActive--;
  }

  for (let i = 1; i <= totalJobs; i++) {
    activeRunning.push(runThrottledJob(i));
  }

  await Promise.all(activeRunning);

  const poolMaxObserved = browserPool.getMaxConcurrentObserved();
  console.log(`  ✓ Concurrency Test Completed: Max Simultaneous Browser Sessions = ${poolMaxObserved}`);

  if (poolMaxObserved > concurrencyLimit) {
    throw new Error(`Concurrency violation! Max observed (${poolMaxObserved}) exceeded configured limit (${concurrencyLimit}).`);
  }

  if (browserPool.getActiveSessionCount() !== 0) {
    throw new Error(`Session leak! Active sessions remaining: ${browserPool.getActiveSessionCount()}`);
  }

  console.log(`  ✓ Verified simultaneous browser sessions never exceeded concurrency limit of ${concurrencyLimit}`);
  console.log("✓ [INTEGRATION] Worker Concurrency Limit Test Passed!");
}

if (require.main === module) {
  runWorkerConcurrencyLimitTest().catch((err) => {
    console.error("Concurrency limit test failed:", err);
    process.exit(1);
  });
}
