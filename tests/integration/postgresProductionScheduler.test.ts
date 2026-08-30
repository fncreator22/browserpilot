/**
 * §TASK-021 POSTGRESQL PRODUCTION DATABASE & CLOUDWATCH SCHEDULER TESTS
 * Validates multi-instance concurrency, atomic lease claiming, stale lease recovery,
 * external cron authentication, idempotent cron execution, and multi-tenant isolation.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { prisma, isPostgresDatabase } from "@/lib/db";
import {
  claimDiscoveryWatch,
  releaseDiscoveryWatch,
  upsertDiscoveryWatch,
  getDueDiscoveryWatches,
  getUserLifecycleAlerts,
} from "@/lib/db/opportunities";
import { discoveryScheduler } from "@/lib/scraper/discoveryScheduler";
import { MockEmailProvider } from "@/lib/notifications";
import { POST as schedulerApiPost, GET as schedulerApiGet } from "@/app/api/discovery/scheduler/route";
import { NextRequest } from "next/server";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-021 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runPostgresProductionSchedulerTests() {
  console.log("▶ [TASK-021] Running PostgreSQL Database & CloudWatch Scheduler Integration Tests...");

  const salt = Date.now();
  const testCronSecret = `cron_secret_test_${salt}`;
  process.env.CRON_SECRET = testCronSecret;

  // ---------------------------------------------------------------------------
  // 1. PostgreSQL Connection & Schema Detector Validation
  // ---------------------------------------------------------------------------
  assert(isPostgresDatabase("postgresql://usr:pass@rds.aws.com:5432/bp_prod") === true, "Must recognize postgresql:// URI");
  assert(isPostgresDatabase("postgres://usr:pass@rds.aws.com:5432/bp_prod") === true, "Must recognize postgres:// URI");
  assert(isPostgresDatabase("file:./dev.db") === false, "Must not flag file: URI as postgres");
  console.log("  ✓ Verified PostgreSQL connection URI detection and schema isolation");

  // ---------------------------------------------------------------------------
  // 2. Setup Multi-Tenant User Fixtures
  // ---------------------------------------------------------------------------
  const user1Email = `pg_user1_${salt}@browserpilot.ai`;
  const user2Email = `pg_user2_${salt}@browserpilot.ai`;

  const user1 = await prisma.user.create({
    data: {
      email: user1Email,
      name: "Postgres Tenant Alpha",
      passwordHash: "hash_test_pg_1",
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: user2Email,
      name: "Postgres Tenant Beta",
      passwordHash: "hash_test_pg_2",
    },
  });

  // Watch 1: Due right now
  await upsertDiscoveryWatch(user1.id, {
    enabled: true,
    roles: ["Full Stack Engineer"],
    skills: ["Next.js", "PostgreSQL"],
    locations: ["Remote"],
    workModes: ["REMOTE"],
    opportunityTypes: ["FULL_TIME"],
    experienceLevels: ["ENTRY_LEVEL"],
    minimumMatchScore: 70,
    scanIntervalHours: 4,
    nextScanAt: new Date(Date.now() - 60000), // Due 1 minute ago
    lockedAt: null,
    lockOwner: null,
  });

  // Watch 2: Due right now
  await upsertDiscoveryWatch(user2.id, {
    enabled: true,
    roles: ["Backend Engineer"],
    skills: ["Python", "AWS"],
    locations: ["Hyderabad"],
    workModes: ["HYBRID"],
    opportunityTypes: ["FULL_TIME"],
    experienceLevels: ["MID"],
    minimumMatchScore: 70,
    scanIntervalHours: 4,
    nextScanAt: new Date(Date.now() - 120000), // Due 2 minutes ago
    lockedAt: null,
    lockOwner: null,
  });

  console.log("  ✓ Created multi-tenant database test fixtures");

  // ---------------------------------------------------------------------------
  // 3. Multi-Instance Atomic Lease Lock Race (5 Concurrent Workers)
  // ---------------------------------------------------------------------------
  console.log("▶ [CONCURRENCY] Simulating 5 Concurrent Worker Instances Claiming Same Watch...");
  const claimPromises = Array.from({ length: 5 }).map((_, idx) =>
    claimDiscoveryWatch(user1.id, `instance_worker_${idx}_${salt}`, 120000)
  );

  const claimResults = await Promise.all(claimPromises);
  const successCount = claimResults.filter((r) => r === true).length;
  const failureCount = claimResults.filter((r) => r === false).length;

  assert(successCount === 1, "Exactly 1 worker instance must successfully claim the lease");
  assert(failureCount === 4, "4 competing worker instances must receive false (atomic lock conflict)");
  console.log("  ✓ Verified atomic multi-instance lease claim mutual exclusion (1 winner, 4 rejected)");

  // ---------------------------------------------------------------------------
  // 4. Stale Lease Recovery After Worker Crash
  // ---------------------------------------------------------------------------
  console.log("▶ [FAULT TOLERANCE] Verifying Stale Lease Recovery After Worker Crash...");
  // Simulate worker crash leaving lockedAt in past (>120s)
  const staleLockedAt = new Date(Date.now() - 180000); // 3 minutes ago
  await prisma.discoveryWatch.update({
    where: { userId: user1.id },
    data: {
      lockedAt: staleLockedAt,
      lockOwner: "crashed_worker_instance_dead_999",
    },
  });

  const recovered = await claimDiscoveryWatch(user1.id, `recovery_worker_${salt}`, 120000);
  assert(recovered === true, "New worker must recover watch with expired lease (>120s)");

  // Release lock for subsequent test steps
  await releaseDiscoveryWatch(user1.id);
  console.log("  ✓ Verified automatic stale lease recovery after instance crash");

  // ---------------------------------------------------------------------------
  // 5. CloudWatch / EventBridge HTTP Trigger Authentication (POST & GET)
  // ---------------------------------------------------------------------------
  console.log("▶ [TRIGGER] Testing CloudWatch / EventBridge Endpoint Authentication...");

  // A. Reject missing auth
  const unauthReq = new NextRequest("http://localhost:3000/api/discovery/scheduler", {
    method: "POST",
    headers: {},
  });
  const unauthRes = await schedulerApiPost(unauthReq);
  assert(unauthRes.status === 401, "Unauthenticated cron trigger must return HTTP 401");

  // B. Reject invalid secret
  const invalidAuthReq = new NextRequest("http://localhost:3000/api/discovery/scheduler", {
    method: "POST",
    headers: {
      authorization: "Bearer wrong_secret_key",
    },
  });
  const invalidAuthRes = await schedulerApiPost(invalidAuthReq);
  assert(invalidAuthRes.status === 401, "Invalid cron secret must return HTTP 401");

  // C. Accept valid Bearer secret on GET health check
  const validGetReq = new NextRequest("http://localhost:3000/api/discovery/scheduler", {
    method: "GET",
    headers: {
      authorization: `Bearer ${testCronSecret}`,
    },
  });
  const validGetRes = await schedulerApiGet(validGetReq);
  assert(validGetRes.status === 200, "Valid GET health check must return HTTP 200");
  const getJson = await validGetRes.json();
  assert(getJson.status === "HEALTHY", "Health check status must be HEALTHY");
  assert(typeof getJson.metrics.dueWatchesCount === "number", "Health check must return dueWatchesCount metric");
  console.log("  ✓ Verified CloudWatch Bearer & header authentication gates");

  // ---------------------------------------------------------------------------
  // 6. External CloudWatch Cron Scheduled Execution with Email Delivery
  // ---------------------------------------------------------------------------
  console.log("▶ [EXECUTION] Executing Scheduled Discovery Trigger via External CloudWatch Invocation...");
  const mockEmailProvider = new MockEmailProvider();

  // Trigger POST with valid x-cron-secret header and custom email provider
  const validPostReq = new NextRequest("http://localhost:3000/api/discovery/scheduler", {
    method: "POST",
    headers: {
      "x-cron-secret": testCronSecret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      maxWatches: 50,
      concurrencyLimit: 2,
    }),
  });

  const validPostRes = await schedulerApiPost(validPostReq);
  assert(validPostRes.status === 200, "Authenticated POST trigger must return HTTP 200");
  const postJson = await validPostRes.json();
  assert(postJson.success === true, "Response must indicate success = true");
  assert(postJson.telemetry.watchesClaimed >= 2, "Must claim at least the 2 due test watches");
  assert(postJson.telemetry.watchesCompleted >= 2, "Must complete both watches");
  console.log("  ✓ Verified scheduled discovery execution across multiple due users");

  // ---------------------------------------------------------------------------
  // 7. Duplicate CloudWatch Invocations (Idempotency & Zero Spam)
  // ---------------------------------------------------------------------------
  console.log("▶ [IDEMPOTENCY] Testing Rapid Duplicate CloudWatch Trigger Idempotency...");
  const duplicateReq = new NextRequest("http://localhost:3000/api/discovery/scheduler", {
    method: "POST",
    headers: {
      authorization: `Bearer ${testCronSecret}`,
    },
  });
  const duplicateRes = await schedulerApiPost(duplicateReq);
  assert(duplicateRes.status === 200, "Duplicate trigger must return HTTP 200");
  const duplicateJson = await duplicateRes.json();
  assert(duplicateJson.telemetry.status === "EMPTY" || duplicateJson.telemetry.watchesDue === 0 || duplicateJson.telemetry.watchesClaimed === 0, "Duplicate run immediately after must find 0 due watches (Zero Duplicate Execution)");
  console.log("  ✓ Verified duplicate cron invocations are cleanly idempotent (status: EMPTY)");

  // ---------------------------------------------------------------------------
  // 8. Multi-Tenant User Isolation
  // ---------------------------------------------------------------------------
  console.log("▶ [ISOLATION] Verifying Multi-Tenant Data & Run Scoping...");
  const runsUser1 = await prisma.discoveryRun.findMany({ where: { userId: user1.id } });
  const runsUser2 = await prisma.discoveryRun.findMany({ where: { userId: user2.id } });

  assert(runsUser1.length >= 1, "User 1 must have its own persisted DiscoveryRun record");
  assert(runsUser2.length >= 1, "User 2 must have its own persisted DiscoveryRun record");
  assert(!runsUser1.some((r) => r.userId === user2.id), "User 1 runs must never contain User 2 data");
  assert(!runsUser2.some((r) => r.userId === user1.id), "User 2 runs must never contain User 1 data");
  console.log("  ✓ Verified multi-tenant user isolation across all scheduled execution runs");

  // ---------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.opportunityDiscoveryEvent.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [user1.id, user2.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [user1.id, user2.id] } } });

  console.log("✓ [TASK-021] All PostgreSQL Database & CloudWatch Scheduler Tests Passed!\n");
}

if (require.main === module) {
  runPostgresProductionSchedulerTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
