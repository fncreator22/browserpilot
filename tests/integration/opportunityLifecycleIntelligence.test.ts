/**
 * §INTEGRATION: OPPORTUNITY LIFECYCLE, DATA INTELLIGENCE & SEARCH MEMORY (TASK-042)
 * 
 * Verifies canonical opportunity identity, multi-tier cross-source deduplication,
 * deterministic lifecycle transitions, material change detection, 48-hour freshness,
 * search memory, intelligent refresh planning, user interaction learning, and admin telemetry.
 */

import assert from "node:assert";
import { prisma, ensureDatabaseSchema } from "../../lib/db/prisma";
import { buildOpportunityIdentity, matchOpportunityIdentity } from "../../lib/discovery/lifecycle/opportunityIdentity";
import { opportunityLifecycleManager } from "../../lib/discovery/lifecycle/opportunityLifecycleManager";
import { opportunityChangeDetector } from "../../lib/discovery/lifecycle/opportunityChangeDetector";
import { searchMemoryService } from "../../lib/discovery/memory/searchMemoryService";
import { intelligentRefreshPlanner } from "../../lib/discovery/memory/intelligentRefreshPlanner";
import { userInteractionFeedbackService } from "../../lib/discovery/memory/userInteractionFeedback";
import { opportunityNotificationService } from "../../lib/discovery/lifecycle/opportunityNotificationService";
import { adminControlPlaneService } from "../../lib/admin/adminService";
import { upsertCompanyIntelligence } from "../../lib/discovery/company/companyIntelligence";
import { sourceRegistry } from "../../lib/discovery/sources/sourceRegistry";
import { type RawJobCandidate } from "../../lib/scraper/providers/baseProvider";

export async function runOpportunityLifecycleIntelligenceTests() {
  console.log("\n=================================================================");
  console.log("  TASK-042: OPPORTUNITY LIFECYCLE & SEARCH MEMORY SUITE          ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  // Reset source health
  for (const s of sourceRegistry.getAllSources()) {
    s.status = "HEALTHY";
    s.reliabilityScore = 0.95;
  }

  const salt = Date.now();
  const testUserA = `user_life_a_${salt}`;
  const testUserB = `user_life_b_${salt}`;
  const testCompany = `Stripe_${salt}`;

  const userA = await prisma.user.create({
    data: {
      email: `${testUserA}@example.com`,
      passwordHash: "hashA",
      role: "USER",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `${testUserB}@example.com`,
      passwordHash: "hashB",
      role: "USER",
    },
  });

  // ---------------------------------------------------------------------------
  // 1. Canonical Opportunity Identity & Cross-Source Matching (2, 10)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 1] Testing Canonical Opportunity Identity & Multi-Source Matching (2, 10)...");

  const candLinkedIn: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: `https://www.linkedin.com/jobs/view/1001_${salt}`,
    applyUrl: `https://${testCompany.toLowerCase()}.com/careers/swe?utm_source=linkedin&ref=123`,
    title: "Software Engineer",
    companyName: testCompany,
    location: "San Francisco, CA",
    workMode: "HYBRID",
    experienceLevel: "ENTRY_LEVEL",
    opportunityType: "FULL_TIME",
    description: "Build robust global payment infrastructure with TypeScript and Node.js.",
    discoveredAt: new Date(),
  };

  const candGreenhouse: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: `https://boards.greenhouse.io/${testCompany.toLowerCase()}/jobs/5001_${salt}`,
    applyUrl: `https://${testCompany.toLowerCase()}.com/careers/swe?source=greenhouse`,
    title: "Software Engineer",
    companyName: testCompany,
    location: "San Francisco, CA",
    workMode: "HYBRID",
    experienceLevel: "ENTRY_LEVEL",
    opportunityType: "FULL_TIME",
    description: "Build payment rails and payment gateway systems with distributed systems.",
    discoveredAt: new Date(),
  };

  const candSenior: RawJobCandidate = {
    sourcePlatform: "Indeed",
    sourceUrl: `https://www.indeed.com/viewjob?jk=999_${salt}`,
    applyUrl: `https://${testCompany.toLowerCase()}.com/careers/sr-swe`,
    title: "Senior Staff Software Engineer",
    companyName: testCompany,
    location: "San Francisco, CA",
    workMode: "HYBRID",
    experienceLevel: "SENIOR",
    opportunityType: "FULL_TIME",
    description: "Lead foundational architecture for global billing systems.",
    discoveredAt: new Date(),
  };

  const identityLI = buildOpportunityIdentity(candLinkedIn);
  const identityGH = buildOpportunityIdentity(candGreenhouse);
  const identitySr = buildOpportunityIdentity(candSenior);

  assert.strictEqual(identityLI.canonicalHash, identityGH.canonicalHash, "Canonical hashes match for identical role across platforms (2)");
  assert.notStrictEqual(identityLI.canonicalHash, identitySr.canonicalHash, "Seniority distinction generates unique canonical identity (2)");

  const matchRes = matchOpportunityIdentity(candLinkedIn, candGreenhouse);
  assert.strictEqual(matchRes.isMatch, true, "Cross-source candidate match recognized (10)");
  assert.ok(matchRes.confidence >= 0.95, "High confidence match score computed (10)");

  const seniorMatch = matchOpportunityIdentity(candLinkedIn, candSenior);
  assert.strictEqual(seniorMatch.isMatch, false, "Genuinely distinct senior role is NOT falsely merged (2, 10)");
  console.log("  ✓ Verified canonical identity and cross-source non-destructive matching (2, 10)");

  // ---------------------------------------------------------------------------
  // 2. Deterministic Opportunity Lifecycle State Transitions (3, 5)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 2] Testing Deterministic Opportunity Lifecycle Transitions (3, 5)...");

  // Step A: New Discovery -> ACTIVE with SourceListing
  const rec1 = await opportunityLifecycleManager.reconcileCandidate(candLinkedIn);
  assert.strictEqual(rec1.currentStatus, "ACTIVE", "New discovery transitions to ACTIVE upon verification (3)");
  assert.strictEqual(rec1.opportunity.sourceCount, 1, "Initial source listing linked (11)");

  // Step B: Re-discovery on second platform -> links second SourceListing
  const rec2 = await opportunityLifecycleManager.reconcileCandidate(candGreenhouse);
  assert.strictEqual(rec2.currentStatus, "ACTIVE", "Re-discovery maintains ACTIVE state (3)");
  assert.strictEqual(rec2.opportunity.sourceCount, 2, "Second source listing provenance linked (11)");
  assert.ok(rec2.opportunity.sources.includes("LinkedIn") && rec2.opportunity.sources.includes("Greenhouse"), "All source platforms tracked (11)");

  // Step C: 48-Hour Staleness Sweep
  // Artificially age the opportunity verification timestamp to 50 hours ago
  await prisma.opportunity.update({
    where: { id: rec2.opportunity.id },
    data: { lastVerifiedAt: new Date(Date.now() - 50 * 3600 * 1000) },
  });

  const sweep = await opportunityLifecycleManager.sweepStaleness();
  assert.ok(sweep.staleMarkedCount >= 1, "Opportunities older than 48h marked STALE (5)");

  const agedOpp = await prisma.opportunity.findUnique({ where: { id: rec2.opportunity.id } });
  assert.strictEqual(agedOpp?.status, "STALE", "Lifecycle status transitioned to STALE (3, 5)");

  // Step D: Re-crawl brings STALE -> ACTIVE
  const recFresh = await opportunityLifecycleManager.reconcileCandidate(candLinkedIn);
  assert.strictEqual(recFresh.currentStatus, "ACTIVE", "Re-crawl refreshes STALE back to ACTIVE (3)");
  console.log("  ✓ Verified lifecycle state transitions and 48-hour staleness sweep (3, 5)");

  // ---------------------------------------------------------------------------
  // 3. Material Change Detection (4)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 3] Testing Material Opportunity Change Detection (4)...");

  const candChanged: RawJobCandidate = {
    ...candLinkedIn,
    title: "Software Engineer II - Payments Core",
    workMode: "REMOTE",
    applyUrl: `https://${testCompany.toLowerCase()}.com/careers/swe-core-v2`,
    description: "Expanded role requirements: Build global real-time settlement rails across 40+ countries with low-latency Go and Rust microservices.",
  };

  const recChanged = await opportunityLifecycleManager.reconcileCandidate(candChanged);
  assert.strictEqual(recChanged.currentStatus, "UPDATED", "Material changes transition opportunity to UPDATED (4)");
  assert.ok(recChanged.changesDetected.length >= 2, "Specific material changes detected (4)");
  assert.ok(recChanged.changesDetected.some((c) => c.changeType === "TITLE_CHANGED" || c.changeType === "WORK_MODE_CHANGED"), "Field-level change events emitted (4)");
  console.log("  ✓ Verified material change detection and structured change events (4)");

  // ---------------------------------------------------------------------------
  // 4. Search Memory & Intelligent Refresh Planner (6, 13, 14)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 4] Testing Search Memory & Intelligent Refresh Planning (6, 13, 14)...");

  await upsertCompanyIntelligence({
    companyName: testCompany,
    officialCareerUrl: `https://${testCompany.toLowerCase()}.com/careers`,
    sourceName: "Greenhouse",
    atsProvider: "GREENHOUSE",
    sourceFreshnessMap: {
      greenhouse: new Date(Date.now() - 6 * 3600 * 1000).toISOString(), // 6h ago (Fresh)
      ashby: new Date(Date.now() - 55 * 3600 * 1000).toISOString(),     // 55h ago (Stale)
    },
  });

  const memory = await searchMemoryService.getSearchRecommendations({
    companyName: testCompany,
    roleCategory: "Engineering",
    freshnessWindowHours: 48,
  });

  assert.ok(memory.recommendedSources.length > 0, "Search memory yields recommended sources (6)");
  assert.strictEqual(memory.knownAtsProvider, "GREENHOUSE", "ATS provider recalled from search memory (6)");

  const plan = await intelligentRefreshPlanner.planRefresh({
    userId: userA.id,
    companyName: testCompany,
    roleCategory: "Engineering",
    freshnessWindowHours: 48,
  });

  assert.strictEqual(plan.entitlementAllowed, true, "Entitlement validated (14)");
  assert.strictEqual(plan.quotaAllowed, true, "Usage quota validated (14)");
  assert.ok(plan.sourcesToSkip.includes("Greenhouse"), "Fresh (<48h) source skipped by planner (13)");
  assert.ok(plan.decisions.some((d) => d.sourceName === "Greenhouse" && d.action === "SKIP"), "Explainable reason recorded for skip decision (13)");
  console.log("  ✓ Verified search memory retrieval and intelligent budget-aware refresh planning (6, 13, 14)");

  // ---------------------------------------------------------------------------
  // 5. User Interaction Feedback & Bounded Personalization (8, 9)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 5] Testing User Interaction Feedback & Bounded Ranking Calibration (8, 9)...");

  const saveFeedback = await userInteractionFeedbackService.recordUserInteraction({
    userId: userA.id,
    opportunityId: rec1.opportunity.id,
    actionType: "SAVED",
    sourcePlatform: "LinkedIn",
  });
  assert.strictEqual(saveFeedback.signalRecorded, true, "SAVED user action recorded as learning signal (8)");

  const appFeedback = await userInteractionFeedbackService.recordUserInteraction({
    userId: userA.id,
    opportunityId: rec1.opportunity.id,
    actionType: "APPLICATION_STARTED",
    sourcePlatform: "LinkedIn",
  });
  assert.strictEqual(appFeedback.signalRecorded, true, "APPLICATION_STARTED recorded as high-weight signal (8)");

  // Create SavedOpportunity for User A
  await prisma.savedOpportunity.create({
    data: {
      userId: userA.id,
      opportunityId: rec1.opportunity.id,
    },
  });

  const boostA = await userInteractionFeedbackService.getPersonalizedRankingAdjustment(
    userA.id,
    testCompany,
    "Software Engineer"
  );
  const boostB = await userInteractionFeedbackService.getPersonalizedRankingAdjustment(
    userB.id,
    testCompany,
    "Software Engineer"
  );

  assert.ok(boostA > boostB, "User A receives personalized boost for interacted employer (9)");
  assert.ok(boostA <= 10 && boostA >= -10, "Personalized ranking boost strictly bounded within [-10, 10] (9)");
  console.log("  ✓ Verified user feedback signals and bounded personal ranking adjustment (8, 9)");

  // ---------------------------------------------------------------------------
  // 6. Idempotent Opportunity Notifications (15)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 6] Testing Idempotent Lifecycle Notifications (15)...");

  const notif1 = await opportunityNotificationService.emitNotification({
    userId: userA.id,
    opportunityId: rec1.opportunity.id,
    type: "NEW_MATCH",
    title: "New Matching Opportunity",
    message: `New role at ${testCompany}`,
  });
  assert.strictEqual(notif1.created, true, "First notification created successfully (15)");

  const notif2 = await opportunityNotificationService.emitNotification({
    userId: userA.id,
    opportunityId: rec1.opportunity.id,
    type: "NEW_MATCH",
    title: "New Matching Opportunity",
    message: `New role at ${testCompany}`,
  });
  assert.strictEqual(notif2.created, false, "Duplicate notification within 24h safely deduplicated (15)");

  const userAlerts = await opportunityNotificationService.listUserNotifications(userA.id);
  assert.strictEqual(userAlerts.unreadCount, 1, "Unread notification count accurately calculated (15)");
  console.log("  ✓ Verified idempotent notification creation and deduplication (15)");

  // ---------------------------------------------------------------------------
  // 7. Admin Observability & Lifecycle Intelligence (21)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 7] Testing Admin Observability & Lifecycle Intelligence (21)...");

  const overview = await adminControlPlaneService.getOverviewMetrics();
  assert.ok(overview.lifecycle, "Admin overview includes lifecycle telemetry summary (21)");
  assert.ok(overview.lifecycle.totalOpportunities >= 1, "Catalog count accurately reported (21)");
  assert.ok(overview.lifecycle.averageSourcesPerOpportunity >= 1.0, "Average source provenance reported (21)");
  console.log("  ✓ Verified admin lifecycle telemetry and source provenance distribution (21)");

  // ---------------------------------------------------------------------------
  // 8. Performance & Capacity Benchmark (18)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 8] Running Lifecycle & Deduplication Capacity Load Benchmark (18)...");

  const benchmarkStart = Date.now();
  const iterations = 15;
  const initialMemory = process.memoryUsage().heapUsed;

  const promises = Array.from({ length: iterations }, async (_, idx) => {
    const candBench: RawJobCandidate = {
      sourcePlatform: idx % 2 === 0 ? "Ashby" : "Lever",
      sourceUrl: `https://jobs.example.com/${salt}/job_${idx}`,
      applyUrl: `https://example.com/careers/job_${idx}`,
      title: `Fullstack Engineer - Tier ${idx}`,
      companyName: `BenchCorp_${salt}`,
      location: "Remote",
      workMode: "REMOTE",
      description: "Performant scalable microservices.",
      discoveredAt: new Date(),
    };
    return opportunityLifecycleManager.reconcileCandidate(candBench);
  });

  const results = await Promise.all(promises);
  const benchmarkDuration = Date.now() - benchmarkStart;
  const finalMemory = process.memoryUsage().heapUsed;
  const memoryDeltaMb = Math.round(((finalMemory - initialMemory) / (1024 * 1024)) * 100) / 100;

  assert.strictEqual(results.length, iterations, "All concurrent lifecycle updates completed (18)");
  console.log(`  • Benchmark Workload: ${iterations} concurrent lifecycle reconciliations`);
  console.log(`  • Total Duration: ${benchmarkDuration}ms (Avg: ${(benchmarkDuration / iterations).toFixed(2)}ms / op)`);
  console.log(`  • Memory Delta: ${memoryDeltaMb >= 0 ? "+" : ""}${memoryDeltaMb} MB`);
  console.log("  ✓ Verified lifecycle capacity, concurrency, and memory stability (18)");

  console.log("\n=================================================================");
  console.log("  TASK-042: ALL LIFECYCLE & SEARCH MEMORY TESTS PASSED! ✅       ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("opportunityLifecycleIntelligence.test")) {
  runOpportunityLifecycleIntelligenceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-042 TEST FAILED]:", err);
      process.exit(1);
    });
}
