/**
 * §PHYSICAL VALIDATION SUITE (TASK-050)
 * 
 * Validates the 6 physical execution scenarios specified in Section 30:
 * 1. Generic Search ("Find 10 remote backend engineer jobs in India posted in the last 15 days")
 * 2. Company Search ("Find backend jobs at Stripe")
 * 3. Authenticated Source (Authorization enforcement & tenant protection)
 * 4. Partial Failure (Failure isolation & successful result preservation)
 * 5. Invalid Planner Plan (Attempting postedWithinDays = 30 when user asked for 15)
 * 6. Tool Injection Defense (Attempting CAPTCHA bypass or credential access)
 */

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from "node:assert";
import { intelligenceHarness } from "@/lib/ai/harness";
import { searchPlanner, validateSearchActionPlan } from "@/lib/ai/searchPlanner";
import { searchActionExecutor } from "@/lib/ai/tools";
import { intelligenceBrain } from "@/lib/ai/brain";

async function runTask050PhysicalValidation() {
  console.log("=================================================================");
  console.log("  TASK-050: PHYSICAL VALIDATION (6 REAL SCENARIOS)               ");
  console.log("=================================================================\n");

  const userId = "usr_physical_task050";

  // ---------------------------------------------------------------------------
  // SCENARIO 1: GENERIC SEARCH
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 1] Executing Generic Search...");
  const query1 = "Find 10 remote backend engineer jobs in India posted in the last 15 days";
  const t0 = Date.now();
  const res1 = await intelligenceHarness.runLifecycle(query1, { userId });
  const dur1 = Date.now() - t0;

  console.log(`  Harness ID:        ${res1.harnessId}`);
  console.log(`  Success:           ${res1.success}`);
  console.log(`  Total Duration:    ${dur1}ms`);
  console.log(`  Plan ID:           ${res1.context.searchActionPlan?.planId}`);
  console.log(`  Actions Planned:   ${res1.context.searchActionPlan?.actions.length}`);
  console.log(`  Actions Executed:  ${res1.context.toolExecutions.length}`);
  console.log(`  Verified Results:  ${res1.rankedOpportunities.length}`);
  console.log(`  Decision Outcome:  ${res1.decision.outcome}`);
  assert.ok(res1.success, "Scenario 1 succeeded");
  assert.ok((res1.context.searchActionPlan?.actions.length ?? 0) >= 2, "Multiple capabilities planned");
  assert.strictEqual(res1.context.searchActionPlan?.constraints.postedWithinDays, 15, "15-day constraint preserved");
  console.log("  ✓ Scenario 1 Verified: Generic search orchestrated with valid plan and verified results.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 2: COMPANY SEARCH (STRIPE)
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 2] Executing Company-Specific Search (Stripe)...");
  const query2 = "Find backend jobs at Stripe";
  const t1 = Date.now();
  const res2 = await intelligenceHarness.runLifecycle(query2, { userId });
  const dur2 = Date.now() - t1;

  console.log(`  Harness ID:        ${res2.harnessId}`);
  console.log(`  Success:           ${res2.success}`);
  console.log(`  Total Duration:    ${dur2}ms`);
  console.log(`  Company Planned:   ${res2.context.searchActionPlan?.constraints.targetCompanies?.join(", ")}`);
  console.log(`  Actions Executed:  ${res2.context.toolExecutions.map(t => t.toolName).join(", ")}`);
  console.log(`  Reasoning Summary: ${res2.context.searchActionPlan?.reasoningSummary}`);
  console.log(`  Verified Results:  ${res2.rankedOpportunities.length}`);
  assert.ok(res2.success, "Scenario 2 succeeded");
  assert.ok(
    res2.context.searchActionPlan?.actions.some(a => a.capabilityId === "company.ats" || a.capabilityId === "company.lookup"),
    "Company ATS / lookup selected"
  );
  console.log("  ✓ Scenario 2 Verified: Company intelligence and official ATS discovery prioritized.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 3: AUTHENTICATED SOURCE CHECK
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 3] Executing Authenticated Source Authorization Check...");
  const authAction = {
    actionId: "act_auth_phys",
    capabilityId: "browser.authenticated_search" as any,
    priority: 1,
    input: { sourceName: "LINKEDIN", query: "Backend Engineer" },
    purpose: "Check auth session requirement",
    expectedEvidence: "Jobs",
    maxResults: 5,
    timeoutMs: 5000,
    dependencyIds: [],
  };

  const res3 = await searchActionExecutor.executeSingleAction(authAction, {
    planId: "phys_auth_check",
    actionId: "act_auth_phys",
    userId: "unconnected_user",
  });
  console.log(`  Action Status:     ${res3.status}`);
  console.log(`  Failure Category:  ${res3.failureCategory}`);
  console.log(`  Error Message:     ${res3.error}`);
  assert.strictEqual(res3.status, "FAILED");
  assert.strictEqual(res3.failureCategory, "AUTH_REQUIRED");
  console.log("  ✓ Scenario 3 Verified: Authenticated browser capabilities enforce tenant session.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 4: PARTIAL FAILURE ISOLATION
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 4] Executing Partial Failure Isolation...");
  const partialPlan: any = {
    planId: "plan_phys_partial",
    query: "Partial Fail Check",
    actions: [
      {
        actionId: "act_phys_fail",
        capabilityId: "browser.authenticated_search",
        priority: 1,
        input: { sourceName: "LINKEDIN", query: "Backend" },
        purpose: "Will fail authentication",
        expectedEvidence: "None",
        maxResults: 5,
        timeoutMs: 2000,
        dependencyIds: [],
      },
      {
        actionId: "act_phys_ok",
        capabilityId: "company.lookup",
        priority: 1,
        input: { companyName: "Stripe" },
        purpose: "Will succeed",
        expectedEvidence: "Company portal",
        maxResults: 1,
        timeoutMs: 5000,
        dependencyIds: [],
      },
    ],
    constraints: { requestedCount: 5 },
    stoppingCriteria: { maxResults: 5, stopOnTargetCount: true, maxPlanningRounds: 1 },
    confidence: 0.9,
    reasoningSummary: "Isolate failure",
    createdAt: new Date(),
  };

  const res4 = await searchActionExecutor.executePlan(partialPlan, { userId: null });
  console.log(`  Total Actions:     ${res4.actionResults.length}`);
  console.log(`  Successful:        ${res4.successfulActionsCount}`);
  console.log(`  Failed:            ${res4.failedActionsCount}`);
  assert.strictEqual(res4.successfulActionsCount, 1);
  assert.strictEqual(res4.failedActionsCount, 1);
  console.log("  ✓ Scenario 4 Verified: Single failed tool isolated; valid results survive.\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 5: INVALID PLANNER PLAN (postedWithinDays = 30 vs 15)
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 5] Executing Invalid Planner Constraint Rejection...");
  const canonicalIntent15 = {
    role: "Backend Engineer",
    postedWithinDays: 15,
    requestedCount: 10,
  };

  const roguePlan: any = {
    planId: "plan_rogue_30d",
    query: "Backend Developer",
    actions: [
      {
        actionId: "act_rogue",
        capabilityId: "discovery.search_pipeline",
        priority: 1,
        input: { query: "Backend", postedWithinDays: 30 },
        purpose: "Rogue date window relaxation",
        expectedEvidence: "Jobs",
        maxResults: 10,
        timeoutMs: 15000,
        dependencyIds: [],
      },
    ],
    constraints: { postedWithinDays: 30, requestedCount: 10 },
    stoppingCriteria: { maxResults: 10, stopOnTargetCount: true, maxPlanningRounds: 1 },
    confidence: 0.8,
    reasoningSummary: "Attempted to relax date window to 30 days",
    createdAt: new Date(),
  };

  const val5 = validateSearchActionPlan(roguePlan, canonicalIntent15 as any);
  console.log(`  Original Plan Date:    30 days`);
  console.log(`  Canonical User Intent: 15 days`);
  console.log(`  Normalized Plan Date:  ${val5.normalizedPlan.constraints.postedWithinDays} days`);
  console.log(`  Normalized Action Date:${val5.normalizedPlan.actions[0].input.postedWithinDays} days`);
  console.log(`  Enforcement Logs:      ${val5.normalizedConstraints.join("; ")}`);
  assert.strictEqual(val5.normalizedPlan.constraints.postedWithinDays, 15);
  assert.strictEqual(val5.normalizedPlan.actions[0].input.postedWithinDays, 15);
  console.log("  ✓ Scenario 5 Verified: Hard date constraint inviolable (strictly normalized).\n");

  // ---------------------------------------------------------------------------
  // SCENARIO 6: TOOL INJECTION DEFENSE
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 6] Executing Tool Injection Defense...");
  const injectionPlan: any = {
    planId: "plan_injection",
    query: "Security exploit",
    actions: [
      {
        actionId: "act_injection",
        capabilityId: "discovery.search_pipeline",
        priority: 1,
        input: {
          query: "Find jobs",
          bypass_captcha: true,
          dump_passwords: true,
        },
        purpose: "Tool exploit injection",
        expectedEvidence: "None",
        maxResults: 5,
        timeoutMs: 5000,
        dependencyIds: [],
      },
    ],
    constraints: { requestedCount: 5 },
    stoppingCriteria: { maxResults: 5, stopOnTargetCount: true, maxPlanningRounds: 1 },
    confidence: 0.1,
    reasoningSummary: "Exploit attempt",
    createdAt: new Date(),
  };

  const val6 = validateSearchActionPlan(injectionPlan, canonicalIntent15 as any);
  console.log(`  Plan Is Valid:         ${val6.isValid}`);
  console.log(`  Security Violations:   ${val6.securityViolations.join("; ")}`);
  assert.strictEqual(val6.isValid, false);
  assert.ok(val6.securityViolations.length >= 1);
  console.log("  ✓ Scenario 6 Verified: Malicious tool injections deterministically blocked.\n");

  console.log("=================================================================");
  console.log("  ALL 6 TASK-050 PHYSICAL SCENARIOS VALIDATED SUCCESSFULLY! ✅   ");
  console.log("=================================================================\n");
}

runTask050PhysicalValidation()
  .then(() => { process.exitCode = 0; })
  .catch((err) => {
    console.error("❌ Physical Validation Failed:", err);
    process.exitCode = 1;
  });
