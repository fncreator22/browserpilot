import assert from "assert";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { getRecentSecurityAuditEvents } from "@/lib/security/auditLog";
import { rateLimiter } from "@/lib/security/rateLimiter";
import { prisma } from "@/lib/db/prisma";

async function runTests() {
  console.log("\n=================================================================");
  console.log("  TEST SUITE: ADMIN SECURITY PATCH & CRASH RECOVERY VERIFICATION ");
  console.log("=================================================================\n");

  // ---------------------------------------------------------------------------
  // PART A: INDEPENDENT STALE EXECUTION CRASH RECOVERY
  // ---------------------------------------------------------------------------
  console.log("▶ [PART A.1] Testing Independent Recovery Scheduler Timer...");
  const timer = executionLifecycleManager.startIndependentRecoveryScheduler(1000);
  assert(timer, "Scheduler timer must be returned");
  executionLifecycleManager.stopIndependentRecoveryScheduler();
  console.log("  ✓ Independent recovery scheduler starts and stops cleanly");

  console.log("▶ [PART A.2] Testing Stale RUNNING and QUEUED Execution Recovery...");
  const testUser = await prisma.user.findFirst();
  if (!testUser) {
    throw new Error("Test requires at least one user in DB");
  }

  // Seed stale RUNNING execution (simulating dead worker)
  const staleRunning = await prisma.search.create({
    data: {
      user: { connect: { id: testUser.id } },
      rawQuery: "Stale Running Test Query",
      status: "RUNNING",
      totalFound: 2,
      updatedAt: new Date(Date.now() - 60000), // 60 seconds old
    },
  });

  // Seed stale QUEUED execution (simulating container crash before pickup)
  const staleQueued = await prisma.search.create({
    data: {
      user: { connect: { id: testUser.id } },
      rawQuery: "Stale Queued Test Query",
      status: "QUEUED",
      totalFound: 0,
      updatedAt: new Date(Date.now() - 400000), // >5 mins old
    },
  });

  // Run independent recovery with threshold 30s
  const recoveryResult = await executionLifecycleManager.recoverStaleExecutions(30000);
  assert(recoveryResult.recoveredCount >= 2, "Must recover at least 2 stale executions");
  assert(recoveryResult.staleExecutionIds.includes(staleRunning.id), "Must include stale running execution");
  assert(recoveryResult.staleExecutionIds.includes(staleQueued.id), "Must include stale queued execution");

  // Check DB transitions
  const updatedRunning = await prisma.search.findUnique({ where: { id: staleRunning.id } });
  assert.strictEqual(updatedRunning?.status, "RECOVERABLE", "Partial results must be preserved as RECOVERABLE");
  assert.strictEqual(updatedRunning?.stoppingReason, "INTERRUPTED_CRASH", "Stopping reason must be INTERRUPTED_CRASH");

  const updatedQueued = await prisma.search.findUnique({ where: { id: staleQueued.id } });
  assert.strictEqual(updatedQueued?.status, "FAILED", "Queued timeout must be marked FAILED");
  assert.strictEqual(updatedQueued?.stoppingReason, "QUEUE_TIMEOUT_CRASH", "Stopping reason must be QUEUE_TIMEOUT_CRASH");
  console.log("  ✓ Independent recovery sweep correctly reconciled both RUNNING and QUEUED orphans");

  // Cleanup seeded test records
  await prisma.search.deleteMany({
    where: { id: { in: [staleRunning.id, staleQueued.id] } },
  });

  // ---------------------------------------------------------------------------
  // PART B: ADMIN SECRET KEY SECURITY AUDITING, RATE LIMITING & ROTATION
  // ---------------------------------------------------------------------------
  console.log("\n▶ [PART B.1] Testing Audit Logging on Admin Secret Bypass...");
  const originalSecret = process.env.ADMIN_SECRET_KEY;
  const testSecret = "super_secure_admin_key_987654";
  process.env.ADMIN_SECRET_KEY = testSecret;

  const testIp = "192.168.1.105";
  const testEndpoint = "/api/admin/metrics";
  await rateLimiter.reset(`admin_auth_failed:${testIp}`);

  // Test failed attempt
  const failRes = await verifyAdminAccess("wrong_key_attempt", { ip: testIp, endpoint: testEndpoint });
  assert(!failRes.isAdmin, "Invalid key must be rejected");

  // Verify failure audit event was logged
  const auditEventsAfterFail = getRecentSecurityAuditEvents(5);
  const failEvent = auditEventsAfterFail.find(
    (e) => e.type === "ADMIN_SECRET_BYPASS_FAILURE" && e.ip === testIp
  );
  assert(failEvent, "Must record ADMIN_SECRET_BYPASS_FAILURE in security audit log");
  assert.strictEqual(failEvent.path, testEndpoint, "Must record endpoint accessed");
  // Check secret was NOT logged
  assert.strictEqual(
    JSON.stringify(failEvent).includes("wrong_key_attempt"),
    false,
    "Raw secret value must NEVER be logged"
  );
  console.log("  ✓ Failed admin secret bypass logged security audit event without leaking secret");

  // Test successful attempt
  const successRes = await verifyAdminAccess(`Bearer ${testSecret}`, { ip: testIp, endpoint: testEndpoint });
  assert(successRes.isAdmin, "Valid secret must grant admin");
  assert.strictEqual(successRes.role, "SUPERADMIN", "Role must be SUPERADMIN");

  const auditEventsAfterSuccess = getRecentSecurityAuditEvents(5);
  const successEvent = auditEventsAfterSuccess.find(
    (e) => e.type === "ADMIN_SECRET_BYPASS_SUCCESS" && e.ip === testIp
  );
  assert(successEvent, "Must record ADMIN_SECRET_BYPASS_SUCCESS in security audit log");
  assert.strictEqual(successEvent.path, testEndpoint, "Must record endpoint accessed");
  console.log("  ✓ Successful admin secret bypass logged security audit event with IP, endpoint, and role");

  console.log("\n▶ [PART B.2] Testing Rate Limiting / Temporary Lockout After Repeated Failures...");
  const bruteForceIp = "10.0.0.99";
  await rateLimiter.reset(`admin_auth_failed:${bruteForceIp}`);

  // Simulate 5 consecutive failed attempts
  for (let i = 1; i <= 5; i++) {
    const res = await verifyAdminAccess("bad_guess_" + i, { ip: bruteForceIp, endpoint: "/api/admin/sensitive" });
    assert(!res.isAdmin, `Attempt ${i} must fail`);
  }

  // 6th attempt should be LOCKED OUT, even if trying the valid secret
  const lockedOutRes = await verifyAdminAccess(testSecret, { ip: bruteForceIp, endpoint: "/api/admin/sensitive" });
  assert(!lockedOutRes.isAdmin, "6th attempt must be rejected due to temporary lockout");
  assert.strictEqual(lockedOutRes.error, "RATE_LIMITED_LOCKOUT", "Error must be RATE_LIMITED_LOCKOUT");

  const lockoutAudit = getRecentSecurityAuditEvents(5).find(
    (e) => e.type === "RATE_LIMIT_EXCEEDED" && e.ip === bruteForceIp
  );
  assert(lockoutAudit, "Must record RATE_LIMIT_EXCEEDED audit event for lockout");
  console.log("  ✓ Temporary lockout successfully enforced after repeated failed attempts");

  console.log("\n▶ [PART B.3] Testing Dynamic Secret Rotation via Environment Variable Alone...");
  const rotatedSecret = "rotated_secret_dynamic_112233";
  process.env.ADMIN_SECRET_KEY = rotatedSecret;

  const rotateIp = "172.16.0.40";
  // Old secret should now FAIL
  const oldSecretRes = await verifyAdminAccess(testSecret, { ip: rotateIp, endpoint: "/api/admin/runs" });
  assert(!oldSecretRes.isAdmin, "Old secret must fail immediately after env var change");

  // New secret should immediately SUCCEED
  const newSecretRes = await verifyAdminAccess(rotatedSecret, { ip: rotateIp, endpoint: "/api/admin/runs" });
  assert(newSecretRes.isAdmin && newSecretRes.role === "SUPERADMIN", "Rotated secret must immediately grant SUPERADMIN");
  console.log("  ✓ Dynamic secret rotation confirmed: updating env var takes effect immediately with zero code deploy");

  // Restore env
  process.env.ADMIN_SECRET_KEY = originalSecret;
  await rateLimiter.reset(`admin_auth_failed:${bruteForceIp}`);
  await rateLimiter.reset(`admin_auth_failed:${testIp}`);
  await rateLimiter.reset(`admin_auth_failed:${rotateIp}`);

  console.log("\n=================================================================");
  console.log("  ✅ ALL CRASH RECOVERY & ADMIN SECURITY TESTS PASSED!");
  console.log("=================================================================\n");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
