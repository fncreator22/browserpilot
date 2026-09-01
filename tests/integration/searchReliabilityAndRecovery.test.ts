/**
 * §INTEGRATION: PRODUCTION SEARCH RELIABILITY, OBSERVABILITY & SOURCE RECOVERY (TASK-046)
 * 
 * Validates:
 * 1. Multi-source success execution and telemetry
 * 2. Partial failure isolation (success + timeout + rate limit + auth failure)
 * 3. Total failure / zero-source-success graceful degradation (no crash, no fabricated data)
 * 4. Bounded transient retry policy (retries network/timeout, ignores auth/captcha)
 * 5. Timeout isolation and resource release
 * 6. Browser concurrency permit safety across exception/crash branches
 * 7. Source health, circuit breaker cooldown, and automatic recovery
 * 8. Semantic integrity & freshness invariance under source failures (no stale backfill)
 * 9. Ranking safety invariance during failure scenarios
 * 10. Secret-free observability & telemetry sanitization
 */

import assert from "node:assert";
import { parseSearchIntent } from "../../lib/scraper/intentParser";
import { buildDiscoveryPlan } from "../../lib/scraper/discoveryPlanner";
import { executeSearchPipeline } from "../../lib/scraper/searchPipeline";
import { SwarmDiscoveryEngine } from "../../lib/scraper/swarmDiscovery";
import {
  classifySourceError,
  isTransientFailure,
  sanitizeTelemetryPayload,
  sourceReliabilityManager,
} from "../../lib/discovery/execution/sourceReliabilityManager";
import { browserConcurrencyController } from "../../lib/discovery/execution/browserConcurrencyController";
import { type SearchProvider, type RawJobCandidate } from "../../lib/scraper/providers/baseProvider";

export async function runSearchReliabilityAndRecoveryTests() {
  console.log("\n=================================================================");
  console.log("  TASK-046: PRODUCTION SEARCH RELIABILITY & RECOVERY SUITE      ");
  console.log("=================================================================\n");

  const now = new Date();
  sourceReliabilityManager.resetAll();

  // ===========================================================================
  // TEST 1: MULTI-SOURCE SUCCESS EXECUTION
  // ===========================================================================
  console.log("▶ [TEST 1] Testing Multi-Source Success Execution & Telemetry...");
  const validCandidateA: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: "https://boards.greenhouse.io/stripe/jobs/101",
    applyUrl: "https://stripe.com/careers/backend-101",
    title: "Backend Engineer",
    companyName: "Stripe",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
    postedAgoText: "2d ago",
  };

  const validCandidateB: RawJobCandidate = {
    sourcePlatform: "Ashby",
    sourceUrl: "https://jobs.ashbyhq.com/linear/202",
    applyUrl: "https://linear.app/careers/backend-202",
    title: "Backend Developer",
    companyName: "Linear",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 4 * 24 * 3600 * 1000),
    postedAgoText: "4d ago",
  };

  const res1 = await executeSearchPipeline("Backend developer jobs in the last 15 days", {
    customProviders: [
      { name: "SourceA", supports: () => true, harvestCandidates: async () => [validCandidateA] },
      { name: "SourceB", supports: () => true, harvestCandidates: async () => [validCandidateB] },
    ],
    persistToDb: false,
  });

  assert.strictEqual(res1.rankedOpportunities.length, 2, "Returns 2 valid opportunities (Test 1)");
  assert.strictEqual(res1.searchDiagnostics?.sourceFailures, 0, "Zero source failures recorded (Test 1)");
  console.log("  ✓ Test 1 Passed: Multi-source success execution verified.");

  // ===========================================================================
  // TEST 2: PARTIAL FAILURE ISOLATION (SUCCESS + TIMEOUT + RATE LIMIT + AUTH + EXTRACTION)
  // ===========================================================================
  console.log("▶ [TEST 2] Testing Partial Failure Isolation Across Multiple Faulty Sources...");
  const multiFaultProviders: SearchProvider[] = [
    {
      name: "GoodSource",
      supports: () => true,
      harvestCandidates: async () => [validCandidateA],
    },
    {
      name: "TimeoutSource",
      supports: () => true,
      harvestCandidates: async () => {
        const err = new Error("Request timed out after 5000ms");
        err.name = "AbortError";
        throw err;
      },
    },
    {
      name: "RateLimitedSource",
      supports: () => true,
      harvestCandidates: async () => {
        throw new Error("HTTP 429: Too many requests. Rate limit exceeded.");
      },
    },
    {
      name: "AuthRequiredSource",
      supports: () => true,
      harvestCandidates: async () => {
        throw new Error("HTTP 401 Unauthorized: Authentication credentials required.");
      },
    },
    {
      name: "ExtractionFailSource",
      supports: () => true,
      harvestCandidates: async () => {
        throw new Error("Extraction error: DOM parsing failed for malformed HTML.");
      },
    },
  ];

  const res2 = await executeSearchPipeline("Backend developer jobs in the last 15 days", {
    customProviders: multiFaultProviders,
    persistToDb: false,
  });

  assert.strictEqual(res2.rankedOpportunities.length, 1, "Preserves 1 valid candidate from GoodSource (Test 2)");
  assert.strictEqual(res2.searchDiagnostics?.sourceFailures, 4, "Records 4 failed sources (Test 2)");
  assert.ok(res2.rankedOpportunities[0].opportunity.companyName === "Stripe", "Valid opportunity preserved (Test 2)");
  console.log("  ✓ Test 2 Passed: Partial failure isolation preserves valid results without crashing.");

  // ===========================================================================
  // TEST 3: TOTAL FAILURE / ZERO-SOURCE-SUCCESS HANDLING
  // ===========================================================================
  console.log("▶ [TEST 3] Testing Total Failure Graceful Degradation (All Sources Down)...");
  const allFailingProviders: SearchProvider[] = [
    {
      name: "FailSource1",
      supports: () => true,
      harvestCandidates: async () => {
        throw new Error("ECONNREFUSED: Server unreachable");
      },
    },
    {
      name: "FailSource2",
      supports: () => true,
      harvestCandidates: async () => {
        throw new Error("HTTP 503 Service Unavailable");
      },
    },
  ];

  const res3 = await executeSearchPipeline("Backend developer jobs in the last 15 days", {
    customProviders: allFailingProviders,
    persistToDb: false,
  });

  assert.strictEqual(res3.rankedOpportunities.length, 0, "Returns 0 opportunities when all fail (Test 3)");
  assert.strictEqual(res3.searchDiagnostics?.validResultCount, 0, "Diagnostic valid count is 0 (Test 3)");
  assert.strictEqual(res3.searchDiagnostics?.sourceFailures, 2, "Diagnostic records 2 source failures (Test 3)");
  assert.ok(
    res3.searchExplanation?.includes("temporarily unreachable"),
    `Emits clear user explanation: ${res3.searchExplanation} (Test 3)`
  );
  console.log("  ✓ Test 3 Passed: Total failure handles gracefully with actionable message.");

  // ===========================================================================
  // TEST 4: BOUNDED TRANSIENT RETRY VS PERMANENT NON-RETRY
  // ===========================================================================
  console.log("▶ [TEST 4] Testing Bounded Transient Retry vs Permanent Non-Retry...");
  let transientAttempts = 0;
  const transientProvider: SearchProvider = {
    name: "TransientProvider",
    supports: () => true,
    harvestCandidates: async () => {
      transientAttempts++;
      if (transientAttempts === 1) {
        throw new Error("ECONNRESET: Connection reset by peer");
      }
      return [validCandidateB];
    },
  };

  let authAttempts = 0;
  const authProvider: SearchProvider = {
    name: "PermanentAuthProvider",
    supports: () => true,
    harvestCandidates: async () => {
      authAttempts++;
      throw new Error("HTTP 401 Unauthorized: Login required");
    },
  };

  const swarmEngine = new SwarmDiscoveryEngine([transientProvider, authProvider]);
  const plan = buildDiscoveryPlan("Backend developer jobs in the last 15 days");
  const swarmRes = await swarmEngine.executeSwarm(plan);

  assert.strictEqual(transientAttempts, 2, "Transient error was retried once and succeeded (Test 4)");
  assert.strictEqual(authAttempts, 1, "Permanent auth error was NOT retried (Test 4)");
  assert.strictEqual(swarmRes.candidates.length, 1, "Harvests 1 candidate after transient retry (Test 4)");
  console.log("  ✓ Test 4 Passed: Bounded transient retry succeeds while permanent errors are not retried.");

  // ===========================================================================
  // TEST 5: TIMEOUT ISOLATION & CONCURRENCY PERMIT SAFETY
  // ===========================================================================
  console.log("▶ [TEST 5] Testing Timeout Isolation & Clean Abort Signal...");
  const slowHangingProvider: SearchProvider = {
    name: "HangingProvider",
    supports: () => true,
    harvestCandidates: async (_intent, _limits, ctx) => {
      return new Promise<RawJobCandidate[]>((_, reject) => {
        if (ctx?.signal) {
          ctx.signal.addEventListener("abort", () => {
            const err = new Error("AbortError: Operation cancelled");
            err.name = "AbortError";
            reject(err);
          });
        }
      });
    },
  };

  const timeoutSwarm = new SwarmDiscoveryEngine([slowHangingProvider]);
  const timeoutRes = await timeoutSwarm.executeSwarm(plan, { perProviderTimeoutMs: 50 });

  assert.strictEqual(timeoutRes.candidates.length, 0, "No candidates from timed-out provider (Test 5)");
  assert.strictEqual(timeoutRes.providerTelemetry[0].status, "TIMEOUT", "Telemetry status is TIMEOUT (Test 5)");
  console.log("  ✓ Test 5 Passed: Timeout cleanly aborts provider without hanging.");

  // ===========================================================================
  // TEST 6: BROWSER CONCURRENCY CONTROLLER SAFETY
  // ===========================================================================
  console.log("▶ [TEST 6] Testing Concurrency Permit Cleanup on Crashes & Exceptions...");
  const initialContexts = browserConcurrencyController.getActiveContextsCount();

  try {
    const release = await browserConcurrencyController.acquireSlot("LinkedIn", "test-user");
    try {
      throw new Error("Simulated browser crash during navigation");
    } finally {
      release();
    }
  } catch (_ignored) {}

  const finalContexts = browserConcurrencyController.getActiveContextsCount();
  assert.strictEqual(finalContexts, initialContexts, "Context slot cleanly released after exception (Test 6)");
  console.log("  ✓ Test 6 Passed: Concurrency permits are 100% released on failure paths.");

  // ===========================================================================
  // TEST 7: SOURCE HEALTH, CIRCUIT BREAKER COOLDOWN & AUTOMATIC RECOVERY
  // ===========================================================================
  console.log("▶ [TEST 7] Testing Circuit Breaker Cooldown & Automatic Recovery...");
  sourceReliabilityManager.resetAll();

  // Record 3 consecutive failures for "FlakySource"
  sourceReliabilityManager.recordOutcome("FlakySource", "FAILURE", "RATE_LIMITED", now);
  sourceReliabilityManager.recordOutcome("FlakySource", "FAILURE", "RATE_LIMITED", now);
  const degradedState = sourceReliabilityManager.recordOutcome("FlakySource", "FAILURE", "RATE_LIMITED", now);

  assert.strictEqual(degradedState.status, "COOLDOWN", "Source enters COOLDOWN after 3 failures (Test 7)");
  assert.strictEqual(degradedState.consecutiveFailures, 3, "Consecutive failures = 3 (Test 7)");

  const skipCheck = sourceReliabilityManager.shouldSkipSource("FlakySource", now);
  assert.strictEqual(skipCheck.skip, true, "Source is skipped during active cooldown (Test 7)");

  // Fast forward time past cooldown
  const future = new Date(now.getTime() + 70 * 1000); // 70s later (> 60s cooldown)
  const recoveryCheck = sourceReliabilityManager.shouldSkipSource("FlakySource", future);
  assert.strictEqual(recoveryCheck.skip, false, "Source is no longer skipped after cooldown expires (Test 7)");

  // Successful probe restores healthy status
  const recoveredState = sourceReliabilityManager.recordOutcome("FlakySource", "SUCCESS", undefined, future);
  assert.strictEqual(recoveredState.status, "HEALTHY", "Successful execution restores HEALTHY state (Test 7)");
  assert.strictEqual(recoveredState.consecutiveFailures, 0, "Consecutive failures reset to 0 (Test 7)");
  console.log("  ✓ Test 7 Passed: Circuit breaker cooldown and automatic recovery verified.");

  // ===========================================================================
  // TEST 8: SEMANTIC INTEGRITY & FRESHNESS INVARIANCE DURING FAILURES
  // ===========================================================================
  console.log("▶ [TEST 8] Testing Freshness & Date Invariance Under Source Failures...");
  const staleCandidate: RawJobCandidate = {
    sourcePlatform: "Indeed",
    sourceUrl: "https://indeed.com/viewjob?jk=stale-70d",
    applyUrl: "https://company.com/careers/backend-stale",
    title: "Backend Engineer",
    companyName: "OldCo",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 70 * 24 * 3600 * 1000), // 70d old (STALE)
  };

  const res8 = await executeSearchPipeline("Give me 10 backend developer jobs posted in the last 15 days", {
    customProviders: [
      { name: "FailingSource", supports: () => true, harvestCandidates: async () => { throw new Error("Timeout"); } },
      { name: "StaleSource", supports: () => true, harvestCandidates: async () => [staleCandidate, validCandidateA] },
    ],
    persistToDb: false,
  });

  assert.strictEqual(res8.rankedOpportunities.length, 1, "Stale candidate is rejected; only valid candidate returned (Test 8)");
  assert.strictEqual(res8.rankedOpportunities[0].opportunity.companyName, "Stripe", "Only in-window Stripe job returned (Test 8)");
  assert.ok(
    res8.searchExplanation?.includes("Found 1 verified") && res8.searchExplanation?.includes("9 additional"),
    "Shortfall reported honestly without backfilling stale candidates (Test 8)"
  );
  console.log("  ✓ Test 8 Passed: Source failures never weaken freshness or cause stale backfilling.");

  // ===========================================================================
  // TEST 9: RANKING SAFETY INVARIANCE DURING FAILURES
  // ===========================================================================
  console.log("▶ [TEST 9] Testing Ranking Safety Invariance During Source Failures...");
  const highScoringStale: RawJobCandidate = {
    sourcePlatform: "Ashby",
    sourceUrl: "https://jobs.ashbyhq.com/old/1",
    applyUrl: "https://old.com/careers/backend-1",
    title: "Backend Developer",
    companyName: "OldCo",
    discoveredAt: now,
    postedAt: new Date(now.getTime() - 45 * 24 * 3600 * 1000), // 45d old (STALE)
  };

  const res9 = await executeSearchPipeline("Backend developer jobs in the last 15 days", {
    customProviders: [
      { name: "BrokenSource", supports: () => true, harvestCandidates: async () => { throw new Error("Rate limited"); } },
      { name: "CandidateSource", supports: () => true, harvestCandidates: async () => [highScoringStale, validCandidateB] },
    ],
    persistToDb: false,
  });

  assert.strictEqual(res9.rankedOpportunities.length, 1, "Only valid Candidate B is ranked (Test 9)");
  assert.strictEqual(res9.rankedOpportunities[0].opportunity.companyName, "Linear", "Linear job is ranked (Test 9)");
  console.log("  ✓ Test 9 Passed: Ranking score cannot resurrect ineligible items during failures.");

  // ===========================================================================
  // TEST 10: SECRET-FREE OBSERVABILITY & TELEMETRY SANITIZATION
  // ===========================================================================
  console.log("▶ [TEST 10] Testing Secret-Free Observability & Telemetry Sanitization...");
  const rawTelemetryWithSecrets = {
    source: "LinkedIn",
    user_password: "SuperSecretPassword123!",
    api_key: "bp_live_secret_key_456",
    session_token: "jwt.header.payload.signature",
    auth_cookie: "session_id=abcdef123456",
    public_status: "SUCCESS",
    count: 5,
    nested: {
      client_secret: "shhh",
      safe_data: "Software Engineer",
    },
  };

  const sanitized = sanitizeTelemetryPayload(rawTelemetryWithSecrets);

  assert.strictEqual((sanitized as any).user_password, "[REDACTED]", "Password redacted");
  assert.strictEqual((sanitized as any).api_key, "[REDACTED]", "API key redacted");
  assert.strictEqual((sanitized as any).session_token, "[REDACTED]", "Session token redacted");
  assert.strictEqual((sanitized as any).auth_cookie, "[REDACTED]", "Auth cookie redacted");
  assert.strictEqual((sanitized as any).nested.client_secret, "[REDACTED]", "Nested secret redacted");
  assert.strictEqual((sanitized as any).public_status, "SUCCESS", "Public status preserved");
  assert.strictEqual((sanitized as any).nested.safe_data, "Software Engineer", "Safe nested data preserved");
  console.log("  ✓ Test 10 Passed: Telemetry sanitization strictly eliminates credentials and secrets.");

  console.log("\n=================================================================");
  console.log("  TASK-046: ALL 10 RELIABILITY & RECOVERY TESTS PASSED! ✅       ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("searchReliabilityAndRecovery.test")) {
  runSearchReliabilityAndRecoveryTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-046 TEST FAILED]:", err);
      process.exit(1);
    });
}
