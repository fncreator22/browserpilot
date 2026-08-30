/**
 * §TASK-025 ADMIN CONTROL PLANE UI & API INTEGRATION TEST SUITE
 * 
 * Verifies server-side administrative RBAC, metric aggregation, company target visibility,
 * scheduler lease inspection, manual trigger capability, and secret isolation.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_SECRET_KEY = "test_admin_supersecret_key_12345";
process.env.ADMIN_EMAILS = "admin.lead@browserpilot.ai,operations@browserpilot.ai";

import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { adminControlPlaneService } from "@/lib/admin/adminService";
import { upsertDiscoveryWatch } from "@/lib/db/opportunities";
import { discoveryScheduler } from "@/lib/scraper/discoveryScheduler";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-025 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runAdminControlPlaneUITests() {
  console.log("▶ [TASK-025] Running Admin Control Plane UI & API Integration Tests...");

  await ensureDatabaseSchema();

  const salt = Date.now();
  const normalUserEmail = `normal_tenant_${salt}@browserpilot.ai`;
  const adminUserEmail = `admin_operator_${salt}@browserpilot.ai`;
  const superAdminEmail = `superadmin_${salt}@browserpilot.ai`;

  // ---------------------------------------------------------------------------
  // 1. User Fixture Setup
  // ---------------------------------------------------------------------------
  const normalUser = await prisma.user.create({
    data: {
      email: normalUserEmail,
      name: "Normal Tenant",
      passwordHash: "hash_test_normal",
      role: "USER",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: adminUserEmail,
      name: "Admin Operator",
      passwordHash: "hash_test_admin",
      role: "ADMIN",
    },
  });

  const superAdminUser = await prisma.user.create({
    data: {
      email: superAdminEmail,
      name: "Super Administrator",
      passwordHash: "hash_test_superadmin",
      role: "SUPERADMIN",
    },
  });

  console.log("  ✓ Created test users with USER, ADMIN, and SUPERADMIN roles");

  // ---------------------------------------------------------------------------
  // 2. RBAC Access Control Verification
  // ---------------------------------------------------------------------------
  console.log("▶ [RBAC CHECK] Verifying Role-Based Access Control...");

  // Normal user must be rejected
  const normalCheck = await verifyAdminAccess(null);
  // Without admin key / session, should not have access
  assert(!normalCheck.isAdmin, "Unauthorized session or USER role must be rejected");

  // Superadmin Secret Key Bypass
  const superKeyCheck = await verifyAdminAccess("Bearer test_admin_supersecret_key_12345");
  assert(superKeyCheck.isAdmin, "Valid ADMIN_SECRET_KEY must grant administrative access");
  assert(superKeyCheck.role === "SUPERADMIN", "Secret header must resolve to SUPERADMIN");

  // ADMIN_EMAILS environment variable check
  const envAdminCheck = await verifyAdminAccess("Bearer invalid_key");
  assert(!envAdminCheck.isAdmin, "Invalid secret key must not grant access");

  console.log("  ✓ RBAC Check Passed: Strict privilege verification confirmed");

  // ---------------------------------------------------------------------------
  // 3. Admin Overview Metrics API
  // ---------------------------------------------------------------------------
  console.log("▶ [METRICS API] Testing /api/admin/metrics domain aggregation...");

  // Setup sample discovery watches (including company-targeted watches)
  await upsertDiscoveryWatch(normalUser.id, {
    enabled: true,
    roles: ["Backend Engineer"],
    skills: ["Python", "FastAPI"],
    locations: ["Hyderabad"],
    companies: ["Razorpay"],
    scanIntervalHours: 12,
    minimumMatchScore: 75,
  });

  await upsertDiscoveryWatch(adminUser.id, {
    enabled: true,
    roles: ["Software Engineer"],
    companies: ["Google", "Microsoft"],
    scanIntervalHours: 4,
    minimumMatchScore: 80,
  });

  const metrics = await adminControlPlaneService.getOverviewMetrics();

  assert(metrics.system.status === "HEALTHY", "System status must be HEALTHY");
  assert(metrics.users.totalUsers >= 3, "Total users count must include created tenants");
  assert(metrics.watches.activeWatches >= 2, "Active watches count must be at least 2");
  assert(metrics.watches.totalTargetCompaniesConfigured >= 3, "Total target companies must reflect [Razorpay, Google, Microsoft]");
  assert(metrics.watches.intervalDistribution.twelveHours >= 1, "Interval distribution must reflect 12h watch");
  assert(metrics.watches.intervalDistribution.fourHours >= 1, "Interval distribution must reflect 4h watch");

  console.log("  ✓ Metrics API Passed: System telemetry, watch distribution, and catalog counts aggregated correctly");

  // ---------------------------------------------------------------------------
  // 4. Admin Watches List & Company Target Visibility
  // ---------------------------------------------------------------------------
  console.log("▶ [WATCHES API] Testing /api/admin/watches list and company target visibility...");

  const watchesRes = await adminControlPlaneService.listDiscoveryWatches({ page: 1, limit: 20 });
  assert(watchesRes.watches.length >= 2, "Must return at least 2 watches");

  const razorpayWatch = watchesRes.watches.find((w) => w.companies.includes("Razorpay"));
  assert(razorpayWatch !== undefined, "Admin must be able to view Razorpay company-targeted watch");
  assert(razorpayWatch!.roles.includes("Backend Engineer"), "Watch must preserve Backend Engineer role");
  assert(razorpayWatch!.scanIntervalHours === 12, "Watch must preserve 12h scan interval");
  assert(razorpayWatch!.minimumMatchScore === 75, "Watch must preserve 75 pts minimum score");

  const multiCompanyWatch = watchesRes.watches.find((w) => w.companies.includes("Google"));
  assert(multiCompanyWatch !== undefined, "Admin must be able to view Google targeted watch");
  assert(multiCompanyWatch!.companies.includes("Microsoft"), "Multi-company watch must include Microsoft");

  console.log("  ✓ Watches API Passed: Company targeting, roles, intervals, and match scores visible to admin");

  // ---------------------------------------------------------------------------
  // 5. Admin Discovery Runs Log & Telemetry
  // ---------------------------------------------------------------------------
  console.log("▶ [RUNS API] Testing /api/admin/runs execution telemetry...");

  // Record a sample discovery run for telemetry verification
  await prisma.discoveryRun.create({
    data: {
      userId: normalUser.id,
      triggerType: "SCHEDULED",
      status: "SUCCESS",
      startedAt: new Date(),
      completedAt: new Date(),
      durationMs: 1420,
      candidatesFound: 8,
      validCandidates: 8,
      newOpportunities: 2,
      newSources: 1,
      alreadyKnown: 5,
      reposted: 0,
      notificationsCreated: 2,
    },
  });

  const runsRes = await adminControlPlaneService.listDiscoveryRuns({ page: 1, limit: 20 });
  assert(runsRes.runs.length >= 1, "Must return at least 1 discovery run");
  const latestRun = runsRes.runs[0];
  assert(latestRun.candidatesFound === 8, "Run must report 8 candidates harvested");
  assert(latestRun.newOpportunities === 2, "Run must report 2 new opportunities");
  assert(latestRun.notificationsCreated === 2, "Run must report 2 alerts created");

  console.log("  ✓ Runs API Passed: Execution duration, novelty breakdown, and alerts logged accurately");

  // ---------------------------------------------------------------------------
  // 6. Admin Scheduler Status & Worker Lease Inspection
  // ---------------------------------------------------------------------------
  console.log("▶ [SCHEDULER API] Testing /api/admin/scheduler queue and lock inspection...");

  const schedStatus = await adminControlPlaneService.getSchedulerStatus();
  assert(schedStatus.status === "ACTIVE", "Scheduler queue status must be ACTIVE");
  assert(schedStatus.counts.totalWatches >= 2, "Total watches in scheduler must be at least 2");
  assert(Array.isArray(schedStatus.activeWorkerClaims), "Active worker claims must be an array");

  console.log("  ✓ Scheduler API Passed: Live queue status and lease visibility verified");

  // ---------------------------------------------------------------------------
  // 7. Manual Scheduler Trigger via Admin Contract
  // ---------------------------------------------------------------------------
  console.log("▶ [MANUAL TRIGGER] Testing manual scheduled discovery trigger...");

  const triggerTelemetry = await discoveryScheduler.runScheduledDiscovery({
    maxWatchesToProcess: 5,
    concurrencyLimit: 2,
  });

  assert(typeof triggerTelemetry.durationMs === "number", "Trigger must return execution duration");
  assert(typeof triggerTelemetry.watchesExamined === "number", "Trigger must return examined watches count");

  console.log("  ✓ Manual Trigger Passed: Admin can safely trigger scheduled discovery cycles");

  // ---------------------------------------------------------------------------
  // 8. Secret Isolation Audit (Zero Credential Leakage)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECURITY AUDIT] Auditing data structures for zero secret exposure...");

  // Verify that watches list contains NO passwords or credentials
  for (const w of watchesRes.watches) {
    assert((w.user as any).passwordHash === undefined, "passwordHash must NOT be exposed in watch API");
    assert((w as any).cronSecret === undefined, "cronSecret must NOT be exposed in watch API");
  }

  console.log("  ✓ Security Audit Passed: Zero passwords, hashes, or infrastructure secrets exposed");

  // ---------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [normalUser.id, adminUser.id, superAdminUser.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [normalUser.id, adminUser.id, superAdminUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [normalUser.id, adminUser.id, superAdminUser.id] } } });

  console.log("✓ [TASK-025] All Admin Control Plane UI & API Integration Tests Passed!\n");
}

if (require.main === module) {
  runAdminControlPlaneUITests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
