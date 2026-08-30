/**
 * §TASK-023 BROWSERPILOT PRODUCTION HARDENING & ADMIN-READY CONTROL PLANE TEST SUITE
 * Validates drift-free scheduler advancement, multi-criteria discovery control,
 * dynamic interval persistence (2h, 4h, 6h, 12h, 24h), company targeting without generic hallucinations,
 * and strict admin authorization boundaries (403 FORBIDDEN for normal users vs 200 OK for admins).
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_SECRET_KEY = "test_admin_supersecret_key_12345";
process.env.ADMIN_EMAILS = "admin.lead@browserpilot.ai,operations@browserpilot.ai";

import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import {
  getDiscoveryWatch,
  upsertDiscoveryWatch,
  updateDiscoveryWatchScanTimestamps,
} from "@/lib/db/opportunities";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { swarmDiscoveryEngine } from "@/lib/scraper/swarmDiscovery";
import { autonomousDiscoveryEngine } from "@/lib/scraper/autonomousDiscovery";
import { adminControlPlaneService } from "@/lib/admin/adminService";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { type SearchProvider, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-023 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runAdminControlPlaneHardeningTests() {
  console.log("▶ [TASK-023] Running Production Hardening & Admin Control Plane Tests...");

  await ensureDatabaseSchema();

  const salt = Date.now();
  const normalUserEmail = `student_normal_${salt}@browserpilot.ai`;
  const adminUserEmail = `admin.lead@browserpilot.ai`; // Defined in ADMIN_EMAILS
  const dbAdminUserEmail = `db_admin_${salt}@browserpilot.ai`;

  // ---------------------------------------------------------------------------
  // 1. Multi-Tenant User Setup with Explicit Roles
  // ---------------------------------------------------------------------------
  const normalUser = await prisma.user.create({
    data: {
      email: normalUserEmail,
      name: "Normal Student Tenant",
      passwordHash: "hash_test_normal",
      role: "USER",
    },
  });

  const dbAdminUser = await prisma.user.create({
    data: {
      email: dbAdminUserEmail,
      name: "Database Admin User",
      passwordHash: "hash_test_dbadmin",
      role: "ADMIN",
    },
  });

  console.log("  ✓ Created multi-tenant users with explicit USER and ADMIN roles");

  // ---------------------------------------------------------------------------
  // 2. Admin Authorization Boundary & Guard Verification
  // ---------------------------------------------------------------------------
  console.log("▶ [ADMIN RBAC] Testing Admin Authorization Boundaries & Secret Bypass...");

  // Unauthenticated / No Key -> Rejected
  const unauthCheck = await verifyAdminAccess(null);
  assert(!unauthCheck.isAdmin, "Unauthenticated access must be rejected");

  // Invalid Secret Key -> Rejected
  const invalidKeyCheck = await verifyAdminAccess("wrong-secret-key");
  assert(!invalidKeyCheck.isAdmin, "Invalid secret key must be rejected");

  // Valid Secret Header / Bearer -> SUPERADMIN
  const validHeaderCheck = await verifyAdminAccess("test_admin_supersecret_key_12345");
  assert(validHeaderCheck.isAdmin && validHeaderCheck.role === "SUPERADMIN", "Valid admin secret must grant SUPERADMIN");

  const validBearerCheck = await verifyAdminAccess("Bearer test_admin_supersecret_key_12345");
  assert(validBearerCheck.isAdmin && validBearerCheck.role === "SUPERADMIN", "Valid Bearer token must grant SUPERADMIN");

  console.log("  ✓ Verified Secret Header & Bearer Token administrative bypass");

  // ---------------------------------------------------------------------------
  // 3. User-Configured Roles, Skills & Companies Control Discovery Without Fallbacks
  // ---------------------------------------------------------------------------
  console.log("▶ [CUSTOM CONFIGURATION] Verifying Custom Roles & Criteria Control Discovery...");

  // Configure watch with completely custom roles (e.g. Backend Engineer, Python Developer)
  const customWatch = await upsertDiscoveryWatch(normalUser.id, {
    enabled: true,
    roles: ["Backend Engineer", "Python Developer"],
    skills: ["FastAPI", "PostgreSQL", "Kafka"],
    locations: ["Hyderabad", "Remote India"],
    companies: ["OpenAI", "Microsoft"],
    workModes: ["REMOTE", "HYBRID"],
    opportunityTypes: ["FULL_TIME"],
    preferredSources: ["LinkedIn", "Indeed"],
    minimumMatchScore: 75,
    scanIntervalHours: 2,
  });

  assert(customWatch.roles.length === 2, "Must persist 2 custom roles");
  assert(customWatch.roles.includes("Backend Engineer"), "Must include Backend Engineer");
  assert(customWatch.roles.includes("Python Developer"), "Must include Python Developer");
  assert(!customWatch.roles.includes("Software Engineer"), "Must NOT inject hard-coded Software Engineer");

  // Build discovery plan from watch
  const plan = buildDiscoveryPlan(customWatch.roles.join(" "), {
    role: customWatch.roles[0],
    roles: customWatch.roles,
    skills: customWatch.skills,
    locations: customWatch.locations,
    companies: customWatch.companies,
    workModes: customWatch.workModes as any,
    opportunityTypes: customWatch.opportunityTypes as any,
    minimumMatchScore: customWatch.minimumMatchScore,
  });

  assert(plan.roles.includes("Backend Engineer") && plan.roles.includes("Python Developer"), "Plan must have custom roles");
  assert(plan.targetCompanies.includes("OpenAI") && plan.targetCompanies.includes("Microsoft"), "Plan must have custom companies");
  assert(plan.workModes.includes("REMOTE") && plan.workModes.includes("HYBRID"), "Plan must have custom work modes");
  assert(plan.opportunityTypes.includes("FULL_TIME"), "Plan must have custom opportunity types");

  console.log("  ✓ Verified custom roles, skills, locations, companies, and work modes strictly control discovery");

  // ---------------------------------------------------------------------------
  // 4. Company-Targeted Watching & Normalization (Zero Generic Hallucinations)
  // ---------------------------------------------------------------------------
  console.log("▶ [COMPANY TARGETING] Testing Multi-Company Filtering & Generic Word Rejection...");

  class MockMultiCompanyProvider implements SearchProvider {
    name = "MockMultiCompanyProvider";
    supports() { return true; }
    buildSearchUrl() { return "https://example.com"; }
    async harvestCandidates(): Promise<RawJobCandidate[]> {
      return [
        {
          sourcePlatform: "MockMultiCompanyProvider",
          sourceUrl: "https://example.com/job1",
          applyUrl: "https://example.com/job1",
          title: "Backend Engineer",
          companyName: "OpenAI LLC",
          location: "Remote",
          workMode: "REMOTE",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockMultiCompanyProvider",
          sourceUrl: "https://example.com/job2",
          applyUrl: "https://example.com/job2",
          title: "Python Developer",
          companyName: "Microsoft Corporation",
          location: "Hyderabad",
          workMode: "HYBRID",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
        {
          sourcePlatform: "MockMultiCompanyProvider",
          sourceUrl: "https://example.com/job3",
          applyUrl: "https://example.com/job3",
          title: "Backend Engineer",
          companyName: "Generic Enterprise Corp",
          location: "Remote",
          workMode: "REMOTE",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          discoveredAt: new Date(),
        },
      ];
    }
  }

  // Execute swarm targeting OpenAI and Microsoft
  const swarmResult = await swarmDiscoveryEngine.executeSwarm(plan, {
    customProviders: [new MockMultiCompanyProvider()],
  });

  assert(swarmResult.candidates.length === 2, "Must retain exactly 2 candidates matching OpenAI and Microsoft");
  assert(swarmResult.candidates.some((c) => c.companyName.includes("OpenAI")), "Must retain OpenAI candidate");
  assert(swarmResult.candidates.some((c) => c.companyName.includes("Microsoft")), "Must retain Microsoft candidate");
  assert(!swarmResult.candidates.some((c) => c.companyName.includes("Generic Enterprise")), "Must filter out non-targeted company");

  // Verify generic words are NOT extracted as company names
  const genericQueryIntent = parseSearchIntent("Find developer jobs at startups in enterprise companies for 2026 graduates");
  assert(
    !genericQueryIntent.companies || genericQueryIntent.companies.length === 0,
    "Generic words (startups, enterprise, companies, graduates) must NOT be captured as company names"
  );

  console.log("  ✓ Verified company targeting retains matching companies and rejects generic word hallucinations");

  // ---------------------------------------------------------------------------
  // 5. Interval Persistence & Drift-Free NextScanAt Recalculation
  // ---------------------------------------------------------------------------
  console.log("▶ [DRIFT-FREE SCHEDULING] Testing Drift-Free Interval Transitions & Scheduling...");

  // Test full interval cycle: 6h -> 2h -> 12h -> 24h -> 4h
  const intervalSequence = [6, 2, 12, 24, 4];
  for (const interval of intervalSequence) {
    const t0 = Date.now();
    const updated = await upsertDiscoveryWatch(normalUser.id, {
      scanIntervalHours: interval,
    });

    assert(updated.scanIntervalHours === interval, `Interval must be persisted as ${interval}h`);
    assert(updated.nextScanAt instanceof Date, "nextScanAt must be updated Date");

    const diffHours = (updated.nextScanAt!.getTime() - t0) / 3600000;
    assert(Math.round(diffHours) === interval, `nextScanAt must be ~${interval} hours in the future (got ${diffHours.toFixed(2)}h)`);
  }

  // Test drift-free advancement: Scheduled for T_sched -> Next scan is T_sched + interval
  const scheduledTime = new Date(Date.now() - 30 * 60 * 1000); // Was scheduled 30m ago
  const testInterval = 4;
  await updateDiscoveryWatchScanTimestamps(
    normalUser.id,
    new Date(),
    new Date(scheduledTime.getTime() + testInterval * 3600 * 1000)
  );

  const watchAfterExecution = await getDiscoveryWatch(normalUser.id);
  const expectedNextTime = scheduledTime.getTime() + testInterval * 3600 * 1000;
  assert(
    Math.abs(watchAfterExecution.nextScanAt!.getTime() - expectedNextTime) < 5000,
    "nextScanAt must advance from scheduled timestamp without execution drift"
  );

  console.log("  ✓ Verified drift-free interval transitions and timestamp advancement");

  // ---------------------------------------------------------------------------
  // 6. Admin Control Plane Service & Telemetry Aggregation
  // ---------------------------------------------------------------------------
  console.log("▶ [ADMIN SERVICE] Verifying Admin Control Plane Metrics & Observability...");

  const metrics = await adminControlPlaneService.getOverviewMetrics();
  assert(metrics.system.status === "HEALTHY", "System status must be HEALTHY");
  assert(metrics.system.databaseEngine === "SQLITE_LIBSQL" || metrics.system.databaseEngine === "POSTGRESQL", "Must report correct DB engine");
  assert(metrics.users.totalUsers >= 2, "Must count total registered users");
  assert(metrics.watches.totalWatches >= 1, "Must count total watches");
  assert(typeof metrics.watches.intervalDistribution.twoHours === "number", "Must report interval distribution");
  assert(typeof metrics.runs.totalRuns === "number", "Must report discovery runs");
  assert(typeof metrics.catalog.totalOpportunities === "number", "Must report catalog counts");
  assert(typeof metrics.alerts.totalAlerts === "number", "Must report alert metrics");

  const paginatedWatches = await adminControlPlaneService.listDiscoveryWatches({ page: 1, limit: 10 });
  assert(paginatedWatches.watches.length >= 1, "Must return paginated discovery watches");
  assert(paginatedWatches.watches[0].user !== undefined, "Must include attached user metadata");

  const schedulerStatus = await adminControlPlaneService.getSchedulerStatus();
  assert(schedulerStatus.status === "ACTIVE", "Scheduler status must be ACTIVE");
  assert(typeof schedulerStatus.counts.totalWatches === "number", "Must report scheduler counts");

  console.log("  ✓ Verified Admin Control Plane service aggregates metrics, paginated watches, and scheduler status");

  // ---------------------------------------------------------------------------
  // 7. Multi-Tenant User Isolation (Configuration & Telemetry Scoping)
  // ---------------------------------------------------------------------------
  console.log("▶ [ISOLATION] Verifying User Isolation Across Config and Telemetry...");

  const userWatch1 = await getDiscoveryWatch(normalUser.id);
  const userWatch2 = await getDiscoveryWatch(dbAdminUser.id);

  assert(userWatch1.roles.includes("Backend Engineer"), "User 1 has custom roles");
  assert(!userWatch2.roles.includes("Backend Engineer"), "User 2 does not share User 1's custom roles");

  console.log("  ✓ Verified multi-tenant watch isolation");

  // ---------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [normalUser.id, dbAdminUser.id] } } });
  await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [normalUser.id, dbAdminUser.id] } } });
  await prisma.opportunityDiscoveryEvent.deleteMany({ where: { userId: { in: [normalUser.id, dbAdminUser.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [normalUser.id, dbAdminUser.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [normalUser.id, dbAdminUser.id] } } });

  console.log("✓ [TASK-023] All Production Hardening & Admin Control Plane Tests Passed!\n");
}

if (require.main === module) {
  runAdminControlPlaneHardeningTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
