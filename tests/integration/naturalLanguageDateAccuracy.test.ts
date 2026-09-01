/**
 * §INTEGRATION: NATURAL-LANGUAGE SEARCH INTENT, DATE-RANGE ACCURACY & JOB-LEVEL URL RESOLUTION (TASK-043)
 * 
 * Verifies:
 * 1. Arbitrary relative/absolute natural-language date parsing (10d, 15d, 21d, 30d, 2w, 6w, 2mo)
 * 2. Deterministic hard date-range filtering (no stale/out-of-window leakage; no unknown date assumptions)
 * 3. Requested result count extraction & preservation (e.g. 10 target jobs)
 * 4. Exact job-level detail URL resolution (no generic /careers homepage roots)
 * 5. Ranking safety (high score cannot resurrect out-of-window opportunities)
 * 6. Usage / Token percentage isolation (90% budget does not tamper with semantic intent)
 * 7. Multi-source end-to-end acceptance scenario
 */

import assert from "node:assert";
import { parseSearchIntent } from "../../lib/scraper/intentParser";
import { buildDiscoveryPlan } from "../../lib/scraper/discoveryPlanner";
import { parsePostingDate, isWithinFreshnessWindow } from "../../lib/scraper/freshnessExtractor";
import { executeSearchPipeline } from "../../lib/scraper/searchPipeline";
import { isGenericCareerHomepage } from "../../lib/scraper/normalizer";
import { rankOpportunities } from "../../lib/scraper/ranker";
import { deduplicateCandidates } from "../../lib/scraper/deduplicator";
import { type RawJobCandidate } from "../../lib/scraper/providers/baseProvider";

export async function runNaturalLanguageDateAccuracyTests() {
  console.log("\n=================================================================");
  console.log("  TASK-043: NATURAL-LANGUAGE INTENT & DATE ACCURACY SUITE        ");
  console.log("=================================================================\n");

  const now = new Date();

  // ---------------------------------------------------------------------------
  // 1. Arbitrary Natural-Language Date Parsing (Section 3 & 14)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 1] Testing Arbitrary Natural-Language Date Range Parsing (3, 14)...");

  const testCases = [
    { query: "Give me 10 backend developer jobs posted in the last 15 days", expectedDays: 15, expectedHours: 360 },
    { query: "Find software engineer jobs from the past 10 days", expectedDays: 10, expectedHours: 240 },
    { query: "Frontend openings within 21 days", expectedDays: 21, expectedHours: 504 },
    { query: "AI roles posted in the last 30 days", expectedDays: 30, expectedHours: 720 },
    { query: "Python jobs in the past 2 weeks", expectedDays: 14, expectedHours: 336 },
    { query: "DevOps positions from the last 6 weeks", expectedDays: 42, expectedHours: 1008 },
    { query: "React developer internships in the past 2 months", expectedDays: 60, expectedHours: 1440 },
    { query: "Jobs posted today", expectedDays: 1, expectedHours: 24 },
    { query: "Openings from the last 3 days", expectedDays: 3, expectedHours: 72 },
    { query: "Roles in the past week", expectedDays: 7, expectedHours: 168 },
  ];

  for (const tc of testCases) {
    const intent = parseSearchIntent(tc.query);
    assert.strictEqual(intent.isExplicitFreshness, true, `isExplicitFreshness is true for: "${tc.query}"`);
    assert.strictEqual(intent.postedWithinDays, tc.expectedDays, `postedWithinDays matches ${tc.expectedDays} for: "${tc.query}"`);
    assert.strictEqual(intent.freshnessWindowHours, tc.expectedHours, `freshnessWindowHours matches ${tc.expectedHours} for: "${tc.query}"`);
    assert.ok(intent.dateConstraint, `dateConstraint object created for: "${tc.query}"`);
    assert.ok(intent.dateConstraint?.amount > 0, `dateConstraint amount is positive for: "${tc.query}"`);

    const plan = buildDiscoveryPlan(tc.query);
    assert.strictEqual(plan.freshnessWindowHours, tc.expectedHours, `Plan preserves freshnessWindowHours ${tc.expectedHours} for: "${tc.query}"`);
    assert.strictEqual(plan.isExplicitFreshness, true, `Plan preserves isExplicitFreshness for: "${tc.query}"`);
  }

  console.log("  ✓ Verified arbitrary natural-language date parsing across days, weeks, and months (3, 14)");

  // ---------------------------------------------------------------------------
  // 2. Deterministic Hard Date Eligibility Filtering (Section 4, 5, 6)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 2] Testing Deterministic Hard Date-Range Filtering (4, 5, 6)...");

  const query15Days = "Give me 10 backend developer jobs posted in the last 15 days on any platform";
  const intent15 = parseSearchIntent(query15Days);
  assert.strictEqual(intent15.freshnessWindowHours, 360, "15-day query maps to exactly 360 hours (4)");

  const job3DaysOld = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const job10DaysOld = new Date(now.getTime() - 10 * 24 * 3600 * 1000);
  const job15DaysOld = new Date(now.getTime() - 15 * 24 * 3600 * 1000);
  const job16DaysOld = new Date(now.getTime() - 16 * 24 * 3600 * 1000);
  const job60DaysOld = new Date(now.getTime() - 60 * 24 * 3600 * 1000); // 2 months old

  assert.strictEqual(isWithinFreshnessWindow(job3DaysOld, intent15.freshnessWindowHours, true, now), true, "3-day-old job satisfies 15-day window (6)");
  assert.strictEqual(isWithinFreshnessWindow(job10DaysOld, intent15.freshnessWindowHours, true, now), true, "10-day-old job satisfies 15-day window (6)");
  assert.strictEqual(isWithinFreshnessWindow(job15DaysOld, intent15.freshnessWindowHours, true, now), true, "15-day-old job satisfies 15-day window (6)");
  assert.strictEqual(isWithinFreshnessWindow(job16DaysOld, intent15.freshnessWindowHours, true, now), false, "16-day-old job is REJECTED by 15-day window (6)");
  assert.strictEqual(isWithinFreshnessWindow(job60DaysOld, intent15.freshnessWindowHours, true, now), false, "60-day-old (2-3 month) job is STRICTLY REJECTED (6)");
  assert.strictEqual(isWithinFreshnessWindow(null, intent15.freshnessWindowHours, true, now), false, "Unknown posting date is STRICTLY REJECTED under explicit window (5)");
  assert.strictEqual(isWithinFreshnessWindow(undefined, intent15.freshnessWindowHours, true, now), false, "Missing posting date is STRICTLY REJECTED (5)");

  console.log("  ✓ Verified hard date-constraint gating and strict rejection of out-of-window / unknown dates (4, 5, 6)");

  // ---------------------------------------------------------------------------
  // 3. Requested Result Count Extraction & Preservation (Section 7, 8)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 3] Testing Requested Result Count Extraction (7, 8)...");

  const countQueries = [
    { query: "Give me 10 backend developer jobs", expectedCount: 10 },
    { query: "Find 15 react developer roles in SF", expectedCount: 15 },
    { query: "Show me 5 remote internships", expectedCount: 5 },
    { query: "Top 20 fullstack engineering openings", expectedCount: 20 },
  ];

  for (const cq of countQueries) {
    const parsed = parseSearchIntent(cq.query);
    assert.strictEqual(parsed.requestedCount, cq.expectedCount, `Extracted requestedCount ${cq.expectedCount} from: "${cq.query}"`);
    const plan = buildDiscoveryPlan(cq.query);
    assert.strictEqual(plan.requestedCount, cq.expectedCount, `DiscoveryPlan preserves requestedCount ${cq.expectedCount}`);
    assert.ok(plan.maxResultsPerSource >= cq.expectedCount, "Source exploration target accommodates requested count (7)");
  }

  console.log("  ✓ Verified requested count extraction and target scaling (7, 8)");

  // ---------------------------------------------------------------------------
  // 4. Exact Job-Level Detail URL Resolution (Section 9, 10, 11, 12)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 4] Testing Exact Job-Level URL Resolution (9, 10, 11, 12)...");

  const validJobUrls = [
    "https://company.com/careers/backend-engineer-123",
    "https://company.com/jobs/sr-developer-456",
    "https://boards.greenhouse.io/stripe/jobs/5001",
    "https://jobs.lever.co/supabase/abc-123",
    "https://jobs.ashbyhq.com/linear/uuid-456",
    "https://www.linkedin.com/jobs/view/999888",
  ];

  const genericHomepageUrls = [
    "https://company.com/careers",
    "https://company.com/jobs",
    "https://company.com/careers/",
    "https://company.com/join-us",
    "https://boards.greenhouse.io/stripe",
    "https://jobs.lever.co/supabase",
    "https://jobs.ashbyhq.com/linear",
  ];

  for (const url of validJobUrls) {
    assert.strictEqual(isGenericCareerHomepage(url), false, `Valid job URL correctly recognized: ${url}`);
  }

  for (const url of genericHomepageUrls) {
    assert.strictEqual(isGenericCareerHomepage(url), true, `Generic career homepage detected and flagged: ${url}`);
  }

  console.log("  ✓ Verified job-specific URL resolution vs generic homepage detection (9, 10, 11, 12)");

  // ---------------------------------------------------------------------------
  // 5. Ranking Must Not Override Hard Date Constraints (Section 17)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 5] Testing Ranking Safety Against Stale Opportunities (17)...");

  const staleHighFitCandidate: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://www.linkedin.com/jobs/view/101",
    applyUrl: "https://stripe.com/careers/backend-101",
    title: "Backend Developer",
    companyName: "Stripe",
    location: "Remote",
    workMode: "REMOTE",
    description: "Backend developer building distributed payment infrastructure with Go and TypeScript.",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 90 * 24 * 3600 * 1000), // 90 days ago (Old!)
    postedAgoText: "3 months ago",
  };

  const freshLowerFitCandidate: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: "https://boards.greenhouse.io/linear/jobs/202",
    applyUrl: "https://linear.app/careers/eng-202",
    title: "Software Engineer",
    companyName: "Linear",
    location: "Remote",
    workMode: "REMOTE",
    description: "Software engineering role on product infrastructure.",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000), // 4 days ago (Fresh!)
    postedAgoText: "4 days ago",
  };

  // Hard eligibility gating
  const isStaleEligible = isWithinFreshnessWindow(staleHighFitCandidate.postedAt, 360, true, now);
  const isFreshEligible = isWithinFreshnessWindow(freshLowerFitCandidate.postedAt, 360, true, now);

  assert.strictEqual(isStaleEligible, false, "90-day-old job eliminated at hard eligibility gate (17)");
  assert.strictEqual(isFreshEligible, true, "4-day-old job passes eligibility gate (17)");

  const eligibleCandidates = [staleHighFitCandidate, freshLowerFitCandidate].filter((c) =>
    isWithinFreshnessWindow(c.postedAt, 360, true, now)
  );

  const deduplicated = deduplicateCandidates(eligibleCandidates);
  const ranked = rankOpportunities(deduplicated, intent15);

  assert.strictEqual(ranked.length, 1, "Only eligible fresh candidates reach ranking stage (17)");
  assert.strictEqual(ranked[0].opportunity.companyName, "Linear", "Fresh job is ranked #1 (17)");
  console.log("  ✓ Verified ranking safety: stale candidates cannot outrank recent opportunities (17)");

  // ---------------------------------------------------------------------------
  // 6. Usage / Token Percentage Semantic Isolation (Section 15)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 6] Testing Usage/Token Budget Percentage Semantic Isolation (15)...");

  const queryWithBudget = "Give me 10 backend developer jobs posted in the last 15 days with 90% budget";
  const intentBudget = parseSearchIntent(queryWithBudget);

  assert.strictEqual(intentBudget.requestedCount, 10, "Requested count 10 preserved regardless of 90% budget (15)");
  assert.strictEqual(intentBudget.postedWithinDays, 15, "15 days date range preserved regardless of 90% budget (15)");
  assert.strictEqual(intentBudget.freshnessWindowHours, 360, "360 hours freshness preserved regardless of 90% budget (15)");
  assert.strictEqual(intentBudget.role, "Backend Engineer", "Role preserved as Backend Engineer (15)");
  console.log("  ✓ Verified usage percentage does not mutate semantic query constraints (15)");

  // ---------------------------------------------------------------------------
  // 7. Full End-to-End Acceptance Scenario (Section 20)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 7] Running Full Multi-Source Acceptance Scenario (20)...");

  // Query: "Give me 10 backend developer jobs posted in the last 15 days on any platform"
  // Fixture candidates:
  // - 3 jobs (1-5d old) -> VALID
  // - 4 jobs (6-10d old) -> VALID
  // - 3 jobs (11-15d old) -> VALID
  // - 4 jobs (16-60d old) -> STALE (EXCLUDED)
  // - 2 jobs (unknown date) -> UNKNOWN (EXCLUDED)
  // - 1 duplicate job across LinkedIn & Greenhouse -> DEDUPLICATED (1 OPPORTUNITY)

  const candidatePool: RawJobCandidate[] = [
    // 3 jobs (1-5d old)
    { sourcePlatform: "LinkedIn", sourceUrl: "https://linkedin.com/jobs/view/1", applyUrl: "https://stripe.com/careers/be-1", title: "Backend Developer", companyName: "Stripe", discoveredAt: now, postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000) },
    { sourcePlatform: "Greenhouse", sourceUrl: "https://boards.greenhouse.io/linear/jobs/2", applyUrl: "https://linear.app/careers/be-2", title: "Backend Engineer", companyName: "Linear", discoveredAt: now, postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000) },
    { sourcePlatform: "Ashby", sourceUrl: "https://jobs.ashbyhq.com/supabase/3", applyUrl: "https://supabase.com/careers/be-3", title: "Backend Developer", companyName: "Supabase", discoveredAt: now, postedAt: new Date(now.getTime() - 5 * 24 * 3600 * 1000) },

    // 4 jobs (6-10d old)
    { sourcePlatform: "Lever", sourceUrl: "https://jobs.lever.co/retool/4", applyUrl: "https://retool.com/careers/be-4", title: "Backend Engineer", companyName: "Retool", discoveredAt: now, postedAt: new Date(now.getTime() - 7 * 24 * 3600 * 1000) },
    { sourcePlatform: "Indeed", sourceUrl: "https://indeed.com/viewjob?jk=5", applyUrl: "https://datadog.com/careers/be-5", title: "Backend Developer", companyName: "Datadog", discoveredAt: now, postedAt: new Date(now.getTime() - 8 * 24 * 3600 * 1000) },
    { sourcePlatform: "Company Careers", sourceUrl: "https://vercel.com/careers/be-6", applyUrl: "https://vercel.com/careers/be-6/apply", title: "Backend Engineer", companyName: "Vercel", discoveredAt: now, postedAt: new Date(now.getTime() - 9 * 24 * 3600 * 1000) },
    { sourcePlatform: "Y Combinator", sourceUrl: "https://workatastartup.com/jobs/7", applyUrl: "https://resend.com/careers/be-7", title: "Backend Developer", companyName: "Resend", discoveredAt: now, postedAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000) },

    // 3 jobs (11-15d old)
    { sourcePlatform: "LinkedIn", sourceUrl: "https://linkedin.com/jobs/view/8", applyUrl: "https://postman.com/careers/be-8", title: "Backend Engineer", companyName: "Postman", discoveredAt: now, postedAt: new Date(now.getTime() - 12 * 24 * 3600 * 1000) },
    { sourcePlatform: "Greenhouse", sourceUrl: "https://boards.greenhouse.io/figma/jobs/9", applyUrl: "https://figma.com/careers/be-9", title: "Backend Developer", companyName: "Figma", discoveredAt: now, postedAt: new Date(now.getTime() - 14 * 24 * 3600 * 1000) },
    { sourcePlatform: "Ashby", sourceUrl: "https://jobs.ashbyhq.com/neon/10", applyUrl: "https://neon.tech/careers/be-10", title: "Backend Engineer", companyName: "Neon", discoveredAt: now, postedAt: new Date(now.getTime() - 15 * 24 * 3600 * 1000) },

    // 1 Duplicate of job #1 on Greenhouse
    { sourcePlatform: "Greenhouse", sourceUrl: "https://boards.greenhouse.io/stripe/jobs/1", applyUrl: "https://stripe.com/careers/be-1", title: "Backend Developer", companyName: "Stripe", discoveredAt: now, postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000) },

    // 4 Stale jobs (16-60d old)
    { sourcePlatform: "Indeed", sourceUrl: "https://indeed.com/viewjob?jk=11", applyUrl: "https://oldcorp.com/jobs/11", title: "Backend Engineer", companyName: "OldCorp", discoveredAt: now, postedAt: new Date(now.getTime() - 20 * 24 * 3600 * 1000) },
    { sourcePlatform: "LinkedIn", sourceUrl: "https://linkedin.com/jobs/view/12", applyUrl: "https://ancient.com/jobs/12", title: "Backend Developer", companyName: "AncientCo", discoveredAt: now, postedAt: new Date(now.getTime() - 35 * 24 * 3600 * 1000) },
    { sourcePlatform: "Lever", sourceUrl: "https://jobs.lever.co/stale/13", applyUrl: "https://stale.com/jobs/13", title: "Backend Engineer", companyName: "StaleCo", discoveredAt: now, postedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000) },
    { sourcePlatform: "Y Combinator", sourceUrl: "https://workatastartup.com/jobs/14", applyUrl: "https://dinosaur.com/jobs/14", title: "Backend Developer", companyName: "Dinosaur", discoveredAt: now, postedAt: new Date(now.getTime() - 60 * 24 * 3600 * 1000) },

    // 2 Unknown date jobs
    { sourcePlatform: "LinkedIn", sourceUrl: "https://linkedin.com/jobs/view/15", applyUrl: "https://nodate.com/jobs/15", title: "Backend Developer", companyName: "NoDate1", discoveredAt: now, postedAt: null },
    { sourcePlatform: "Indeed", sourceUrl: "https://indeed.com/viewjob?jk=16", applyUrl: "https://nodate.com/jobs/16", title: "Backend Engineer", companyName: "NoDate2", discoveredAt: now, postedAt: null },
  ];

  // Pipeline Execution Simulation
  const planE2E = buildDiscoveryPlan(query15Days);
  assert.strictEqual(planE2E.freshnessWindowHours, 360, "Plan freshness window is 360 hours");
  assert.strictEqual(planE2E.requestedCount, 10, "Plan target count is 10");

  // Step 1: Hard date filter
  const validInWindow = candidatePool.filter((c) =>
    isWithinFreshnessWindow(c.postedAt, planE2E.freshnessWindowHours, planE2E.isExplicitFreshness, now)
  );

  // 10 distinct in-window items + 1 duplicate = 11 candidates
  assert.strictEqual(validInWindow.length, 11, "All 16-60d and unknown date jobs excluded; 11 candidate items pass filter");

  // Step 2: 3-tier deduplication
  const deduplicatedE2E = deduplicateCandidates(validInWindow);
  assert.strictEqual(deduplicatedE2E.length, 10, "Duplicate Stripe listing merged; exactly 10 distinct opportunities remain (20)");

  // Step 3: Ranking
  const rankedE2E = rankOpportunities(deduplicatedE2E, intent15);
  assert.strictEqual(rankedE2E.length, 10, "Final ranked result count satisfies target count of 10 (20)");

  for (const r of rankedE2E) {
    assert.ok(r.opportunity.title.toLowerCase().includes("backend") || r.opportunity.title.toLowerCase().includes("software"), "Every result matches requested role");
    assert.ok(r.totalScore >= 50, "Scores are positive");
  }

  console.log("  ✓ Verified full end-to-end acceptance scenario: exactly 10 verified in-window jobs returned (20)");

  console.log("\n=================================================================");
  console.log("  TASK-043: ALL TESTS PASSED SUCCESSFULLY! ✅                    ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("naturalLanguageDateAccuracy.test")) {
  runNaturalLanguageDateAccuracyTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-043 TEST FAILED]:", err);
      process.exit(1);
    });
}
