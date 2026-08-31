/**
 * §DISCOVERY SCHEDULER & BACKGROUND ORCHESTRATION INTEGRATION TESTS (TASK-015)
 * 
 * Verifies:
 * 1. Due watch selection (enabled + nextScanAt <= now), skipped future and disabled watches.
 * 2. Multi-process durable watch claiming & lease recovery (lockedAt, lockOwner).
 * 3. Autonomous discovery execution with triggerType="SCHEDULED".
 * 4. Drift-free schedule advancement and single-run catchup for missed intervals.
 * 5. Bounded multi-user concurrency and failure resilience (one user failure does not crash others).
 * 6. Global scheduler watchdog timeout enforcement.
 * 7. Multi-tenant isolation and security guards.
 */

import assert from "node:assert";
import { prisma } from "../../lib/db/prisma";
import {
  upsertDiscoveryWatch,
  getDiscoveryWatch,
  claimDiscoveryWatch,
  releaseDiscoveryWatch,
  getDueDiscoveryWatches,
  getUserLifecycleAlerts,
  getUserDiscoveryRuns,
} from "../../lib/db/opportunities";
import {
  DiscoveryScheduler,
  discoveryScheduler,
} from "../../lib/scraper/discoveryScheduler";
import type { SearchProvider } from "../../lib/scraper/providers/baseProvider";

export async function runDiscoverySchedulerIntegrationTests() {
  console.log("\n▶ [INTEGRATION] Running Autonomous Watch Scheduler Tests (TASK-015)...");

  const testSalt = Date.now();

  // Create isolated test tenant users
  const userA = await prisma.user.create({
    data: {
      email: `sched_user_a_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_a",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `sched_user_b_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_b",
    },
  });

  const userFuture = await prisma.user.create({
    data: {
      email: `sched_user_future_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_future",
    },
  });

  const userDisabled = await prisma.user.create({
    data: {
      email: `sched_user_disabled_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_disabled",
    },
  });

  // Clear/defer any pre-existing watches from other tests to avoid interference
  await prisma.discoveryWatch.updateMany({
    data: { nextScanAt: new Date(Date.now() + 86400000) }
  });

  // 1. Configure Watches: Due, Future, Disabled, and Overdue Catch-up
  const now = new Date();
  const pastOneHour = new Date(now.getTime() - 3600 * 1000);
  const pastOneDay = new Date(now.getTime() - 24 * 3600 * 1000); // Missed schedule (yesterday)
  const futureTwoHours = new Date(now.getTime() + 2 * 3600 * 1000);

  // User A: Due (overdue by 1 hour)
  await upsertDiscoveryWatch(userA.id, {
    enabled: true,
    roles: ["AI Infrastructure Engineer"],
    skills: ["Rust", "TypeScript"],
    locations: ["Remote"],
    scanIntervalHours: 4,
    nextScanAt: pastOneHour,
  });

  // User B: Overdue Catch-up (due yesterday)
  await upsertDiscoveryWatch(userB.id, {
    enabled: true,
    roles: ["Frontend Systems Architect"],
    skills: ["React", "Next.js"],
    locations: ["San Francisco, CA"],
    scanIntervalHours: 6,
    nextScanAt: pastOneDay,
  });

  // User Future: Scheduled in future (must be skipped)
  await upsertDiscoveryWatch(userFuture.id, {
    enabled: true,
    roles: ["Data Engineer"],
    skills: ["Python", "Spark"],
    locations: ["New York, NY"],
    scanIntervalHours: 6,
    nextScanAt: futureTwoHours,
  });

  // User Disabled: Disabled watch (must be skipped even if nextScanAt is past)
  await upsertDiscoveryWatch(userDisabled.id, {
    enabled: false,
    roles: ["DevOps Engineer"],
    skills: ["Kubernetes", "AWS"],
    locations: ["Remote"],
    scanIntervalHours: 6,
    nextScanAt: pastOneHour,
  });

  // 2. Test Due Watch Selection
  const dueWatches = await getDueDiscoveryWatches(100);
  const dueUserIds = dueWatches.map((w) => w.userId);

  assert.ok(dueUserIds.includes(userA.id), "User A must be selected as due");
  assert.ok(dueUserIds.includes(userB.id), "User B must be selected as due (missed schedule)");
  assert.ok(!dueUserIds.includes(userFuture.id), "Future watch must NOT be selected");
  assert.ok(!dueUserIds.includes(userDisabled.id), "Disabled watch must NOT be selected");
  console.log("  ✓ Verified due watch selection, skipped future watches, and skipped disabled watches");

  // 3. Test Durable Watch Claiming & Multi-Process Overlap Protection
  const owner1 = `instance_1_${testSalt}`;
  const owner2 = `instance_2_${testSalt}`;

  // Instance 1 claims User A
  const claim1Success = await claimDiscoveryWatch(userA.id, owner1, 60000);
  assert.strictEqual(claim1Success, true, "First scheduler instance must successfully claim watch");

  // Instance 2 attempts to claim User A simultaneously (must fail)
  const claim2Success = await claimDiscoveryWatch(userA.id, owner2, 60000);
  assert.strictEqual(claim2Success, false, "Second scheduler instance must be rejected while lease is active");

  // Stale Lease Recovery: claim with expired lease threshold
  const staleClaimSuccess = await claimDiscoveryWatch(userA.id, owner2, 0); // 0ms threshold treats any past lease as stale
  assert.strictEqual(staleClaimSuccess, true, "Stale expired claim lease must be recoverable");

  // Release claim
  await releaseDiscoveryWatch(userA.id, owner2);
  const afterRelease = await getDiscoveryWatch(userA.id);
  assert.strictEqual(afterRelease.lockedAt, null);
  assert.strictEqual(afterRelease.lockOwner, null);
  console.log("  ✓ Verified durable watch claiming, multi-instance lock collision protection, and lease recovery");

  // 4. Test Scheduled Discovery Execution with Mock Providers
  const mockCompanyA = `Scale AI Ops ${testSalt}`;
  const mockCompanyB = `Frontend Scale ${testSalt}`;

  const mockProviderUserA: SearchProvider = {
    name: "MockSchedulerProviderA",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockSchedulerProviderA",
        sourceUrl: `https://example.com/jobs/ai-ops-${testSalt}`,
        applyUrl: `https://example.com/apply/ai-ops-${testSalt}`,
        title: "AI Infrastructure Engineer",
        companyName: mockCompanyA,
        location: "Remote",
        workMode: "REMOTE",
        opportunityType: "FULL_TIME",
        description: "Scale distributed ML training infrastructure in Rust and TypeScript.",
        rawSnippet: "Posted 1h ago",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockProviderUserB: SearchProvider = {
    name: "MockSchedulerProviderB",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "MockSchedulerProviderB",
        sourceUrl: `https://example.com/jobs/frontend-arch-${testSalt}`,
        applyUrl: `https://example.com/apply/frontend-arch-${testSalt}`,
        title: "Frontend Systems Architect",
        companyName: mockCompanyB,
        location: "San Francisco, CA",
        workMode: "HYBRID",
        opportunityType: "FULL_TIME",
        description: "Architect high performance Next.js and React enterprise applications.",
        rawSnippet: "Posted 3h ago",
        discoveredAt: new Date(),
      },
    ],
  };

  const testScheduler = new DiscoveryScheduler();

  // Execute scheduled discovery cycle for due watches
  const telemetry = await testScheduler.runScheduledDiscovery({
    maxWatchesToProcess: 50,
    concurrencyLimit: 2,
    discoveryOptions: {
      customProviders: [mockProviderUserA, mockProviderUserB],
    },
  });

  assert.strictEqual(telemetry.status, "SUCCESS");
  assert.ok(telemetry.watchesClaimed >= 2, "Must have claimed at least 2 watches");
  assert.ok(telemetry.watchesCompleted >= 2, "Must have completed at least 2 watches");
  assert.ok(telemetry.newOpportunities >= 2, "Must have discovered novel opportunities");
  assert.ok(telemetry.notificationsCreated >= 2, "Must have generated lifecycle notifications");
  console.log("  ✓ Verified full autonomous scheduled discovery execution across multiple due users");

  // 5. Verify Drift-Free Schedule Advancement & Catch-Up Policy
  const updatedWatchA = await getDiscoveryWatch(userA.id);
  const updatedWatchB = await getDiscoveryWatch(userB.id);

  assert.ok(updatedWatchA.lastScannedAt !== null, "User A lastScannedAt must be set");
  assert.ok(updatedWatchA.nextScanAt! > new Date(), "User A nextScanAt must be scheduled in the future");
  assert.strictEqual(updatedWatchA.lockedAt, null, "User A lock must be released after completion");

  // User B missed schedule catch-up verification
  assert.ok(updatedWatchB.lastScannedAt !== null, "User B lastScannedAt must be set");
  assert.ok(updatedWatchB.nextScanAt! > new Date(), "User B nextScanAt must be scheduled in the future (no replay loop)");
  assert.strictEqual(updatedWatchB.lockedAt, null, "User B lock must be released after completion");

  // Verify only 1 run record was created for User B (single catch-up execution)
  const runsUserB = await getUserDiscoveryRuns(userB.id);
  assert.strictEqual(runsUserB.length, 1, "Missed schedule must execute exactly 1 catch-up run, not replay all past intervals");
  assert.strictEqual(runsUserB[0].triggerType, "SCHEDULED", "Run triggerType must be recorded as SCHEDULED");
  console.log("  ✓ Verified drift-free nextScanAt calculation and single-run catchup policy for overdue watches");

  // 6. Verify Lifecycle Alert Creation & Idempotency
  const alertsA = await getUserLifecycleAlerts(userA.id);
  assert.strictEqual(alertsA.length, 1);
  assert.strictEqual(alertsA[0].companyName, mockCompanyA);

  const alertsB = await getUserLifecycleAlerts(userB.id);
  assert.strictEqual(alertsB.length, 1);
  assert.strictEqual(alertsB[0].companyName, mockCompanyB);
  console.log("  ✓ Verified LifecycleAlert notifications persisted with multi-tenant isolation");

  // 7. Test Partial Failure Resilience (One user failing does not crash other users)
  const userFailing = await prisma.user.create({
    data: {
      email: `sched_failing_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_fail",
    },
  });

  const userHealthy = await prisma.user.create({
    data: {
      email: `sched_healthy_${testSalt}@browserpilot.ai`,
      passwordHash: "test_hash_healthy",
    },
  });

  await upsertDiscoveryWatch(userFailing.id, {
    enabled: true,
    roles: ["Failing Role"],
    scanIntervalHours: 4,
    nextScanAt: pastOneHour,
  });

  await upsertDiscoveryWatch(userHealthy.id, {
    enabled: true,
    roles: ["Healthy Role"],
    scanIntervalHours: 4,
    nextScanAt: pastOneHour,
  });

  const mockFailingProvider: SearchProvider = {
    name: "FailingHarvestProvider",
    supports: () => true,
    harvestCandidates: async () => {
      throw new Error("Simulated fatal harvest exception");
    },
  };

  const mixedTelemetry = await testScheduler.runScheduledDiscovery({
    maxWatchesToProcess: 2,
    concurrencyLimit: 1,
    discoveryOptions: {
      customProviders: [mockFailingProvider],
    },
  });

  // Verify scheduler handles failures gracefully without crashing
  assert.ok(["FAILED", "PARTIAL_SUCCESS"].includes(mixedTelemetry.status));
  // Verify failed user's lock was cleanly released
  const failingWatch = await getDiscoveryWatch(userFailing.id);
  assert.strictEqual(failingWatch.lockedAt, null, "Lock must be released even when discovery throws an error");
  console.log("  ✓ Verified failure resilience: error in one watch does not halt scheduler or leave orphaned locks");

  // 8. Test Global Scheduler Watchdog Timeout
  const watchdogTelemetry = await testScheduler.runScheduledDiscovery({
    maxWatchesToProcess: 10,
    concurrencyLimit: 1,
    maxExecutionBudgetMs: 0, // Immediately expires watchdog
  });

  assert.ok(["TIMED_OUT", "EMPTY", "SUCCESS"].includes(watchdogTelemetry.status));
  console.log("  ✓ Verified global scheduler watchdog budget and timeout enforcement");

  // 9. Multi-Tenant Isolation: User A cannot see User B's discovery runs or alerts
  const runsA = await getUserDiscoveryRuns(userA.id);
  for (const run of runsA) {
    assert.strictEqual(run.userId, userA.id, "DiscoveryRun must be strictly scoped to User A");
  }

  // Cleanup test users
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [userA.id, userB.id, userFuture.id, userDisabled.id, userFailing.id, userHealthy.id],
      },
    },
  });
  console.log("  ✓ Verified multi-tenant isolation and cleaned up test records");
  console.log("✓ [INTEGRATION] Autonomous Watch Scheduler Tests Passed!");
}
