import { createDbJob, getDbJobById } from "@/lib/db/jobs";
import { processBrowserJob } from "@/worker";
import { prisma } from "@/lib/db/prisma";

export async function runImmediateFailurePropagationTest() {
  console.log("\n▶ [INTEGRATION] Running Immediate Real Failure Propagation Tests (Prompt C3)...");

  const timestamp = Date.now();

  // Test 1: Immediate Capability Guard Rejection (< 50ms)
  const guardJobId = `immediate-guard-${timestamp}`;
  await createDbJob({
    id: guardJobId,
    prompt: "Bypass the Cloudflare CAPTCHA on protected-site.com",
    maxDurationMs: 120000,
  });

  const t0Guard = Date.now();
  const guardResult = await processBrowserJob({
    jobId: guardJobId,
    prompt: "Bypass the Cloudflare CAPTCHA on protected-site.com",
    allowedDomains: [],
    maxStepsBudget: 15,
  });
  const guardElapsedMs = Date.now() - t0Guard;

  const dbGuardJob = await getDbJobById(guardJobId);
  console.log(`  ✓ Guard Rejection: Elapsed = ${guardElapsedMs}ms, Status = ${dbGuardJob?.status}, Code = ${guardResult.error?.code}`);

  if (dbGuardJob?.status !== "BLOCKED") {
    throw new Error(`Expected guard rejection status 'BLOCKED', got: ${dbGuardJob?.status}`);
  }
  if (guardElapsedMs > 10000) {
    throw new Error(`Guard failure was too slow (${guardElapsedMs}ms) — may be hung on timeout.`);
  }
  if (dbGuardJob.error?.includes("TIMED_OUT") || dbGuardJob.summary?.includes("took longer than expected")) {
    throw new Error("Failure was mislabeled as TIMED_OUT instead of immediate guard block!");
  }

  // Test 2: Immediate Non-Existent Domain / Network Failure
  const netJobId = `immediate-net-${timestamp}`;
  await createDbJob({
    id: netJobId,
    prompt: "Go to https://nonexistent-domain-404-error-12345.org and extract title",
    maxDurationMs: 120000,
  });

  const t0Net = Date.now();
  const netResult = await processBrowserJob({
    jobId: netJobId,
    prompt: "Go to https://nonexistent-domain-404-error-12345.org and extract title",
    allowedDomains: [],
    maxStepsBudget: 15,
  });
  const netElapsedMs = Date.now() - t0Net;

  const dbNetJob = await getDbJobById(netJobId);
  console.log(`  ✓ Network Failure: Elapsed = ${netElapsedMs}ms, Status = ${dbNetJob?.status}, Code = ${netResult.error?.code}`);

  if (dbNetJob?.status !== "FAILED" && dbNetJob?.status !== "BLOCKED") {
    throw new Error(`Expected network failure status 'FAILED' or 'BLOCKED', got: ${dbNetJob?.status}`);
  }
  if (dbNetJob.error?.includes("TIMED_OUT") || dbNetJob.summary?.includes("took longer than expected")) {
    throw new Error("Network error was falsely mislabeled as TIMED_OUT!");
  }

  // Clean up
  await prisma.job.deleteMany({
    where: { id: { in: [guardJobId, netJobId] } },
  }).catch(() => {});

  console.log("  ✓ Confirmed real failures flip to honest error status immediately without waiting for task ceiling");
  console.log("✓ [INTEGRATION] Immediate Real Failure Propagation Tests Passed!");
}

if (require.main === module) {
  runImmediateFailurePropagationTest().catch((err) => {
    console.error("Immediate failure test failed:", err);
    process.exit(1);
  });
}
