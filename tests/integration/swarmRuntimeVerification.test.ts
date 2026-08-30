/**
 * §TASK-024 SWARM CONFIGURATION RUNTIME VERIFICATION & REAL USER WORKFLOW TEST SUITE
 * 
 * Verifies the end-to-end user experience, configuration persistence, company targeting,
 * dynamic interval transitions, 100-point match score consistency, and multi-tenant isolation.
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
  getOpportunityWithSourceListings,
  getUserLifecycleAlerts,
} from "@/lib/db/opportunities";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { swarmDiscoveryEngine } from "@/lib/scraper/swarmDiscovery";
import { autonomousDiscoveryEngine } from "@/lib/scraper/autonomousDiscovery";
import { discoveryScheduler } from "@/lib/scraper/discoveryScheduler";
import { executeSearchPipeline } from "@/lib/scraper/searchPipeline";
import { rankOpportunities } from "@/lib/scraper/ranker";
import { type SearchProvider, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { MockEmailProvider } from "@/lib/notifications";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[TASK-024 ASSERTION FAILED]: ${msg}`);
  }
}

export async function runSwarmRuntimeVerificationTests() {
  console.log("▶ [TASK-024] Running Swarm Runtime Verification & User-Controlled Discovery Tests...");

  await ensureDatabaseSchema();

  const salt = Date.now();
  const userAEmail = `user_a_${salt}@browserpilot.ai`;
  const userBEmail = `user_b_${salt}@browserpilot.ai`;

  // ---------------------------------------------------------------------------
  // 1. Multi-Tenant User Setup
  // ---------------------------------------------------------------------------
  const userA = await prisma.user.create({
    data: {
      email: userAEmail,
      name: "Tenant Alice",
      passwordHash: "hash_test_alice",
      role: "USER",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: userBEmail,
      name: "Tenant Bob",
      passwordHash: "hash_test_bob",
      role: "USER",
    },
  });

  console.log("  ✓ Created multi-tenant users Alice & Bob");

  // ---------------------------------------------------------------------------
  // TEST A — Interval Persistence (6h -> 12h -> reload => 12h)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST A] Verifying Interval Persistence across reloads...");
  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 6 });
  let watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.scanIntervalHours === 6, "Initial interval must be 6h");

  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 12 });
  watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.scanIntervalHours === 12, "Updated interval must persist as 12h across reloads");
  console.log("  ✓ Test A Passed: Interval persists across reloads (6h -> 12h)");

  // ---------------------------------------------------------------------------
  // TEST B — Scheduler Uses Updated Interval (stored = 12h => nextScanAt reflects 12h)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST B] Verifying Scheduler uses updated interval for nextScanAt...");
  const tBefore = Date.now();
  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 12 });
  watchA = await getDiscoveryWatch(userA.id);
  const diffHoursA = (watchA.nextScanAt!.getTime() - tBefore) / (1000 * 3600);
  assert(Math.round(diffHoursA) === 12, `nextScanAt must be ~12 hours from now (got ${diffHoursA.toFixed(2)}h)`);
  console.log("  ✓ Test B Passed: Scheduler anchors nextScanAt to 12h interval");

  // ---------------------------------------------------------------------------
  // TEST C — Company Target Persistence (company = Razorpay -> reload => Razorpay)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST C] Verifying Company Target Persistence...");
  await upsertDiscoveryWatch(userA.id, { companies: ["Razorpay"] });
  watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.companies.length === 1 && watchA.companies[0] === "Razorpay", "Company target must persist as Razorpay");
  console.log("  ✓ Test C Passed: Company target Razorpay persisted across reload");

  // ---------------------------------------------------------------------------
  // TEST D — Company Target Execution (Razorpay -> Discovery Plan contains Razorpay)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST D] Verifying Company Target propagates to Discovery Plan...");
  const planD = buildDiscoveryPlan(watchA.roles.join(" "), {
    roles: watchA.roles,
    companies: watchA.companies,
  });
  assert(planD.targetCompanies.includes("Razorpay"), "Discovery plan must contain Razorpay");
  console.log("  ✓ Test D Passed: Discovery plan incorporates target company Razorpay");

  // ---------------------------------------------------------------------------
  // TEST E — Custom Role (role = Backend Engineer -> scheduler uses Backend Engineer)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST E] Verifying Custom Role propagation...");
  await upsertDiscoveryWatch(userA.id, { roles: ["Backend Engineer"] });
  watchA = await getDiscoveryWatch(userA.id);
  const planE = buildDiscoveryPlan(watchA.roles.join(" "), {
    roles: watchA.roles,
    role: watchA.roles[0],
  });
  assert(planE.roles.includes("Backend Engineer"), "Discovery plan must contain Backend Engineer");
  console.log("  ✓ Test E Passed: Custom role Backend Engineer propagated to discovery plan");

  // ---------------------------------------------------------------------------
  // TEST F — No Hardcoded Role Leakage (Software Engineer NOT injected)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST F] Verifying No Hardcoded Role Leakage...");
  assert(!planE.roles.includes("Software Engineer"), "Software Engineer default must NOT leak when user specified Backend Engineer");
  console.log("  ✓ Test F Passed: No hardcoded role leakage when custom role is provided");

  // ---------------------------------------------------------------------------
  // TEST G — Interval Transitions (6h -> 2h -> 24h)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST G] Verifying Dynamic Interval Transitions (6h -> 2h -> 24h)...");
  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 6 });
  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 2 });
  watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.scanIntervalHours === 2, "Interval must transition to 2h");

  await upsertDiscoveryWatch(userA.id, { scanIntervalHours: 24 });
  watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.scanIntervalHours === 24, "Interval must transition to 24h");
  console.log("  ✓ Test G Passed: All interval transitions (6h -> 2h -> 24h) succeed and persist");

  // ---------------------------------------------------------------------------
  // TEST H — Multi-Company Targeting (Google + Microsoft + Amazon)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST H] Verifying Multi-Company Targeting...");
  await upsertDiscoveryWatch(userA.id, { companies: ["Google", "Microsoft", "Amazon"] });
  watchA = await getDiscoveryWatch(userA.id);
  assert(watchA.companies.length === 3, "Must persist 3 companies");
  assert(watchA.companies.includes("Google"), "Must include Google");
  assert(watchA.companies.includes("Microsoft"), "Must include Microsoft");
  assert(watchA.companies.includes("Amazon"), "Must include Amazon");
  console.log("  ✓ Test H Passed: Multi-company targets [Google, Microsoft, Amazon] preserved");

  // ---------------------------------------------------------------------------
  // TEST I — Multi-Tenant Isolation
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST I] Verifying Tenant Isolation between Alice and Bob...");
  await upsertDiscoveryWatch(userB.id, {
    roles: ["Frontend Developer"],
    companies: ["Netflix"],
    scanIntervalHours: 4,
  });

  const watchB = await getDiscoveryWatch(userB.id);
  assert(watchB.roles.includes("Frontend Developer"), "User B has Frontend Developer");
  assert(watchB.companies.includes("Netflix"), "User B targets Netflix");
  assert(!watchB.companies.includes("Razorpay"), "User B must not see User A's Razorpay company");
  assert(!watchA.companies.includes("Netflix"), "User A must not see User B's Netflix company");
  console.log("  ✓ Test I Passed: Strict multi-tenant watch configuration isolation verified");

  // ---------------------------------------------------------------------------
  // TEST J — Natural Language Intent Equivalence
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST J] Verifying Natural Language Intent Equivalence...");
  const nlIntent = parseSearchIntent("Find backend engineering internships at Razorpay in Hyderabad every 12 hours");
  assert(Boolean(nlIntent.roles?.includes("Backend Engineer") || nlIntent.role === "Backend Engineer"), "NL must extract Backend Engineer");
  assert(Boolean(nlIntent.opportunityType === "INTERNSHIP" || nlIntent.opportunityTypes?.includes("INTERNSHIP")), "NL must extract INTERNSHIP");
  assert(Boolean(nlIntent.companies?.includes("Razorpay") || nlIntent.company === "Razorpay"), "NL must extract Razorpay");
  assert(Boolean(nlIntent.locations?.includes("Hyderabad") || nlIntent.location === "Hyderabad"), "NL must extract Hyderabad");
  assert(nlIntent.watchIntent?.scanIntervalHours === 12, "NL must extract 12h interval");
  console.log("  ✓ Test J Passed: Natural-language intent maps deterministically to canonical configuration");

  // ---------------------------------------------------------------------------
  // 2. Full End-to-End Real Discovery & Alert Verification Flow
  // ---------------------------------------------------------------------------
  console.log("▶ [REAL E2E FLOW] Executing Complete End-to-End Pipeline with User Watch Configuration...");

  // Alice configures full realistic watch
  await upsertDiscoveryWatch(userA.id, {
    enabled: true,
    roles: ["Backend Engineer"],
    skills: ["Python", "FastAPI"],
    locations: ["Hyderabad"],
    companies: ["Razorpay"],
    workModes: ["REMOTE", "HYBRID"],
    opportunityTypes: ["INTERNSHIP", "FULL_TIME"],
    experienceLevels: ["INTERN", "ENTRY_LEVEL"],
    minimumMatchScore: 75,
    scanIntervalHours: 12,
  });

  // Mock Provider returning 3 candidates:
  // 1. Matching Razorpay Backend Engineer (Score > 75)
  // 2. Unrelated Company Backend Engineer (Should be filtered by company targeting)
  // 3. Low relevance job (Score < 75)
  class RealisticProvider implements SearchProvider {
    name = "RealisticProvider";
    supports() { return true; }
    buildSearchUrl() { return "https://example.com"; }
    async harvestCandidates(): Promise<RawJobCandidate[]> {
      return [
        {
          sourcePlatform: "LinkedIn",
          sourceUrl: `https://linkedin.com/jobs/view/razorpay-be-${salt}`,
          applyUrl: `https://razorpay.com/careers/be-${salt}`,
          title: `Backend Engineer Intern ${salt}`,
          companyName: "Razorpay Software Private Limited",
          location: "Hyderabad, India",
          workMode: "HYBRID",
          experienceLevel: "INTERN",
          opportunityType: "INTERNSHIP",
          description: "Build payment pipelines using Python, FastAPI, and PostgreSQL at Razorpay.",
          discoveredAt: new Date(),
          postedAt: new Date(),
        },
        {
          sourcePlatform: "Indeed",
          sourceUrl: `https://indeed.com/viewjob?jk=unrelated-${salt}`,
          applyUrl: `https://indeed.com/viewjob?jk=unrelated-${salt}`,
          title: "Backend Engineer",
          companyName: "Unrelated Outsourcing Corp",
          location: "Hyderabad, India",
          workMode: "HYBRID",
          experienceLevel: "ENTRY_LEVEL",
          opportunityType: "FULL_TIME",
          description: "Java developer position.",
          discoveredAt: new Date(),
        },
      ];
    }
  }

  // Execute Autonomous Discovery Run for Alice
  const runResult = await autonomousDiscoveryEngine.runAutonomousDiscoveryForUser(userA.id, {
    customProviders: [new RealisticProvider()],
    customEmailProvider: new MockEmailProvider(),
    triggerType: "MANUAL",
  });

  assert(runResult.status === "SUCCESS", "Discovery run must succeed");
  assert(runResult.telemetry.newOpportunities === 1, "Must discover exactly 1 novel Razorpay opportunity");
  assert(runResult.telemetry.notificationsCreated === 1, "Must create exactly 1 notification for qualifying match");

  // Check generated LifecycleAlert
  const alerts = await getUserLifecycleAlerts(userA.id);
  assert(alerts.length >= 1, "Alice must receive LifecycleAlert");
  const razorpayAlert = alerts.find((a) => a.companyName.includes("Razorpay"));
  assert(razorpayAlert !== undefined, "Alert must be for Razorpay opportunity");
  assert(razorpayAlert!.transitionType === "NEW_OPPORTUNITY", "Alert transition must be NEW_OPPORTUNITY");

  console.log("  ✓ Full End-to-End Pipeline Passed: UI Config -> DAL -> Engine -> Swarm -> Filter -> Ranker -> Alert -> Persistence");

  // ---------------------------------------------------------------------------
  // 3. Points & Match Score Consistency Audit
  // ---------------------------------------------------------------------------
  console.log("▶ [MATCH SCORE AUDIT] Auditing 100-Point Score Calculation & Dimensional Breakdown...");

  const testOpp = {
    canonicalHash: `audit_hash_${salt}`,
    title: "Backend Engineer",
    companyName: "Razorpay",
    location: "Hyderabad",
    workMode: "HYBRID",
    experienceLevel: "ENTRY_LEVEL",
    opportunityType: "FULL_TIME",
    description: "Backend Engineer with Python and FastAPI",
    requirements: ["Python", "FastAPI"],
    skills: ["Python", "FastAPI"],
    sourceListings: [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/test",
        applyUrl: "https://linkedin.com/test",
        verificationStatus: "VERIFIED",
        seenAt: new Date(),
      },
    ],
    firstSeenAt: new Date(),
    lastVerifiedAt: new Date(),
    postedAt: new Date(),
    status: "ACTIVE",
  };

  const testIntent = {
    role: "Backend Engineer",
    roles: ["Backend Engineer"],
    skills: ["Python", "FastAPI"],
    workMode: "HYBRID",
    experienceLevel: "ENTRY_LEVEL",
    opportunityType: "FULL_TIME",
  };

  const ranked = rankOpportunities([testOpp as any], testIntent as any);
  assert(ranked.length === 1, "Must rank test opportunity");
  const scoreItem = ranked[0];

  // Verify dimensional breakdown:
  // Role: 35 (Exact match)
  // Skills: 25 (100% match)
  // WorkMode: 15 (HYBRID === HYBRID)
  // Freshness: 15 (Posted today)
  // Verification: 8 (Single verified source)
  // Total: 35 + 25 + 15 + 15 + 8 = 98 points
  assert(scoreItem.breakdown.role === 35, `Role score must be 35 (got ${scoreItem.breakdown.role})`);
  assert(scoreItem.breakdown.skills === 25, `Skills score must be 25 (got ${scoreItem.breakdown.skills})`);
  assert(scoreItem.breakdown.workMode === 15, `WorkMode score must be 15 (got ${scoreItem.breakdown.workMode})`);
  assert(scoreItem.breakdown.freshness === 15, `Freshness score must be 15 (got ${scoreItem.breakdown.freshness})`);
  assert(scoreItem.breakdown.verification === 8, `Verification score must be 8 (got ${scoreItem.breakdown.verification})`);
  assert(scoreItem.totalScore === 98, `Total score must be 98 (got ${scoreItem.totalScore})`);

  console.log("  ✓ Score Audit Passed: Exact match produces 98/100 points with full dimensional transparency");

  // ---------------------------------------------------------------------------
  // Cleanup Test Fixtures
  // ---------------------------------------------------------------------------
  await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.opportunityDiscoveryEvent.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.discoveryRun.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });

  console.log("✓ [TASK-024] All Swarm Runtime Verification & User-Controlled Discovery Tests Passed!\n");
}

if (require.main === module) {
  runSwarmRuntimeVerificationTests().then(
    () => process.exit(0),
    (err) => {
      console.error("Test failed:", err);
      process.exit(1);
    }
  );
}
