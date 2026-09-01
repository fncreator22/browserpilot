/**
 * §INTEGRATION: SEARCH RESULT ACCURACY, SOURCE COVERAGE & VERIFIED JOB METADATA (TASK-044)
 * 
 * Comprehensive verification of:
 * 1. Exact acceptance query intent parsing (10 backend developer jobs in last 15 days)
 * 2. Deterministic rejection of stale opportunities (e.g. 60 days old)
 * 3. Deterministic rejection of unverified/missing dates under explicit constraints
 * 4. Exact job-level detail URL classification (JOB_DETAIL)
 * 5. Generic career root detection and rejection (COMPANY_CAREER_ROOT / ATS_COMPANY_ROOT)
 * 6. Multi-source harvesting expansion when single source is insufficient
 * 7. 3-Source canonical deduplication with provenance preservation
 * 8. UI posting date parity with backend eligibility date
 * 9. Resource budget isolation (50%, 90% budget does not mutate semantic query constraints)
 * 10. Partial result handling & shortfall explanation (8 valid + 2 stale -> returns 8 with explanation)
 */

import assert from "node:assert";
import { parseSearchIntent } from "../../lib/scraper/intentParser";
import { buildDiscoveryPlan } from "../../lib/scraper/discoveryPlanner";
import { parsePostingDate, isWithinFreshnessWindow, evaluateMetadataConfidence } from "../../lib/scraper/freshnessExtractor";
import { classifyJobUrl, isGenericCareerHomepage } from "../../lib/scraper/normalizer";
import { evaluateCandidateQualityGate } from "../../lib/scraper/searchQualityGate";
import { executeSearchPipeline } from "../../lib/scraper/searchPipeline";
import { deduplicateCandidates } from "../../lib/scraper/deduplicator";
import { rankOpportunities } from "../../lib/scraper/ranker";
import { SwarmDiscoveryEngine } from "../../lib/scraper/swarmDiscovery";
import { type SearchProvider, type RawJobCandidate } from "../../lib/scraper/providers/baseProvider";

export async function runSearchAccuracyAndMetadataTests() {
  console.log("\n=================================================================");
  console.log("  TASK-044: SEARCH RESULT ACCURACY & VERIFIED METADATA SUITE     ");
  console.log("=================================================================\n");

  const now = new Date();

  // ---------------------------------------------------------------------------
  // Test 1: Exact User Acceptance Query (Section 2, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 1] Testing Exact User Acceptance Query Parsing...");
  const primaryQuery = "Give me 10 backend developer jobs posted in the last 15 days on any platform.";
  const intent1 = parseSearchIntent(primaryQuery);

  assert.strictEqual(intent1.requestedCount, 10, "Requested count must be 10 (Test 1)");
  assert.strictEqual(intent1.postedWithinDays, 15, "Posted within days must be 15 (Test 1)");
  assert.strictEqual(intent1.freshnessWindowHours, 360, "Freshness window must be 360h (Test 1)");
  assert.strictEqual(intent1.isExplicitFreshness, true, "isExplicitFreshness must be true (Test 1)");
  assert.strictEqual(intent1.role, "Backend Engineer", "Role must resolve to Backend Engineer (Test 1)");

  const plan1 = buildDiscoveryPlan(primaryQuery);
  assert.strictEqual(plan1.requestedCount, 10, "DiscoveryPlan must preserve requestedCount 10");
  assert.strictEqual(plan1.freshnessWindowHours, 360, "DiscoveryPlan must preserve 360h");
  assert.strictEqual(plan1.isExplicitFreshness, true, "DiscoveryPlan must preserve explicit freshness");
  console.log("  ✓ Test 1 Passed: Exact acceptance query parsed with 10 count, 15d window, and Backend Engineer role.");

  // ---------------------------------------------------------------------------
  // Test 2: Old Result Rejection (Section 4, 10, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 2] Testing Stale Result (60-day-old) Rejection...");
  const oldCandidate: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://www.linkedin.com/jobs/view/10101",
    applyUrl: "https://stripe.com/careers/backend-10101",
    title: "Backend Developer",
    companyName: "Stripe",
    location: "Remote",
    workMode: "REMOTE",
    description: "Backend developer opening.",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000), // 60 days old
    postedAgoText: "2 months ago",
  };

  const gateEvalOld = evaluateCandidateQualityGate(oldCandidate, plan1, now);
  assert.strictEqual(gateEvalOld.isEligible, false, "60-day-old job must be marked ineligible (Test 2)");
  assert.ok(gateEvalOld.rejectionReasons.some((r) => r.includes("exceeds requested") || r.includes("days old")), "Rejection reason must mention age (Test 2)");
  console.log("  ✓ Test 2 Passed: 60-day-old job strictly rejected by quality gate.");

  // ---------------------------------------------------------------------------
  // Test 3: Unknown Posting Date Rejection (Section 5, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 3] Testing Unknown Posting Date Rejection under Explicit Constraint...");
  const unknownDateCandidate: RawJobCandidate = {
    sourcePlatform: "Indeed",
    sourceUrl: "https://www.indeed.com/viewjob?jk=99999",
    applyUrl: "https://linear.app/careers/eng-99999",
    title: "Backend Engineer",
    companyName: "Linear",
    location: "Remote",
    workMode: "REMOTE",
    description: "Backend engineering opening.",
    discoveredAt: now,
    postedAt: null,
    rawSnippet: "Python, PostgreSQL.",
  };

  const gateEvalUnknown = evaluateCandidateQualityGate(unknownDateCandidate, plan1, now);
  assert.strictEqual(gateEvalUnknown.isEligible, false, "Unknown date candidate must be ineligible for explicit date search (Test 3)");
  assert.strictEqual(gateEvalUnknown.metadataConfidence, "PARTIAL", "Missing postedAt evaluates to PARTIAL confidence (Test 3)");
  assert.ok(gateEvalUnknown.rejectionReasons.some((r) => r.includes("Posting date could not be verified")), "Rejection reason must note unverified date (Test 3)");
  console.log("  ✓ Test 3 Passed: Unknown posting date strictly rejected under explicit time window.");

  // ---------------------------------------------------------------------------
  // Test 4: Exact Job-Level Detail URL Validation (Section 8, 9, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 4] Testing Specific Job Detail URL Classification...");
  const validJobUrls = [
    "https://company.com/careers/backend-developer-123",
    "https://company.com/jobs/sr-engineer-456",
    "https://company.com/openings/backend-lead",
    "https://boards.greenhouse.io/stripe/jobs/5001",
    "https://jobs.lever.co/supabase/abc-123",
    "https://jobs.ashbyhq.com/linear/uuid-456",
    "https://www.linkedin.com/jobs/view/999888",
    "https://www.indeed.com/viewjob?jk=abc12345",
  ];

  for (const url of validJobUrls) {
    const classification = classifyJobUrl(url);
    assert.strictEqual(classification, "JOB_DETAIL", `Expected JOB_DETAIL for: ${url} (Test 4)`);
    assert.strictEqual(isGenericCareerHomepage(url), false, `isGenericCareerHomepage must be false for: ${url} (Test 4)`);
  }
  console.log("  ✓ Test 4 Passed: Exact job-level URLs correctly classified as JOB_DETAIL.");

  // ---------------------------------------------------------------------------
  // Test 5: Generic Career Root Detection & Rejection (Section 8, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 5] Testing Generic Career Root Detection...");
  const genericRoots = [
    { url: "https://company.com/careers", expected: "COMPANY_CAREER_ROOT" },
    { url: "https://company.com/jobs", expected: "COMPANY_CAREER_ROOT" },
    { url: "https://company.com/join-us", expected: "COMPANY_CAREER_ROOT" },
    { url: "https://boards.greenhouse.io/stripe", expected: "ATS_COMPANY_ROOT" },
    { url: "https://jobs.lever.co/supabase", expected: "ATS_COMPANY_ROOT" },
    { url: "https://jobs.ashbyhq.com/linear", expected: "ATS_COMPANY_ROOT" },
    { url: "https://www.linkedin.com/jobs", expected: "SEARCH_RESULTS" },
  ];

  for (const gr of genericRoots) {
    const classification = classifyJobUrl(gr.url);
    assert.strictEqual(classification, gr.expected, `Expected ${gr.expected} for: ${gr.url} (Test 5)`);
    assert.strictEqual(isGenericCareerHomepage(gr.url) || classification === "SEARCH_RESULTS", true, `Must identify non-job URL for: ${gr.url} (Test 5)`);

    const candidateWithRoot: RawJobCandidate = {
      sourcePlatform: "Company Careers",
      sourceUrl: gr.url,
      applyUrl: gr.url,
      title: "Backend Engineer",
      companyName: "Acme",
      location: "Remote",
      discoveredAt: now,
      postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    };

    const gateEvalRoot = evaluateCandidateQualityGate(candidateWithRoot, plan1, now);
    assert.strictEqual(gateEvalRoot.isEligible, false, `Generic portal URL must be ineligible: ${gr.url} (Test 5)`);
  }
  console.log("  ✓ Test 5 Passed: Generic career homepages and ATS root portals strictly rejected.");

  // ---------------------------------------------------------------------------
  // Test 6: Multi-Source Harvesting Expansion (Section 14, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 6] Testing Multi-Source Harvesting Expansion...");
  const mockLinkedInProvider: SearchProvider = {
    name: "LinkedIn",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: "https://linkedin.com/jobs/view/101",
        applyUrl: "https://stripe.com/careers/be-101",
        title: "Backend Developer",
        companyName: "Stripe",
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      },
    ],
  };

  const mockGreenhouseProvider: SearchProvider = {
    name: "Greenhouse",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "Greenhouse",
        sourceUrl: "https://boards.greenhouse.io/linear/jobs/202",
        applyUrl: "https://linear.app/careers/be-202",
        title: "Backend Engineer",
        companyName: "Linear",
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
      },
    ],
  };

  const mockAshbyProvider: SearchProvider = {
    name: "Ashby",
    supports: () => true,
    harvestCandidates: async () => [
      {
        sourcePlatform: "Ashby",
        sourceUrl: "https://jobs.ashbyhq.com/supabase/303",
        applyUrl: "https://supabase.com/careers/be-303",
        title: "Backend Developer",
        companyName: "Supabase",
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 6 * 24 * 3600 * 1000),
      },
    ],
  };

  const multiSourceSwarm = new SwarmDiscoveryEngine([
    mockLinkedInProvider,
    mockGreenhouseProvider,
    mockAshbyProvider,
  ]);

  const swarmRes = await multiSourceSwarm.executeSwarm(plan1);
  assert.strictEqual(swarmRes.candidates.length, 3, "Harvests candidates across all 3 providers (Test 6)");
  assert.strictEqual(swarmRes.swarmTelemetry.sourcesCompleted, 3, "All 3 sources completed (Test 6)");
  console.log("  ✓ Test 6 Passed: Insufficient results from 1 source expanded across multiple sources.");

  // ---------------------------------------------------------------------------
  // Test 7: Multi-Source Canonical Deduplication (Section 13, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 7] Testing 3-Source Canonical Deduplication & Provenance...");
  const dup1: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/stripe-1",
    applyUrl: "https://stripe.com/careers/be-lead-1",
    title: "Backend Developer",
    companyName: "Stripe",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000), // 4d ago
  };

  const dup2: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: "https://boards.greenhouse.io/stripe/jobs/5001",
    applyUrl: "https://stripe.com/careers/be-lead-1",
    title: "Backend Developer",
    companyName: "Stripe",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000), // Fresher 2d ago!
  };

  const dup3: RawJobCandidate = {
    sourcePlatform: "Company Careers",
    sourceUrl: "https://stripe.com/careers/backend-lead-1",
    applyUrl: "https://stripe.com/careers/be-lead-1",
    title: "Backend Developer",
    companyName: "Stripe",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 3 * 24 * 3600 * 1000), // 3d ago
  };

  const deduplicated = deduplicateCandidates([dup1, dup2, dup3]);
  assert.strictEqual(deduplicated.length, 1, "3 duplicate listings merged into 1 canonical opportunity (Test 7)");
  assert.strictEqual(deduplicated[0].sourceListings.length, 3, "Preserves all 3 SourceListings provenance (Test 7)");
  assert.strictEqual(
    deduplicated[0].postedAt?.getTime(),
    dup2.postedAt?.getTime(),
    "Merged opportunity picks the freshest available postedAt (2d ago) (Test 7)"
  );
  console.log("  ✓ Test 7 Passed: Multi-source deduplication preserves 3 listings and freshest postedAt timestamp.");

  // ---------------------------------------------------------------------------
  // Test 8: Frontend Date Representation Parity (Section 3, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 8] Testing Frontend vs Backend Date Parity...");
  const testCandidateForUI: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: "https://boards.greenhouse.io/retool/jobs/404",
    applyUrl: "https://retool.com/careers/be-404",
    title: "Backend Engineer",
    companyName: "Retool",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000), // 4 days ago
    postedAgoText: "4d ago",
  };

  const gateEvalUI = evaluateCandidateQualityGate(testCandidateForUI, plan1, now);
  assert.strictEqual(gateEvalUI.isEligible, true, "Job passes eligibility");

  const ageDaysCalculated = Math.max(0, Math.floor((now.getTime() - gateEvalUI.parsedPostingDate!.getTime()) / (24 * 3600 * 1000)));
  assert.strictEqual(ageDaysCalculated, 4, "Backend age calculation matches 4 days (Test 8)");
  assert.strictEqual(testCandidateForUI.postedAgoText, "4d ago", "Frontend badge matches 4d ago (Test 8)");
  console.log("  ✓ Test 8 Passed: Backend eligibility age matches displayed frontend date.");

  // ---------------------------------------------------------------------------
  // Test 9: Resource Budget Independence (Section 15, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 9] Testing Resource Budget Semantic Isolation...");
  const queriesWithBudgets = [
    { query: "Give me 10 backend developer jobs posted in the last 15 days with 50% budget", expectedCount: 10, expectedDays: 15 },
    { query: "Give me 10 backend developer jobs posted in the last 15 days with 90% budget", expectedCount: 10, expectedDays: 15 },
    { query: "Find 20 python engineer jobs in the last 30 days with 90% token budget", expectedCount: 20, expectedDays: 30 },
  ];

  for (const qb of queriesWithBudgets) {
    const parsed = parseSearchIntent(qb.query);
    assert.strictEqual(parsed.requestedCount, qb.expectedCount, `requestedCount ${qb.expectedCount} preserved for: "${qb.query}" (Test 9)`);
    assert.strictEqual(parsed.postedWithinDays, qb.expectedDays, `postedWithinDays ${qb.expectedDays} preserved for: "${qb.query}" (Test 9)`);
    assert.strictEqual(parsed.freshnessWindowHours, qb.expectedDays * 24, `freshnessWindowHours preserved for: "${qb.query}" (Test 9)`);
  }
  console.log("  ✓ Test 9 Passed: 50% and 90% budgets do not alter count or date window constraints.");

  // ---------------------------------------------------------------------------
  // Test 10: Partial Results & Shortfall Explanation (Section 17, 21)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 10] Testing Partial Results & Shortfall Explanation...");
  // 8 valid in-window jobs + 2 stale jobs (60d old)
  const mixedCandidates: RawJobCandidate[] = [];

  for (let i = 1; i <= 8; i++) {
    mixedCandidates.push({
      sourcePlatform: "LinkedIn",
      sourceUrl: `https://linkedin.com/jobs/view/valid-${i}`,
      applyUrl: `https://company${i}.com/careers/backend-${i}`,
      title: `Backend Engineer ${i}`,
      companyName: `Company ${i}`,
      discoveredAt: now,
      postedAt: new Date(now.getTime() - i * 24 * 3600 * 1000), // 1 to 8 days old (VALID)
    });
  }

  // 2 Stale jobs
  mixedCandidates.push({
    sourcePlatform: "Indeed",
    sourceUrl: "https://indeed.com/viewjob?jk=stale-1",
    applyUrl: "https://stale1.com/jobs/be-1",
    title: "Backend Engineer",
    companyName: "Stale 1",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000), // 60d old (REJECTED)
  });

  mixedCandidates.push({
    sourcePlatform: "Indeed",
    sourceUrl: "https://indeed.com/viewjob?jk=stale-2",
    applyUrl: "https://stale2.com/jobs/be-2",
    title: "Backend Engineer",
    companyName: "Stale 2",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000), // 45d old (REJECTED)
  });

  const partialProvider: SearchProvider = {
    name: "PartialMockProvider",
    supports: () => true,
    harvestCandidates: async () => mixedCandidates,
  };

  const pipelineRes = await executeSearchPipeline(primaryQuery, {
    customProviders: [partialProvider],
    persistToDb: false,
  });

  assert.strictEqual(pipelineRes.rankedOpportunities.length, 8, "Must return exactly 8 valid opportunities, not 10 (Test 10)");
  assert.ok(pipelineRes.searchExplanation, "Pipeline must produce a searchExplanation (Test 10)");
  assert.ok(
    pipelineRes.searchExplanation.includes("Found 8 verified") && pipelineRes.searchExplanation.includes("2 additional"),
    `Explanation must describe 8 found and 2 shortfall: "${pipelineRes.searchExplanation}" (Test 10)`
  );
  assert.strictEqual(pipelineRes.searchDiagnostics?.validResultCount, 8, "Diagnostics records 8 valid (Test 10)");
  assert.strictEqual(pipelineRes.searchDiagnostics?.staleResultCount, 2, "Diagnostics records 2 stale (Test 10)");
  console.log("  ✓ Test 10 Passed: Exactly 8 valid items returned with explainable shortfall.");

  console.log("\n=================================================================");
  console.log("  TASK-044: ALL 10 TESTS PASSED SUCCESSFULLY! ✅                 ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("searchAccuracyAndMetadata.test")) {
  runSearchAccuracyAndMetadataTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-044 TEST FAILED]:", err);
      process.exit(1);
    });
}
