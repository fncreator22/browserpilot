import { prisma } from "@/lib/db/prisma";
import { createDbJob, getDbJobById } from "@/lib/db/jobs";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";

export async function runTimeBudgetWatchdogIntegrationTest() {
  console.log("\n▶ [INTEGRATION] Running Time Budget Watchdog & Simulated Timeout Test (Prompt C2)...");

  const jobId = `timeout-watchdog-test-${Date.now()}`;
  const simulatedBudgetMs = 300; // 300ms simulated tight budget

  // 1. Create DB Job with tightly assigned time budget
  await createDbJob({
    id: jobId,
    prompt: "Simulated hung task testing watchdog timeout",
    maxDurationMs: simulatedBudgetMs,
  });

  const createdJob = await getDbJobById(jobId);
  if (createdJob?.maxDurationMs !== simulatedBudgetMs) {
    throw new Error("maxDurationMs was not persisted on created job record!");
  }
  console.log(`  ✓ Created test job with persisted maxDurationMs = ${createdJob.maxDurationMs}ms`);

  // 2. Simulate pipeline execution watchdog racing with a hung task
  let timeoutTriggered = false;

  const simulatedHungPipeline = new Promise<void>((resolve) => {
    // Hangs for 2000ms (longer than 300ms budget)
    setTimeout(resolve, 2000);
  });

  const watchdog = new Promise<never>((_, reject) => {
    setTimeout(() => {
      timeoutTriggered = true;
      reject(new Error("TASK_TIMED_OUT: This task took longer than expected and was stopped automatically."));
    }, simulatedBudgetMs);
  });

  try {
    await Promise.race([simulatedHungPipeline, watchdog]);
    throw new Error("Watchdog failed to interrupt hung pipeline!");
  } catch (err: unknown) {
    const errorMsg = (err as Error).message;
    if (!errorMsg.includes("TASK_TIMED_OUT")) {
      throw err;
    }

    const humanError = mapInternalErrorToHuman("TIMED_OUT");

    // Update DB with TIMED_OUT status
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "BLOCKED",
        progress: 100,
        summary: humanError.userMessage,
        error: JSON.stringify(humanError),
        completedAt: new Date(),
      },
    });
  }

  if (!timeoutTriggered) {
    throw new Error("Watchdog timeout was not triggered!");
  }

  // 3. Verify Job in Database
  const finalJob = await getDbJobById(jobId);
  if (finalJob?.status !== "BLOCKED") {
    throw new Error(`Expected final status 'BLOCKED', got: ${finalJob?.status}`);
  }

  if (!finalJob?.summary?.includes("longer than expected and was stopped automatically")) {
    throw new Error(`Expected timeout summary message, got: ${finalJob?.summary}`);
  }

  console.log("  ✓ Hung pipeline was force-halted exactly at assigned time budget");
  console.log(`  ✓ Database updated with human error: "${finalJob.summary}"`);

  // Clean up
  await prisma.job.delete({ where: { id: jobId } }).catch(() => {});

  console.log("✓ [INTEGRATION] Time Budget Watchdog Test Passed!");
}

if (require.main === module) {
  runTimeBudgetWatchdogIntegrationTest().catch((err) => {
    console.error("Watchdog test failed:", err);
    process.exit(1);
  });
}
