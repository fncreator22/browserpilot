/**
 * §TDD INTEGRATION TEST: AI Token/Operations Quota Enforcement per Subscription Tier
 * 
 * Verifies:
 * 1. Free-tier user at 100 monthly operations is rejected with HTTP 429 and MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED.
 * 2. BYOK user with 100 operations bypasses the MONTHLY_AI_OPERATIONS quota.
 * 3. BYOK user STILL enforces MAX_CONCURRENT_SEARCHES (cannot exceed tier concurrency limit).
 * 4. Upgrading to PREMIUM (2,500 operations) unblocks the platform-metered user.
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
} from "@/lib/billing/entitlementService";
import { POST as searchRoutePost } from "@/app/api/search/route";

export async function runMonthlyAiQuotaEnforcementTest() {
  console.log("===================================================================");
  console.log("  AI TOKEN & MONTHLY OPERATIONS QUOTA ENFORCEMENT TDD TEST         ");
  console.log("===================================================================\n");

  // Step 0: Ensure default plan capabilities are seeded
  console.log("▶ [STEP 0] Seeding default PlanCapability records...");
  await seedDefaultPlanCapabilities();

  const freePlan = await prisma.plan.findUnique({ where: { code: "FREE" } });
  const premiumPlan = await prisma.plan.findUnique({ where: { code: "PREMIUM" } });
  assert.ok(freePlan, "FREE plan must exist");
  assert.ok(premiumPlan, "PREMIUM plan must exist");

  const ts = Date.now();
  const freeUserId = `test_quota_free_${ts}`;
  const byokUserId = `test_quota_byok_${ts}`;

  await prisma.user.createMany({
    data: [
      { id: freeUserId, email: `${freeUserId}@test.com`, name: "Free Tier User", passwordHash: "h" },
      { id: byokUserId, email: `${byokUserId}@test.com`, name: "BYOK Free User", passwordHash: "h", geminiApiKey: "AIzaSyTestKey_BYOK_12345" },
    ],
  });

  // STEP 1: Simulate Free-tier user who has already used 100 operations this month
  console.log("▶ [STEP 1] Seeding 100 AIUsageEvent records for Free-tier user...");
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const usageRecords = Array.from({ length: 100 }, (_, i) => ({
    userId: freeUserId,
    provider: "GEMINI",
    model: "gemini-2.5-flash",
    operation: "INTENT_EXTRACTION",
    inputTokens: 150,
    outputTokens: 50,
    totalTokens: 200,
    durationMs: 120,
    status: "SUCCESS",
    timestamp: new Date(startOfMonth.getTime() + (i + 1) * 60000),
  }));

  await prisma.aIUsageEvent.createMany({ data: usageRecords });

  const currentCount = await prisma.aIUsageEvent.count({
    where: { userId: freeUserId, timestamp: { gte: startOfMonth } },
  });
  console.log(`  ✓ Confirmed ${currentCount} AIUsageEvents recorded for user ${freeUserId}`);
  assert.strictEqual(currentCount, 100, "Must have exactly 100 usage events");

  // Attempt search when quota is exhausted
  console.log("▶ [STEP 1b] Attempting new search as Free-tier user at 100/100 limit...");
  const reqFree = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": freeUserId,
      "x-test-user-id": freeUserId,
    },
    body: JSON.stringify({
      query: "fullstack engineer in remote in last 7 days",
      verifyEvidence: false,
    }),
  });

  const resFree = await searchRoutePost(reqFree);
  console.log(`  Route response status: ${resFree.status}`);
  const bodyFree = (await resFree.json()) as any;
  console.log("  Route response body:", bodyFree);

  assert.strictEqual(
    resFree.status,
    429,
    `Expected HTTP 429 when quota exceeded, got ${resFree.status}`
  );
  assert.strictEqual(
    bodyFree.error,
    "QUOTA_EXCEEDED",
    `Expected error 'QUOTA_EXCEEDED', got '${bodyFree.error}'`
  );
  assert.strictEqual(
    bodyFree.code,
    "MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED",
    `Expected code 'MONTHLY_AI_OPERATIONS_LIMIT_EXCEEDED', got '${bodyFree.code}'`
  );
  assert.strictEqual(bodyFree.limit, 100, "Limit in response must equal 100");
  assert.strictEqual(bodyFree.currentUsage, 100, "Current usage in response must equal 100");
  assert.ok(bodyFree.upgradeUrl, "Must provide upgradeUrl in response");
  console.log("  ✓ Successfully blocked Free-tier user at 100 monthly operations cap with 429 response!");

  // STEP 2: Verify BYOK user with 100 operations bypasses the monthly AI quota
  console.log("\n▶ [STEP 2] Seeding 100 AIUsageEvent records for BYOK user...");
  const byokUsageRecords = Array.from({ length: 100 }, (_, i) => ({
    userId: byokUserId,
    provider: "GEMINI_BYOK",
    model: "gemini-2.5-flash",
    operation: "INTENT_EXTRACTION",
    inputTokens: 150,
    outputTokens: 50,
    totalTokens: 200,
    durationMs: 120,
    status: "SUCCESS",
    timestamp: new Date(startOfMonth.getTime() + (i + 1) * 60000),
  }));

  await prisma.aIUsageEvent.createMany({ data: byokUsageRecords });

  console.log("▶ [STEP 2b] Attempting search as BYOK user (should bypass monthly quota)...");
  const reqByok = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": byokUserId,
      "x-test-user-id": byokUserId,
    },
    body: JSON.stringify({
      query: "ai researcher in bengaluru in last 14 days",
      verifyEvidence: false,
    }),
  });

  const resByok = await searchRoutePost(reqByok);
  console.log(`  BYOK search response status: ${resByok.status}`);
  const bodyByok = (await resByok.json()) as any;
  assert.ok(
    resByok.status === 200 || resByok.status === 202,
    `Expected 200 or 202 for BYOK user bypassing quota, got ${resByok.status}: ${JSON.stringify(bodyByok)}`
  );
  console.log("  ✓ Confirmed: BYOK user operations do NOT get blocked by monthly platform quota!");

  // STEP 3: Confirm BYOK user STILL enforces MAX_CONCURRENT_SEARCHES
  console.log("\n▶ [STEP 3] Verifying BYOK user still enforces MAX_CONCURRENT_SEARCHES tier limit...");
  // Create an active running search for byok user
  await prisma.search.create({
    data: {
      userId: byokUserId,
      rawQuery: "active running search",
      status: "RUNNING",
    },
  });

  const reqByokConcurrent = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": byokUserId,
      "x-test-user-id": byokUserId,
    },
    body: JSON.stringify({
      query: "another search while one is running",
      verifyEvidence: false,
    }),
  });

  const resByokConcurrent = await searchRoutePost(reqByokConcurrent);
  console.log(`  BYOK concurrent search response status: ${resByokConcurrent.status}`);
  const bodyByokConcurrent = (await resByokConcurrent.json()) as any;
  assert.strictEqual(
    resByokConcurrent.status,
    429,
    `Expected 429 when BYOK user exceeds concurrent limit, got ${resByokConcurrent.status}`
  );
  assert.strictEqual(
    bodyByokConcurrent.error,
    "CONCURRENT_SEARCH_LIMIT_EXCEEDED",
    `Expected error 'CONCURRENT_SEARCH_LIMIT_EXCEEDED', got '${bodyByokConcurrent.error}'`
  );
  console.log("  ✓ Confirmed: BYOK user still strictly enforces MAX_CONCURRENT_SEARCHES!");

  // STEP 4: Upgrading to PREMIUM unblocks platform user
  console.log("\n▶ [STEP 4] Upgrading blocked platform user to PREMIUM plan...");
  await prisma.subscription.create({
    data: {
      userId: freeUserId,
      planId: premiumPlan.id,
      status: "ACTIVE",
      billingInterval: "MONTHLY",
      currentPeriodStart: new Date(Date.now() - 5 * 86400 * 1000),
      currentPeriodEnd: new Date(Date.now() + 25 * 86400 * 1000),
    },
  });

  const reqUpgraded = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": freeUserId,
      "x-test-user-id": freeUserId,
    },
    body: JSON.stringify({
      query: "fullstack engineer in remote in last 7 days",
      verifyEvidence: false,
    }),
  });

  const resUpgraded = await searchRoutePost(reqUpgraded);
  console.log(`  Upgraded user search response status: ${resUpgraded.status}`);
  assert.ok(
    resUpgraded.status === 200 || resUpgraded.status === 202,
    `Expected 200 or 202 for upgraded user, got ${resUpgraded.status}`
  );
  console.log("  ✓ Confirmed: Upgrading to PREMIUM unblocks user with higher (2,500) limit!");

  console.log("\n✓ [ALL TDD TESTS PASSED] Monthly AI operations quota and BYOK rules verified successfully!\n");
}

if (require.main === module) {
  runMonthlyAiQuotaEnforcementTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
