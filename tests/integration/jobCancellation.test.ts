import { createDbJob, getDbJobById } from "@/lib/db/jobs";
import { cancelJob } from "@/lib/queue/cancellation";
import { browserPool } from "@/worker/browser";
import { prisma } from "@/lib/db/prisma";

export async function runJobCancellationIntegrationTest() {
  console.log("\n▶ [INTEGRATION] Running Real Job Cancellation & Orphan Process Tests (Prompt C4)...");

  const timestamp = Date.now();

  // Test 1: Cancelling a QUEUED Job
  const queuedJobId = `cancel-queued-${timestamp}`;
  await createDbJob({
    id: queuedJobId,
    prompt: "Queued task to cancel",
    maxDurationMs: 60000,
  });

  const queuedCancelResult = await cancelJob(queuedJobId);
  if (!queuedCancelResult.success || queuedCancelResult.job?.status !== "CANCELLED") {
    throw new Error(`Expected queued job status 'CANCELLED', got: ${queuedCancelResult.job?.status}`);
  }
  const dbQueuedJob = await getDbJobById(queuedJobId);
  if (dbQueuedJob?.status !== "CANCELLED") {
    throw new Error(`Database record was not updated to CANCELLED: ${dbQueuedJob?.status}`);
  }
  console.log("  ✓ Queued job cancelled cleanly with status CANCELLED");

  // Test 2: Cancelling an In-Flight RUNNING Job with Real Playwright Session & Orphan Check
  const runningJobId = `cancel-running-${timestamp}`;
  await createDbJob({
    id: runningJobId,
    prompt: "Running task with active browser session",
    maxDurationMs: 60000,
  });

  // Launch a real browser session registered in browserPool
  const session = await browserPool.createSession({
    jobId: runningJobId,
    allowedDomains: ["localhost", "127.0.0.1"],
    headless: true,
  });

  const activeBeforeCancel = browserPool.getActiveSessionCount();
  if (activeBeforeCancel === 0) {
    throw new Error("Active session was not registered in browserPool");
  }

  // Cancel the active job
  const runningCancelResult = await cancelJob(runningJobId);
  if (!runningCancelResult.success || runningCancelResult.job?.status !== "CANCELLED") {
    throw new Error(`Expected running job status 'CANCELLED', got: ${runningCancelResult.job?.status}`);
  }

  // Verify Playwright browser context was force-killed with 0 orphaned sessions
  const activeAfterCancel = browserPool.getActiveSessionCount();
  if (activeAfterCancel !== 0) {
    throw new Error(`Orphaned browser session detected! Active sessions remaining: ${activeAfterCancel}`);
  }
  console.log("  ✓ In-flight job cancelled and Chromium context force-closed (0 orphaned sessions)");

  // Test 3: Safe No-Op on Second Cancellation Attempt
  const secondCancelResult = await cancelJob(runningJobId);
  if (!secondCancelResult.success || !secondCancelResult.alreadyTerminated) {
    throw new Error("Second cancel attempt failed to return alreadyTerminated no-op");
  }
  console.log("  ✓ Second cancel attempt on terminal job was safe no-op");

  // Test 4: Multi-Tenant Ownership Check
  const testUser = await prisma.user.create({
    data: {
      email: `cancel-owner-${timestamp}@test.com`,
      passwordHash: "$2b$10$abcdefghijklmnopqrstuu",
    },
  });

  const tenantJobId = `cancel-tenant-${timestamp}`;
  await createDbJob({
    id: tenantJobId,
    prompt: "Tenant owned task",
    userId: testUser.id,
    maxDurationMs: 60000,
  });

  let authBlocked = false;
  try {
    await cancelJob(tenantJobId, "unauthorized-attacker-999");
  } catch (err: unknown) {
    const errCode = (err as unknown as { code?: string }).code;
    if (errCode === "UNAUTHORIZED") {
      authBlocked = true;
    }
  }

  if (!authBlocked) {
    throw new Error("Cross-tenant cancellation was not blocked!");
  }
  console.log("  ✓ Cross-tenant unauthorized cancellation blocked (403 UNAUTHORIZED)");

  // Cleanup
  await prisma.job.deleteMany({
    where: { id: { in: [queuedJobId, runningJobId, tenantJobId] } },
  }).catch(() => {});
  await prisma.user.deleteMany({
    where: { id: testUser.id },
  }).catch(() => {});

  console.log("✓ [INTEGRATION] Real Job Cancellation & Orphan Process Tests Passed!");
}

if (require.main === module) {
  runJobCancellationIntegrationTest().catch((err) => {
    console.error("Cancellation test failed:", err);
    process.exit(1);
  });
}
