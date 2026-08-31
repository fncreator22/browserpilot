/**
 * §TASK-027 DISCOVERY FRESHNESS & TIME-BOUND SEARCH INTEGRITY
 * Comprehensive verification of deterministic freshness boundaries, hard time constraints,
 * timezone normalization, NL intent mapping, company targeting composition,
 * swarm filtering, autonomous discovery alert suppression, and zero-leakage guarantees.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_SECRET_KEY = "test_admin_supersecret_key_12345";
process.env.ADMIN_EMAILS = "admin.lead@browserpilot.ai,operations@browserpilot.ai";

import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import {
  getDiscoveryWatch,
  upsertDiscoveryWatch,
  getUserLifecycleAlerts,
  type DiscoveryWatchConfig,
} from "@/lib/db/opportunities";
import { buildDiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import {
  parsePostingDate,
  isWithinFreshnessWindow,
} from "@/lib/scraper/freshnessExtractor";
import {
  SwarmDiscoveryEngine,
  type SwarmDiscoveryResult,
} from "@/lib/scraper/swarmDiscovery";
import { executeSearchPipeline } from "@/lib/scraper/searchPipeline";
import { autonomousDiscoveryEngine } from "@/lib/scraper/autonomousDiscovery";
import { deduplicateCandidates } from "@/lib/scraper/deduplicator";
import { rankOpportunities } from "@/lib/scraper/ranker";
import { type SearchProvider, type RawJobCandidate, type ProviderLimits } from "@/lib/scraper/providers/baseProvider";
import { MockEmailProvider } from "@/lib/notifications";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION_FAILED] ${msg}`);
  }
}

// Custom mock provider that emits candidates with explicit timestamps
class FreshnessTestProvider implements SearchProvider {
  public readonly name = "FreshnessTestProvider";

  constructor(private mockCandidates: RawJobCandidate[]) {}

  public supports(): boolean {
    return true;
  }

  public async harvestCandidates(): Promise<RawJobCandidate[]> {
    return this.mockCandidates;
  }
}

export async function runDiscoveryFreshnessIntegrityTests() {
  console.log("\n=================================================================");
  console.log("  [TASK-027] DISCOVERY FRESHNESS & TIME-BOUND SEARCH INTEGRITY   ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();
  const testRunId = Date.now();

  // Test Fixture Users
  const userFresh = await prisma.user.create({
    data: {
      email: `fresh_user_${testRunId}@browserpilot.ai`,
      name: "Freshness Test User",
      role: "USER",
      passwordHash: "test_password_hash_123",
    },
  });

  const userOther = await prisma.user.create({
    data: {
      email: `other_user_${testRunId}@browserpilot.ai`,
      name: "Other Tenant User",
      role: "USER",
      passwordHash: "test_password_hash_123",
    },
  });

  try {
    const baseNow = new Date("2026-08-31T12:00:00.000Z");

    // =========================================================================
    // 1. DETERMINISTIC BOUNDARY & TIMEZONE NORMALIZATION TESTS
    // =========================================================================
    console.log("▶ [SECTION 1] Testing Deterministic Freshness Boundaries & Timezone Normalization...");

    // Test 1: 24h accepts 5h old candidate
    const post5h = new Date(baseNow.getTime() - 5 * 3600 * 1000);
    assert(isWithinFreshnessWindow(post5h, 24, true, baseNow), "5h old must be within 24h window");

    // Test 2: 24h rejects 25h old candidate
    const post25h = new Date(baseNow.getTime() - 25 * 3600 * 1000);
    assert(!isWithinFreshnessWindow(post25h, 24, true, baseNow), "25h old must be rejected by 24h window");

    // Test 3: 48h accepts 40h old candidate
    const post40h = new Date(baseNow.getTime() - 40 * 3600 * 1000);
    assert(isWithinFreshnessWindow(post40h, 48, true, baseNow), "40h old must be within 48h window");

    // Test 4: 48h rejects 50h old candidate
    const post50h = new Date(baseNow.getTime() - 50 * 3600 * 1000);
    assert(!isWithinFreshnessWindow(post50h, 48, true, baseNow), "50h old must be rejected by 48h window");

    // Test 5: Exact boundary behavior
    const exact24h = new Date(baseNow.getTime() - 24 * 3600 * 1000);
    assert(isWithinFreshnessWindow(exact24h, 24, true, baseNow), "Exact 24.0h boundary must be accepted");

    // Test 6: Timezone-agnostic ISO string comparison
    const isoUtcString = post5h.toISOString();
    assert(isWithinFreshnessWindow(isoUtcString, 24, true, baseNow), "ISO string timestamp must match UTC calculation");

    // Test 7: Unknown posted date rejection under explicit constraint
    assert(!isWithinFreshnessWindow(null, 24, true, baseNow), "Null posted date must be rejected under explicit constraint");
    assert(!isWithinFreshnessWindow(undefined, 48, true, baseNow), "Undefined date must be rejected under explicit constraint");

    // Test 8: Malformed date string handling
    assert(!isWithinFreshnessWindow("not-a-valid-date", 24, true, baseNow), "Malformed date string must be rejected safely");

    // Test 9: Future posted date (clock drift) clamped safely
    const futureDate = new Date(baseNow.getTime() + 10 * 60 * 1000); // 10 mins in future
    assert(isWithinFreshnessWindow(futureDate, 24, true, baseNow), "Future date within clock drift margin must be handled safely");

    // Test 10: Non-explicit (default) mode preserves open discovery
    assert(isWithinFreshnessWindow(post50h, 24, false, baseNow), "Default mode (isExplicit=false) must allow older dates");
    assert(isWithinFreshnessWindow(null, 24, false, baseNow), "Default mode (isExplicit=false) must allow null dates");

    console.log("  ✓ Section 1 Passed: All 10 boundary, clock drift, and timezone tests verified.");

    // =========================================================================
    // 2. NATURAL-LANGUAGE FRESHNESS INTENT PARSER TESTS
    // =========================================================================
    console.log("▶ [SECTION 2] Testing Natural-Language Freshness Intent Extraction...");

    // Test 11: "last 24 hours" -> 24h explicit
    const intent24 = parseSearchIntent("Find Python jobs from the last 24 hours");
    assert(intent24.freshnessWindowHours === 24, "last 24 hours must parse to 24h");
    assert(intent24.isExplicitFreshness === true, "last 24 hours must set isExplicitFreshness=true");
    assert(intent24.sortMode === "LATEST", "last 24 hours must set sortMode=LATEST");

    // Test 12: "last 48 hours" -> 48h explicit
    const intent48 = parseSearchIntent("Backend internships at Razorpay in Hyderabad from the past 48 hours");
    assert(intent48.freshnessWindowHours === 48, "past 48 hours must parse to 48h");
    assert(intent48.isExplicitFreshness === true, "past 48 hours must set isExplicitFreshness=true");

    // Test 13: "last 72 hours" / "last 3 days" -> 72h explicit
    const intent72 = parseSearchIntent("React developer roles posted in the last 3 days");
    assert(intent72.freshnessWindowHours === 72, "last 3 days must parse to 72h");
    assert(intent72.isExplicitFreshness === true, "last 3 days must set isExplicitFreshness=true");

    // Test 14: "last 7 days" / "this week" -> 168h explicit
    const intentWeek = parseSearchIntent("AI ML internships posted this week");
    assert(intentWeek.freshnessWindowHours === 168, "this week must parse to 168h");
    assert(intentWeek.isExplicitFreshness === true, "this week must set isExplicitFreshness=true");

    // Test 15: "today" / "posted today" -> 24h explicit
    const intentToday = parseSearchIntent("Full stack roles posted today");
    assert(intentToday.freshnessWindowHours === 24, "posted today must parse to 24h");
    assert(intentToday.isExplicitFreshness === true, "posted today must set isExplicitFreshness=true");

    // Test 16: "latest jobs" / "newest internships" -> 48h explicit default
    const intentLatest = parseSearchIntent("Latest frontend engineer internships");
    assert(intentLatest.freshnessWindowHours === 48, "latest internships must parse to 48h");
    assert(intentLatest.isExplicitFreshness === true, "latest internships must set isExplicitFreshness=true");

    // Test 17: Query without time keywords -> default 168h, isExplicitFreshness=false
    const intentDefault = parseSearchIntent("Software engineer jobs in Bangalore");
    assert(intentDefault.freshnessWindowHours === 168, "default search must have 168h window");
    assert(intentDefault.isExplicitFreshness === false, "default search must NOT be explicit freshness constraint");
    assert(intentDefault.sortMode === "RELEVANCE_THEN_FRESHNESS", "default search sortMode must be RELEVANCE_THEN_FRESHNESS");

    console.log("  ✓ Section 2 Passed: Natural language freshness intent extraction verified.");

    // =========================================================================
    // 3. DISCOVERY PLANNER & FILTER OVERRIDES EQUIVALENCE
    // =========================================================================
    console.log("▶ [SECTION 3] Testing DiscoveryPlan Freshness Integration & Filter Overrides...");

    const planNL = buildDiscoveryPlan("Find Backend Engineer at Razorpay from last 48 hours");
    assert(planNL.freshnessWindowHours === 48, "NL plan must have freshnessWindowHours=48");
    assert(planNL.isExplicitFreshness === true, "NL plan must have isExplicitFreshness=true");
    assert(planNL.targetCompanies.includes("Razorpay"), "NL plan must retain target company Razorpay");

    // Explicit manual filter override equivalence
    const planManual = buildDiscoveryPlan("", {
      role: "Backend Engineer",
      company: "Razorpay",
      freshnessWindowHours: 48,
      isExplicitFreshness: true,
    });
    assert(planManual.freshnessWindowHours === 48, "Manual plan must have freshnessWindowHours=48");
    assert(planManual.isExplicitFreshness === true, "Manual plan must have isExplicitFreshness=true");

    console.log("  ✓ Section 3 Passed: DiscoveryPlan NL and Manual equivalence verified.");

    // =========================================================================
    // 4. SWARM DISCOVERY HARD FRESHNESS FILTERING & TELEMETRY
    // =========================================================================
    console.log("▶ [SECTION 4] Testing Swarm Discovery Engine Hard Freshness Filtering...");

    const now = new Date();
    const candidateFresh2h: RawJobCandidate = {
      sourcePlatform: "LinkedIn",
      sourceUrl: "https://linkedin.com/jobs/fresh-2h-123",
      applyUrl: "https://linkedin.com/jobs/fresh-2h-123",
      title: "Backend Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      workMode: "HYBRID",
      description: "Backend Engineer role at Razorpay with Python and PostgreSQL.",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 2 * 3600 * 1000), // 2h ago
      rawSnippet: "Posted 2 hours ago. Python, PostgreSQL.",
    };

    const candidateMedium36h: RawJobCandidate = {
      sourcePlatform: "Indeed",
      sourceUrl: "https://indeed.com/viewjob?jk=med-36h-456",
      applyUrl: "https://indeed.com/viewjob?jk=med-36h-456",
      title: "Full Stack Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      workMode: "HYBRID",
      description: "Full Stack Engineer role at Razorpay with Python and React.",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 36 * 3600 * 1000), // 36h ago
      rawSnippet: "Posted 1 day ago. Python, PostgreSQL.",
    };

    const candidateStale10d: RawJobCandidate = {
      sourcePlatform: "LinkedIn",
      sourceUrl: "https://linkedin.com/jobs/stale-10d-789",
      applyUrl: "https://linkedin.com/jobs/stale-10d-789",
      title: "Data Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      workMode: "HYBRID",
      description: "Data Engineer role at Razorpay with Python and SQL.",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000), // 10 days ago
      rawSnippet: "Posted 10 days ago. Python, PostgreSQL.",
    };

    const candidateUnknownDate: RawJobCandidate = {
      sourcePlatform: "Y Combinator",
      sourceUrl: "https://workatastartup.com/jobs/unknown-date-999",
      applyUrl: "https://workatastartup.com/jobs/unknown-date-999",
      title: "DevOps Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      workMode: "HYBRID",
      description: "DevOps Engineer role at Razorpay with Docker and AWS.",
      discoveredAt: now,
      postedAt: null,
      rawSnippet: "Python, PostgreSQL.",
    };

    const allMockCandidates = [
      candidateFresh2h,
      candidateMedium36h,
      candidateStale10d,
      candidateUnknownDate,
    ];

    // Swarm execution with 24-hour explicit constraint
    const swarmEngine = new SwarmDiscoveryEngine([new FreshnessTestProvider(allMockCandidates)]);
    const plan24h = buildDiscoveryPlan("Backend Engineer at Razorpay from last 24 hours");

    const swarmResult24h = await swarmEngine.executeSwarm(plan24h);
    assert(swarmResult24h.candidates.length === 1, `24h window must return strictly 1 candidate, got ${swarmResult24h.candidates.length}`);
    assert(swarmResult24h.candidates[0].sourceUrl === candidateFresh2h.sourceUrl, "24h candidate must be the 2h old one");
    assert(swarmResult24h.swarmTelemetry.rejectedByFreshness === 3, "Telemetry must report 3 candidates rejected by freshness");

    // Swarm execution with 48-hour explicit constraint
    const plan48h = buildDiscoveryPlan("Backend Engineer at Razorpay from last 48 hours");
    const swarmResult48h = await swarmEngine.executeSwarm(plan48h);
    assert(swarmResult48h.candidates.length === 2, `48h window must return 2 candidates (2h and 36h), got ${swarmResult48h.candidates.length}`);
    assert(swarmResult48h.swarmTelemetry.rejectedByFreshness === 2, "Telemetry must report 2 candidates rejected by freshness");

    // Swarm execution without explicit constraint (default mode)
    const planNoConstraint = buildDiscoveryPlan("Backend Engineer at Razorpay");
    const swarmResultDefault = await swarmEngine.executeSwarm(planNoConstraint);
    assert(swarmResultDefault.candidates.length === 4, `Default search must return all 4 candidates, got ${swarmResultDefault.candidates.length}`);
    assert(swarmResultDefault.swarmTelemetry.rejectedByFreshness === 0, "Default search must reject 0 by freshness");

    console.log("  ✓ Section 4 Passed: Swarm discovery hard filtering & telemetry verified.");

    // =========================================================================
    // 5. SEARCH PIPELINE, 100-POINT RANKING & ZERO STALE LEAKAGE
    // =========================================================================
    console.log("▶ [SECTION 5] Testing Search Pipeline Execution & Zero Stale Result Leakage...");

    // Stale 10-day job with 100% role/skills fit must NOT leak through 48h search
    const pipelineResult = await executeSearchPipeline("Software Engineer at Razorpay from last 48 hours", {
      userId: userFresh.id,
      customProviders: [new FreshnessTestProvider(allMockCandidates)],
    });

    assert(pipelineResult.rankedOpportunities.length === 2, `Expected 2 ranked opportunities in 48h window, got ${pipelineResult.rankedOpportunities.length}`);
    for (const item of pipelineResult.rankedOpportunities) {
      assert(item.opportunity.companyName === "Razorpay", "Company must be Razorpay");
      const ageHours = (Date.now() - new Date(item.opportunity.postedAt!).getTime()) / (3600 * 1000);
      assert(ageHours <= 48, `Returned opportunity age (${ageHours.toFixed(1)}h) must be <= 48h`);
    }

    console.log("  ✓ Section 5 Passed: Search pipeline hard freshness gating verified.");

    // =========================================================================
    // 6. AUTONOMOUS DISCOVERY WATCH, LIFECYCLE ALERTS & EMAIL SUPPRESSION
    // =========================================================================
    console.log("▶ [SECTION 6] Testing Autonomous Watch Execution & Stale Alert Suppression...");

    // Setup watch with 48h freshness window
    await upsertDiscoveryWatch(userFresh.id, {
      enabled: true,
      roles: ["Backend Engineer", "Full Stack Engineer"],
      skills: ["Python", "PostgreSQL", "React"],
      locations: ["Hyderabad"],
      companies: ["Razorpay"],
      workModes: ["HYBRID"],
      opportunityTypes: ["FULL_TIME"],
      experienceLevels: ["ENTRY_LEVEL"],
      scanIntervalHours: 4,
      freshnessWindowHours: 48,
      minimumMatchScore: 50,
      latestOnly: true,
    });

    const mockEmailProvider = new MockEmailProvider();

    // Run Autonomous Discovery
    const runResult = await autonomousDiscoveryEngine.runAutonomousDiscoveryForUser(userFresh.id, {
      customProviders: [new FreshnessTestProvider(allMockCandidates)],
      customEmailProvider: mockEmailProvider,
      triggerType: "MANUAL",
    });

    assert(runResult.status === "SUCCESS", "Autonomous run status must be SUCCESS");
    assert(runResult.telemetry.newOpportunities === 2, `Expected 2 new opportunities (2h and 36h), got ${runResult.telemetry.newOpportunities}`);

    // Verify persisted LifecycleAlerts for User Fresh
    const alerts = await getUserLifecycleAlerts(userFresh.id);
    assert(alerts.length === 2, `Expected exactly 2 alerts, got ${alerts.length}`);
    for (const alert of alerts) {
      assert(alert.userId === userFresh.id, "Alert must be scoped to userFresh");
      assert(alert.companyName === "Razorpay", "Alert company must be Razorpay");
    }

    // Verify outbound email dispatch
    const sentEmails = mockEmailProvider.sentEmails;
    assert(sentEmails.length === 2, `Expected 2 sent emails for the 2 fresh opportunities, got ${sentEmails.length}`);
    for (const email of sentEmails) {
      assert(email.to === userFresh.email, "Email must be delivered to userFresh");
    }

    // Verify multi-tenant isolation: User Other must have 0 alerts and 0 emails
    const otherAlerts = await getUserLifecycleAlerts(userOther.id);
    assert(otherAlerts.length === 0, "User Other must have 0 alerts");

    console.log("  ✓ Section 6 Passed: Autonomous watch freshness enforcement & alert suppression verified.");

    // =========================================================================
    // 7. DEDUPLICATION FRESHNESS PRESERVATION
    // =========================================================================
    console.log("▶ [SECTION 7] Testing Deduplication Freshness Preservation...");

    // Same job posted on two platforms: LinkedIn (10 days ago) and YC (2 hours ago)
    const dupOlder: RawJobCandidate = {
      sourcePlatform: "LinkedIn",
      sourceUrl: "https://linkedin.com/jobs/dup-job-1",
      applyUrl: "https://linkedin.com/jobs/dup-job-1",
      title: "Backend Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000), // 10 days ago
    };

    const dupNewer: RawJobCandidate = {
      sourcePlatform: "Y Combinator",
      sourceUrl: "https://workatastartup.com/jobs/dup-job-2",
      applyUrl: "https://workatastartup.com/jobs/dup-job-2",
      title: "Backend Engineer",
      companyName: "Razorpay",
      location: "Hyderabad",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 2 * 3600 * 1000), // 2 hours ago
    };

    const deduplicated = deduplicateCandidates([dupOlder, dupNewer]);
    assert(deduplicated.length === 1, "Deduplicator must merge matching opportunities into 1");
    assert(deduplicated[0].postedAt !== null, "Merged opportunity must have postedAt");
    const mergedAgeHours = (Date.now() - new Date(deduplicated[0].postedAt!).getTime()) / (3600 * 1000);
    assert(mergedAgeHours <= 3, `Merged opportunity must preserve the freshest postedAt (~2h), got ${mergedAgeHours.toFixed(1)}h`);

    console.log("  ✓ Section 7 Passed: Deduplication freshest timestamp preservation verified.");

  } finally {
    // Database fixture cleanup
    await prisma.lifecycleAlert.deleteMany({ where: { userId: { in: [userFresh.id, userOther.id] } } }).catch(() => {});
    await prisma.discoveryRun.deleteMany({ where: { userId: { in: [userFresh.id, userOther.id] } } }).catch(() => {});
    await prisma.discoveryWatch.deleteMany({ where: { userId: { in: [userFresh.id, userOther.id] } } }).catch(() => {});
    await prisma.search.deleteMany({ where: { userId: { in: [userFresh.id, userOther.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [userFresh.id, userOther.id] } } }).catch(() => {});
  }

  console.log("\n=================================================================");
  console.log("  [TASK-027] ALL DISCOVERY FRESHNESS TESTS PASSED (100% GREEN)   ");
  console.log("=================================================================\n");
}

if (require.main === module) {
  runDiscoveryFreshnessIntegrityTests()
    .then(() => {
      console.log("TASK-027 Test Suite Completed Successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("TASK-027 Test Suite Failed:", err);
      process.exit(1);
    });
}
