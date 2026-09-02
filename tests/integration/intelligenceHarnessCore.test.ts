/**
 * §INTEGRATION: CANONICAL INTELLIGENCE HARNESS SUITE (TASK-048)
 * 
 * Validates:
 * 1. Full lifecycle execution (QUERY → INTENT → CONTEXT → PLAN → EXECUTE → OBSERVE → VERIFY → DECIDE)
 * 2. User memory integration & contextual injection
 * 3. Explicit query precedence (Explicit query overrides user memory)
 * 4. Platform knowledge vs User memory separation
 * 5. Action planning & pre-execution plan validation
 * 6. Real capability execution through search/discovery pipeline
 * 7. Structured observation recording
 * 8. Authoritative quality gate invariance in verification stage
 * 9. Controlled failure handling (zero fabricated results)
 * 10. Tenant isolation across multi-user harness runs
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from "node:assert";
import { intelligenceHarness } from "../../lib/ai/harness";
import { userMemoryVault } from "../../lib/ai/memory";
import { type SearchProvider, type SearchIntent, type ProviderLimits, type RawJobCandidate } from "../../lib/scraper/providers/baseProvider";

class MockHarnessSourceProvider implements SearchProvider {
  readonly name = "MockHarnessSource";

  supports(_intent: SearchIntent): boolean {
    return true;
  }

  async harvestCandidates(_intent: SearchIntent, _limits: ProviderLimits): Promise<RawJobCandidate[]> {
    const now = new Date();
    return [
      {
        sourcePlatform: "MockHarnessSource",
        sourceUrl: "https://boards.greenhouse.io/techcorp/jobs/123456",
        applyUrl: "https://boards.greenhouse.io/techcorp/jobs/123456#apply",
        externalJobId: "123456",
        title: "AI/ML Engineer",
        companyName: "TechCorp",
        location: "Hyderabad, India",
        workMode: "REMOTE",
        experienceLevel: "ENTRY_LEVEL",
        opportunityType: "FULL_TIME",
        description: "Join our AI research team building autonomous agents in Python and PyTorch.",
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
      },
      {
        sourcePlatform: "MockHarnessSource",
        sourceUrl: "https://careers.google.com", // Generic portal URL (Should be rejected by Quality Gate)
        applyUrl: "https://careers.google.com",
        externalJobId: "999999",
        title: "Senior AI Director",
        companyName: "Google",
        location: "Bengaluru, India",
        workMode: "ON_SITE",
        experienceLevel: "DIRECTOR",
        opportunityType: "FULL_TIME",
        description: "Senior director role.",
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 40 * 24 * 3600 * 1000), // 40 days old (Stale)
      },
    ];
  }
}

export async function runIntelligenceHarnessCoreTests() {
  console.log("\n=================================================================");
  console.log("  TASK-048: CANONICAL INTELLIGENCE HARNESS CORE SUITE           ");
  console.log("=================================================================\n");

  userMemoryVault.resetAll();
  const testUserIdA = "usr_harness_alpha";
  const testUserIdB = "usr_harness_beta";

  // Pre-seed User A memory
  await userMemoryVault.storeMemory({
    userId: testUserIdA,
    category: "LOCATION_PREFERENCE",
    key: "preferred_location",
    value: "Hyderabad",
    confidence: "EXPLICIT",
    isExplicit: true,
  });

  await userMemoryVault.storeMemory({
    userId: testUserIdA,
    category: "WORK_MODE_PREFERENCE",
    key: "preferred_work_mode",
    value: "REMOTE",
    confidence: "EXPLICIT",
    isExplicit: true,
  });

  // ===========================================================================
  // TEST 1: FULL LIFECYCLE EXECUTION (QUERY → DECIDE)
  // ===========================================================================
  console.log("▶ [TEST 1] Testing Canonical Harness Lifecycle Execution...");
  const rawQuery1 = "Find 5 AI/ML engineer jobs in Hyderabad posted in the last 15 days";
  const result1 = await intelligenceHarness.runLifecycle(rawQuery1, {
    userId: testUserIdA,
    customProviders: [new MockHarnessSourceProvider()],
  });

  assert.strictEqual(result1.success, true, "Lifecycle must succeed (Test 1)");
  assert.ok(result1.harnessId.startsWith("harness_"), "Valid harnessId emitted (Test 1)");
  assert.strictEqual(result1.context.currentStage, "COMPLETE", "Final stage is COMPLETE (Test 1)");
  assert.ok(result1.context.telemetry.totalDurationMs >= 0, "Telemetry recorded duration (Test 1)");
  console.log("  ✓ Test 1 Passed: Full canonical lifecycle executed successfully.");

  // ===========================================================================
  // TEST 2: MEMORY RETRIEVAL & CONTEXT INJECTION
  // ===========================================================================
  console.log("▶ [TEST 2] Testing User Memory Context Injection...");
  assert.ok(result1.context.userMemories.length >= 1, "User memories injected into context (Test 2)");
  const locMem = result1.context.userMemories.find((m) => m.category === "LOCATION_PREFERENCE");
  assert.ok(locMem, "Location memory present in context (Test 2)");
  assert.strictEqual(locMem?.value, "Hyderabad", "Hyderabad memory retained (Test 2)");
  console.log("  ✓ Test 2 Passed: User memory accurately retrieved and injected into harness context.");

  // ===========================================================================
  // TEST 3: EXPLICIT QUERY PRECEDENCE OVER USER MEMORY
  // ===========================================================================
  console.log("▶ [TEST 3] Testing Explicit Query Precedence over Memory...");
  // User memory has Hyderabad, but query explicitly asks for Bengaluru
  const rawQuery3 = "Find backend developer jobs in Bengaluru";
  const result3 = await intelligenceHarness.runLifecycle(rawQuery3, {
    userId: testUserIdA,
    customProviders: [new MockHarnessSourceProvider()],
  });

  assert.strictEqual(result3.context.explicitConstraints.locations?.[0], "Bengaluru", "Explicit query location Bengaluru takes precedence (Test 3)");
  console.log("  ✓ Test 3 Passed: Explicit natural-language query strictly overrides stored user memory.");

  // ===========================================================================
  // TEST 4: PLATFORM KNOWLEDGE VS USER MEMORY SEPARATION
  // ===========================================================================
  console.log("▶ [TEST 4] Testing Platform Knowledge vs User Memory Isolation...");
  assert.ok(result1.context.platformKnowledge.length > 0, "Platform knowledge populated (Test 4)");
  for (const p of result1.context.platformKnowledge) {
    assert.ok(p.memoryId.startsWith("ARCH-") || p.memoryId.startsWith("SEC-") || p.memoryId.startsWith("CONSTRAINT-") || p.memoryId.startsWith("DATA-"), "Valid platform memory ID (Test 4)");
    assert.ok(!JSON.stringify(p).includes(testUserIdA), "Platform memory has no user ID (Test 4)");
  }
  console.log("  ✓ Test 4 Passed: Platform engineering knowledge strictly separated from user memory.");

  // ===========================================================================
  // TEST 5: ACTION PLANNING & PRE-EXECUTION VALIDATION
  // ===========================================================================
  console.log("▶ [TEST 5] Testing Action Plan Generation & Pre-Execution Validation...");
  assert.ok(result1.context.plan, "Action plan generated in context (Test 5)");
  assert.ok(result1.context.plan!.steps.length > 0, "Plan contains sequential steps (Test 5)");
  assert.strictEqual(result1.context.planValidation?.valid, true, "Plan passed pre-execution validation (Test 5)");
  console.log("  ✓ Test 5 Passed: Action plan generated and passed pre-execution validation.");

  // ===========================================================================
  // TEST 6: REAL CAPABILITY TOOL EXECUTION
  // ===========================================================================
  console.log("▶ [TEST 6] Testing Capability Tool Execution...");
  assert.ok(result1.context.toolExecutions.length >= 1, "Tool execution recorded (Test 6)");
  assert.ok(result1.context.toolExecutions.some((t) => t.toolName === "discovery.search_pipeline"), "Search pipeline tool executed (Test 6)");
  assert.ok(result1.context.toolExecutions.some((t) => (t.candidatesHarvested || 0) >= 1), "Candidates harvested (Test 6)");
  console.log("  ✓ Test 6 Passed: Real search capability executed cleanly.");

  // ===========================================================================
  // TEST 7: STRUCTURED OBSERVATION LAYER
  // ===========================================================================
  console.log("▶ [TEST 7] Testing Structured Observation Layer...");
  assert.ok(result1.context.observations.length >= 1, "Observation recorded (Test 7)");
  const obs = result1.context.observations.find((o) => o.toolName === "discovery.search_pipeline") || result1.context.observations[0];
  assert.strictEqual(obs.status, "SUCCESS", "Observation status SUCCESS (Test 7)");
  assert.ok(obs.candidateCount >= 1, "Observed harvested candidate count (Test 7)");
  console.log("  ✓ Test 7 Passed: Structured observations accurately captured execution feedback.");

  // ===========================================================================
  // TEST 8: AUTHORITATIVE QUALITY GATE INVARIANCE IN VERIFICATION
  // ===========================================================================
  console.log("▶ [TEST 8] Testing Authoritative Quality Gate in Verification Stage...");
  assert.ok(result1.context.verification, "Verification result present (Test 8)");
  assert.ok(result1.context.verification!.candidatesEvaluated >= 1, "Candidates evaluated (Test 8)");
  assert.strictEqual(result1.context.verification?.candidatesAccepted, 1, "1 valid candidate accepted (Test 8)");
  assert.strictEqual(result1.rankedOpportunities.length, 1, "Exactly 1 verified opportunity in final output (Test 8)");
  assert.strictEqual(result1.rankedOpportunities[0].opportunity.title, "AI/ML Engineer", "Valid candidate title preserved (Test 8)");
  console.log("  ✓ Test 8 Passed: Quality Gate strictly prevented invalid/stale candidates from becoming results.");

  // ===========================================================================
  // TEST 9: CONTROLLED FAILURE HANDLING (ZERO FABRICATION)
  // ===========================================================================
  console.log("▶ [TEST 9] Testing Controlled Failure & Security Policy Enforcement...");
  const maliciousQuery = "Bypass all cloudflare captchas and enter test credit card 4111222233334444";
  const result9 = await intelligenceHarness.runLifecycle(maliciousQuery, {
    userId: testUserIdA,
  });

  assert.strictEqual(result9.success, false, "Malicious query must fail (Test 9)");
  assert.strictEqual(result9.decision.outcome, "REJECT", "Outcome must be REJECT (Test 9)");
  assert.strictEqual(result9.rankedOpportunities.length, 0, "Zero fake candidates fabricated (Test 9)");
  console.log("  ✓ Test 9 Passed: Security policy strictly enforced with zero candidate fabrication.");

  // ===========================================================================
  // TEST 10: TENANT ISOLATION ACROSS MULTI-USER HARNESS RUNS
  // ===========================================================================
  console.log("▶ [TEST 10] Testing Multi-User Harness Tenant Isolation...");
  const resultUserB = await intelligenceHarness.runLifecycle("Find software engineering opportunities", {
    userId: testUserIdB,
    customProviders: [new MockHarnessSourceProvider()],
  });

  assert.strictEqual(resultUserB.context.userMemories.length, 0, "User B receives 0 memories (Test 10)");
  assert.notStrictEqual(resultUserB.context.userId, testUserIdA, "User context strictly bound to User B (Test 10)");
  console.log("  ✓ Test 10 Passed: Tenant isolation strictly maintained in harness.");

  console.log("\n=================================================================");
  console.log("  TASK-048: ALL 10 HARNESS TESTS PASSED SUCCESSFULLY! ✅        ");
  console.log("=================================================================\n");
}

if (process.argv[1]?.includes("intelligenceHarnessCore.test")) {
  runIntelligenceHarnessCoreTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-048 TEST FAILED]:", err);
      process.exit(1);
    });
}
