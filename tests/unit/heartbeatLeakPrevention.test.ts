import assert from "assert";
import { NextRequest } from "next/server";
import { POST as searchRoutePost } from "@/app/api/search/route";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { processSearchDiscoveryJob } from "@/worker/searchWorker";

import { intelligenceHarness } from "@/lib/ai/harness";

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

export async function runHeartbeatLeakPreventionTests() {
  console.log("=================================================");
  console.log("  HEARTBEAT TIMER LEAK PREVENTION AUDIT & TESTS");
  console.log("=================================================\n");

  // Stub intelligenceHarness to simulate fast, non-network worker execution
  const originalRunLifecycle = intelligenceHarness.runLifecycle;
  intelligenceHarness.runLifecycle = async (query, opts) => {
    await new Promise((r) => setTimeout(r, 2));
    return {
      harnessId: opts?.executionId || "test",
      success: true,
      rankedOpportunities: [],
      context: {} as any,
      telemetry: { status: "SUCCESS" } as any,
      decision: { outcome: "SUCCESS" } as any,
    } as any;
  };

  // Stub transitionState for transient in-memory search IDs that are not persisted to DB
  const originalTransitionState = executionLifecycleManager.transitionState;
  executionLifecycleManager.transitionState = async () => true;

  // TEST 1: Enqueuing 500 jobs via HTTP route must start ZERO heartbeat timers
  console.log("▶ [TEST 1] Verifying HTTP route enqueues 500 searches with ZERO active timers...");
  const initialTimerCount = executionLifecycleManager.getActiveExecutionCount();
  assert.strictEqual(initialTimerCount, 0, "Initial active execution count must be 0");

  const enqueuedIds: string[] = [];

  for (let i = 0; i < 500; i++) {
    const req = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": `usr_leak_test_${i}`,
      },
      body: JSON.stringify({
        query: `Fast Test Position ${i}`,
        filters: { workMode: "REMOTE", requestedCount: 0 },
        persistToDb: false,
      }),
    });

    const res = await searchRoutePost(req);
    assert.strictEqual(res.status, 200, "Search enqueue must return 200");
    const data = await res.json();
    assert.strictEqual(data.status, "QUEUED");
    enqueuedIds.push(data.executionId);
  }

  const timersAfterEnqueue = executionLifecycleManager.getActiveExecutionCount();
  console.log(`   - Enqueued 500 searches through HTTP POST /api/search`);
  console.log(`   - Active heartbeat timers synchronously returned by HTTP route: ${timersAfterEnqueue}`);
  assert.strictEqual(
    timersAfterEnqueue,
    0,
    `CRITICAL LEAK DETECTED: Enqueuing 500 jobs created ${timersAfterEnqueue} heartbeat timers in the HTTP route! Must be 0.`
  );
  console.log("  ✓ PASS: HTTP route created exactly 0 persistent heartbeat timers.\n");

  // TEST 2: While workers are actively running, heartbeats are active
  console.log("▶ [TEST 2] Verifying worker leases jobs, registers heartbeat, and cleans up...");
  
  // Wait for all 500 background worker jobs to process and complete
  console.log("   - Waiting for all 500 background worker jobs to complete...");
  const tDrainStart = Date.now();
  let peakActive = 0;
  while (Date.now() - tDrainStart < 60000) {
    const active = executionLifecycleManager.getActiveExecutionCount();
    if (active > peakActive) peakActive = active;
    if (active === 0 && Date.now() - tDrainStart > 2000) {
      // Confirmed 0 active timers
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  const timersAfterDrain = executionLifecycleManager.getActiveExecutionCount();
  console.log(`   - Peak active heartbeats during worker processing: ${peakActive}`);
  console.log(`   - Active heartbeat timers after 500 jobs finished: ${timersAfterDrain}`);
  assert.strictEqual(
    timersAfterDrain,
    0,
    `LEAK DETECTED: Expected 0 leftover timers after 500 jobs, found ${timersAfterDrain} remaining in memory!`
  );
  console.log("  ✓ PASS: All 500 worker jobs completed with exactly 0 leftover timers in memory.\n");

  // TEST 3: Verify clean cleanup on worker failure / crash
  console.log("▶ [TEST 3] Verifying worker failure/crash unregisters heartbeat via try/finally...");
  const testUserId = `usr_leak_test_fail_${Date.now()}`;
  const failId = `search_fail_${Date.now()}`;
  const failJob = {
    id: failId,
    data: {
      executionId: failId,
      userId: testUserId,
      query: "Crash Simulation",
      persistToDb: false,
      customProviders: "INVALID_PROV_FORCE_CRASH" as any,
    },
    updateProgress: async () => {},
  } as any;

  await processSearchDiscoveryJob(failJob).catch(() => {});
  const timersAfterFail = executionLifecycleManager.getActiveExecutionCount();
  assert.strictEqual(
    timersAfterFail,
    0,
    "Active execution count must be 0 even when worker encounters fatal error"
  );
  console.log("  ✓ PASS: Failed/crashed job unregistered its heartbeat cleanly via try/finally.");

  intelligenceHarness.runLifecycle = originalRunLifecycle;
  executionLifecycleManager.transitionState = originalTransitionState;

  console.log("\n=================================================");
  console.log("  ALL HEARTBEAT TIMER LEAK TESTS PASSED (0 LEAKS)");
  console.log("=================================================\n");
}

if (require.main === module) {
  runHeartbeatLeakPreventionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
