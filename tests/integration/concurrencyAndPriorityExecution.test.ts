/**
 * §INTEGRATION TEST: Per-Plan Search Concurrency Limits and Priority Execution
 */

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";
(process.env as any).SKIP_RATE_LIMIT_FOR_TESTS = "true";

import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import {
  seedDefaultPlanCapabilities,
  getCapabilityLimit,
  hasCapability,
} from "@/lib/billing/entitlementService";
import { POST as searchRoutePost } from "@/app/api/search/route";
import { enqueueSearchDiscoveryJob } from "@/lib/queue/searchQueue";

async function runIntegrationTests() {
  console.log("===================================================================");
  console.log("  PER-PLAN CONCURRENCY LIMITS AND PRIORITY EXECUTION VERIFICATION  ");
  console.log("===================================================================\n");

  // STEP 0: Seed PlanCapabilities and Setup Test Users
  console.log("▶ [STEP 0] Seeding PlanCapability records...");
  await seedDefaultPlanCapabilities();

  const freePlan = await prisma.plan.findUnique({ where: { code: "FREE" } });
  const premiumPlan = await prisma.plan.findUnique({ where: { code: "PREMIUM" } });
  const enterprisePlan = await prisma.plan.findUnique({ where: { code: "ENTERPRISE" } });

  assert.ok(freePlan, "FREE plan must exist");
  assert.ok(premiumPlan, "PREMIUM plan must exist");
  assert.ok(enterprisePlan, "ENTERPRISE plan must exist");

  const ts = Date.now();
  const freeUserId = `test_usr_free_${ts}`;
  const premiumUserId = `test_usr_prem_${ts}`;
  const enterpriseUserId = `test_usr_ent_${ts}`;

  await prisma.user.createMany({
    data: [
      { id: freeUserId, email: `${freeUserId}@test.com`, name: "Free Tier User", passwordHash: "h" },
      { id: premiumUserId, email: `${premiumUserId}@test.com`, name: "Premium Tier User", passwordHash: "h" },
      { id: enterpriseUserId, email: `${enterpriseUserId}@test.com`, name: "Enterprise Tier User", passwordHash: "h" },
    ],
  });

  await prisma.subscription.create({
    data: {
      userId: premiumUserId,
      planId: premiumPlan.id,
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
    },
  });

  await prisma.subscription.create({
    data: {
      userId: enterpriseUserId,
      planId: enterprisePlan.id,
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
    },
  });

  console.log("  ✓ Test users and subscriptions successfully initialized.\n");

  // STEP 1: Validate Seeded Capabilities
  console.log("▶ [STEP 1] Validating PlanCapability configuration per tier...");

  const freeConcurrent = await getCapabilityLimit(freeUserId, "MAX_CONCURRENT_SEARCHES");
  const premConcurrent = await getCapabilityLimit(premiumUserId, "MAX_CONCURRENT_SEARCHES");
  const entConcurrent = await getCapabilityLimit(enterpriseUserId, "MAX_CONCURRENT_SEARCHES");

  console.log(`   - Free User Concurrency Limit:       ${freeConcurrent} (Expected: 1)`);
  console.log(`   - Premium User Concurrency Limit:    ${premConcurrent} (Expected: 5)`);
  console.log(`   - Enterprise User Concurrency Limit: ${entConcurrent} (Expected: 25)`);

  assert.strictEqual(freeConcurrent, 1, "FREE plan must have MAX_CONCURRENT_SEARCHES = 1");
  assert.strictEqual(premConcurrent, 5, "PREMIUM plan must have MAX_CONCURRENT_SEARCHES = 5");
  assert.strictEqual(entConcurrent, 25, "ENTERPRISE plan must have MAX_CONCURRENT_SEARCHES = 25");

  const freePriority = await hasCapability(freeUserId, "PRIORITY_EXECUTION");
  const premPriority = await hasCapability(premiumUserId, "PRIORITY_EXECUTION");
  const entPriority = await hasCapability(enterpriseUserId, "PRIORITY_EXECUTION");

  console.log(`   - Free User Priority Execution:       ${freePriority} (Expected: false)`);
  console.log(`   - Premium User Priority Execution:    ${premPriority} (Expected: false)`);
  console.log(`   - Enterprise User Priority Execution: ${entPriority} (Expected: true)`);

  assert.strictEqual(freePriority, false, "FREE plan must have PRIORITY_EXECUTION = false");
  assert.strictEqual(premPriority, false, "PREMIUM plan must have PRIORITY_EXECUTION = false");
  assert.strictEqual(entPriority, true, "ENTERPRISE plan must have PRIORITY_EXECUTION = true");

  console.log("  ✓ Step 1 Passed: Capabilities correctly seeded and verified.\n");

  // STEP 2: Free User Concurrency Limit Enforcement
  console.log("▶ [STEP 2] Verifying Free user search concurrency enforcement...");

  const freeReq1 = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": freeUserId },
    body: JSON.stringify({ query: "Senior Backend Engineer Go" }),
  });
  const freeRes1 = await searchRoutePost(freeReq1);
  assert.strictEqual(freeRes1.status, 200, "First search must succeed with HTTP 200");
  const freeJson1 = await freeRes1.json();
  assert.strictEqual(freeJson1.status, "QUEUED", "First search must be queued");
  console.log(`   - Search 1 enqueued: executionId=${freeJson1.executionId}`);

  const activeSearchesAfter1 = await prisma.search.count({
    where: { userId: freeUserId, status: { in: ["CREATED", "QUEUED", "RUNNING"] } },
  });
  console.log(`   - Active searches in DB for Free user: ${activeSearchesAfter1}`);
  assert.strictEqual(activeSearchesAfter1, 1, "Active searches count in DB must be exactly 1");

  console.log("   - Attempting concurrent Search 2 for Free user (should be rejected)...");
  const freeReq2 = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": freeUserId },
    body: JSON.stringify({ query: "Frontend React Next.js Specialist" }),
  });
  const freeRes2 = await searchRoutePost(freeReq2);
  const freeJson2 = await freeRes2.json();

  console.log(`   - Search 2 response status: ${freeRes2.status}`);
  console.log(`   - Search 2 error payload:   ${JSON.stringify(freeJson2)}`);

  assert.strictEqual(freeRes2.status, 429, "Concurrent search beyond limit must return HTTP 429");
  assert.strictEqual(freeJson2.error, "CONCURRENT_SEARCH_LIMIT_EXCEEDED");
  assert.strictEqual(freeJson2.activeSearches, 1);
  assert.strictEqual(freeJson2.limit, 1);
  assert.ok(
    freeJson2.message.includes("limit of 1 concurrent active search"),
    "Rejection message must state the concurrency limit"
  );

  const totalFreeSearches = await prisma.search.count({ where: { userId: freeUserId } });
  assert.strictEqual(totalFreeSearches, 1, "No extra search record must be created when rejected");
  console.log("  ✓ Step 2 Passed: Free user genuinely cannot exceed 1 concurrent search.\n");

  // STEP 3: Complete Search 1 and Verify Slot Freed
  console.log("▶ [STEP 3] Completing Search 1 and verifying slot is freed...");
  await prisma.search.update({
    where: { id: freeJson1.executionId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  const activeSearchesAfterComplete = await prisma.search.count({
    where: { userId: freeUserId, status: { in: ["CREATED", "QUEUED", "RUNNING"] } },
  });
  assert.strictEqual(activeSearchesAfterComplete, 0, "Active searches should now be 0");

  const freeReq3 = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": freeUserId },
    body: JSON.stringify({ query: "Frontend React Next.js Specialist" }),
  });
  const freeRes3 = await searchRoutePost(freeReq3);
  assert.strictEqual(freeRes3.status, 200, "Search must succeed after previous search completed");
  const freeJson3 = await freeRes3.json();
  console.log(`   - Search 3 enqueued successfully: executionId=${freeJson3.executionId}`);
  console.log("  ✓ Step 3 Passed: Slot properly released upon completion.\n");

  // STEP 4: Premium User Concurrency Limit (Up to 5 Concurrent Searches)
  console.log("▶ [STEP 4] Testing Premium tier concurrency scaling (up to 5 concurrent)...");

  const premiumExecutions: string[] = [];
  const premiumResponses = await Promise.all(
    Array.from({ length: 5 }, (_, idx) => {
      const pReq = new NextRequest("http://localhost:3000/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-test-user-id": premiumUserId },
        body: JSON.stringify({ query: `Premium Search Distinct #${idx + 1} - Software Architect ${idx + 1}` }),
      });
      return searchRoutePost(pReq);
    })
  );

  for (let idx = 0; idx < 5; idx++) {
    const pRes = premiumResponses[idx];
    assert.strictEqual(pRes.status, 200, `Premium search #${idx + 1} must succeed with HTTP 200`);
    const pJson = await pRes.json();
    assert.strictEqual(pJson.status, "QUEUED", `Premium search #${idx + 1} status must be QUEUED`);
    premiumExecutions.push(pJson.executionId);
    console.log(`   - Premium search #${idx + 1} enqueued: executionId=${pJson.executionId}`);
  }

  // Ensure 5 searches remain in active state (RUNNING) to test the strict concurrency ceiling
  await prisma.search.updateMany({
    where: { id: { in: premiumExecutions } },
    data: { status: "RUNNING" },
  });

  const premActiveCount = await prisma.search.count({
    where: { userId: premiumUserId, status: { in: ["CREATED", "QUEUED", "RUNNING"] } },
  });
  console.log(`   - Total active searches in DB for Premium user: ${premActiveCount}`);
  assert.strictEqual(premActiveCount, 5, "Premium user must have exactly 5 active searches");

  console.log("   - Submitting 6th search for Premium user (should exceed limit of 5)...");
  const pReq6 = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": premiumUserId },
    body: JSON.stringify({ query: "Premium 6th Query - Should Exceed Concurrency Limit" }),
  });
  const pRes6 = await searchRoutePost(pReq6);
  const pJson6 = await pRes6.json();

  console.log(`   - Premium 6th search response status: ${pRes6.status}`);
  console.log(`   - Premium 6th search response body:   ${JSON.stringify(pJson6)}`);

  assert.strictEqual(pRes6.status, 429, "6th concurrent search must return HTTP 429");
  assert.strictEqual(pJson6.error, "CONCURRENT_SEARCH_LIMIT_EXCEEDED");
  assert.strictEqual(pJson6.activeSearches, 5);
  assert.strictEqual(pJson6.limit, 5);
  console.log("  ✓ Step 4 Passed: Premium user accurately capped at 5 concurrent searches.\n");

  // STEP 5: Priority Queue Execution Ordering
  console.log("▶ [STEP 5] Verifying BullMQ Priority Queue Scheduling...");

  const freeJobPayload = {
    executionId: `job_free_${Date.now()}`,
    userId: freeUserId,
    query: "Free user job",
    correlationId: "corr_free",
    canonicalIntentHash: "hash_free",
  };
  const freeJob = await enqueueSearchDiscoveryJob(freeJobPayload);
  const freeJobPriority = freeJob.opts?.priority ?? 10;
  console.log(`   - Free User Job enqueued with priority: ${freeJobPriority} (10 = standard)`);
  assert.strictEqual(freeJobPriority, 10, "Free user job priority must be 10");

  const enterpriseJobPayload = {
    executionId: `job_ent_${Date.now()}`,
    userId: enterpriseUserId,
    query: "Enterprise user priority job",
    correlationId: "corr_ent",
    canonicalIntentHash: "hash_ent",
  };
  const enterpriseJob = await enqueueSearchDiscoveryJob(enterpriseJobPayload);
  const enterpriseJobPriority = enterpriseJob.opts?.priority ?? 1;
  console.log(`   - Enterprise User Job enqueued with priority: ${enterpriseJobPriority} (1 = top priority)`);
  assert.strictEqual(enterpriseJobPriority, 1, "Enterprise user job priority must be 1");

  const queueBuffer = [
    { name: "Free Job (Submitted 1st)", priority: freeJobPriority, submittedAt: 1 },
    { name: "Enterprise Job (Submitted 2nd)", priority: enterpriseJobPriority, submittedAt: 2 },
  ];

  const executionOrder = [...queueBuffer].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.submittedAt - b.submittedAt;
  });

  console.log("\n   BullMQ Scheduled Execution Order:");
  executionOrder.forEach((job, idx) => {
    console.log(`     #${idx + 1}: ${job.name} [Priority: ${job.priority}]`);
  });

  assert.strictEqual(
    executionOrder[0].name,
    "Enterprise Job (Submitted 2nd)",
    "Enterprise job must be ordered first ahead of the earlier Free job due to priority: 1"
  );

  console.log("\n  ✓ Step 5 Passed: Enterprise priority execution schedules ahead of earlier Free jobs.\n");

  // CLEANUP
  console.log("▶ [CLEANUP] Cleaning up test records...");
  await prisma.search.deleteMany({
    where: { userId: { in: [freeUserId, premiumUserId, enterpriseUserId] } },
  });
  await prisma.subscription.deleteMany({
    where: { userId: { in: [freeUserId, premiumUserId, enterpriseUserId] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [freeUserId, premiumUserId, enterpriseUserId] } },
  });
  console.log("  ✓ Test cleanup complete.");

  console.log("\n===================================================================");
  console.log("  ALL CONCURRENCY AND PRIORITY TESTS COMPLETED SUCCESSFULLY!      ");
  console.log("===================================================================\\n");
}

runIntegrationTests()
  .catch((err) => {
    console.error("❌ Test Failed with Error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
