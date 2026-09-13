/**
 * §TDD INTEGRATION TEST: Autonomous Watch Limits Enforcement per Subscription Tier
 * 
 * Verifies:
 * 1. Free-tier user creates 1st watch successfully (limit: 1).
 * 2. Free-tier user attempting to create a 2nd watch is genuinely rejected with HTTP 429
 *    and error code 'ACTIVE_WATCH_LIMIT_EXCEEDED'.
 * 3. Premium user can create up to 5 watches without issue (limit: 25).
 */

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";
(process.env as any).SKIP_RATE_LIMIT_FOR_TESTS = "true";

import assert from "assert";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { seedDefaultPlanCapabilities, getCapabilityLimit } from "@/lib/billing/entitlementService";
import { POST as watchPostRoute, GET as watchGetRoute } from "@/app/api/discovery/watch/route";

export async function runWatchLimitsEnforcementTest() {
  console.log("===================================================================");
  console.log("  AUTONOMOUS WATCH LIMITS ENFORCEMENT TDD TEST                     ");
  console.log("===================================================================\n");

  console.log("▶ [STEP 0] Seeding default PlanCapability records...");
  await seedDefaultPlanCapabilities();

  const freePlan = await prisma.plan.findUnique({ where: { code: "FREE" } });
  const premiumPlan = await prisma.plan.findUnique({ where: { code: "PREMIUM" } });
  assert.ok(freePlan, "FREE plan must exist");
  assert.ok(premiumPlan, "PREMIUM plan must exist");

  const ts = Date.now();
  const freeUserId = `test_watch_free_${ts}`;
  const premiumUserId = `test_watch_prem_${ts}`;

  await prisma.user.createMany({
    data: [
      { id: freeUserId, email: `${freeUserId}@test.com`, name: "Free Watch User", passwordHash: "h" },
      { id: premiumUserId, email: `${premiumUserId}@test.com`, name: "Prem Watch User", passwordHash: "h" },
    ],
  });

  // Assign Premium user an active subscription
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

  // Verify capability limits resolved via entitlement service
  const freeLimit = await getCapabilityLimit(freeUserId, "MAX_ACTIVE_WATCHES");
  const premLimit = await getCapabilityLimit(premiumUserId, "MAX_ACTIVE_WATCHES");
  console.log(`  Capability check -> Free limit: ${freeLimit}, Premium limit: ${premLimit}`);
  assert.strictEqual(freeLimit, 1, "Free tier limit must be 1 active watch");
  assert.strictEqual(premLimit, 25, "Premium tier limit must be 25 active watches");

  // STEP 1: Free user creates 1st watch -> Should succeed
  console.log("\n▶ [STEP 1] Free user creating 1st watch...");
  const reqWatch1 = new NextRequest("http://localhost:3000/api/discovery/watch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": freeUserId,
      "x-test-user-id": freeUserId,
    },
    body: JSON.stringify({
      name: "Frontend Roles Watch",
      roles: ["Frontend Engineer"],
      skills: ["React", "Next.js"],
      locations: ["Remote"],
      scanIntervalHours: 6,
      enabled: true,
    }),
  });

  const resWatch1 = await watchPostRoute(reqWatch1);
  console.log(`  Watch 1 creation response status: ${resWatch1.status}`);
  const bodyWatch1 = (await resWatch1.json()) as any;
  assert.ok(resWatch1.status === 200 || resWatch1.status === 201, `Expected 200 or 201, got ${resWatch1.status}`);
  assert.ok(bodyWatch1.watch, "Watch 1 must be created in response");
  console.log("  ✓ Free user successfully created 1st watch!");

  // STEP 2: Free user attempts to create 2nd watch -> MUST be rejected with HTTP 429
  console.log("\n▶ [STEP 2] Free user attempting to create 2nd watch (must be rejected)...");
  const reqWatch2 = new NextRequest("http://localhost:3000/api/discovery/watch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": freeUserId,
      "x-test-user-id": freeUserId,
    },
    body: JSON.stringify({
      name: "Backend Roles Watch",
      roles: ["Backend Engineer"],
      skills: ["Go", "Kubernetes"],
      locations: ["Bangalore"],
      scanIntervalHours: 6,
      enabled: true,
    }),
  });

  const resWatch2 = await watchPostRoute(reqWatch2);
  console.log(`  Watch 2 creation response status: ${resWatch2.status}`);
  const bodyWatch2 = (await resWatch2.json()) as any;
  console.log("  Watch 2 creation response body:", bodyWatch2);

  assert.strictEqual(
    resWatch2.status,
    429,
    `Expected HTTP 429 when Free user creates 2nd watch, got ${resWatch2.status}`
  );
  assert.strictEqual(
    bodyWatch2.error,
    "QUOTA_EXCEEDED",
    `Expected error 'QUOTA_EXCEEDED', got '${bodyWatch2.error}'`
  );
  assert.strictEqual(
    bodyWatch2.code,
    "ACTIVE_WATCH_LIMIT_EXCEEDED",
    `Expected code 'ACTIVE_WATCH_LIMIT_EXCEEDED', got '${bodyWatch2.code}'`
  );
  assert.strictEqual(bodyWatch2.limit, 1, "Limit must be 1 in response");
  assert.strictEqual(bodyWatch2.currentUsage, 1, "Current usage must be 1 in response");
  console.log("  ✓ Confirmed: Free user genuinely blocked at 1 active watch cap!");

  // STEP 3: Premium user creates up to 5 watches without issue
  console.log("\n▶ [STEP 3] Premium user creating 5 distinct watches sequentially...");
  for (let i = 1; i <= 5; i++) {
    const reqPrem = new NextRequest("http://localhost:3000/api/discovery/watch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-id": premiumUserId,
        "x-test-user-id": premiumUserId,
      },
      body: JSON.stringify({
        name: `Premium Target Watch #${i}`,
        roles: [`Role ${i}`],
        skills: [`Skill ${i}`],
        locations: ["Remote"],
        scanIntervalHours: 4,
        enabled: true,
      }),
    });

    const resPrem = await watchPostRoute(reqPrem);
    const bodyPrem = (await resPrem.json()) as any;
    assert.ok(
      resPrem.status === 200 || resPrem.status === 201,
      `Expected 200/201 for Premium watch #${i}, got ${resPrem.status}: ${JSON.stringify(bodyPrem)}`
    );
    assert.ok(bodyPrem.watch, `Watch #${i} should be returned in response`);
    console.log(`  ✓ Premium watch #${i} created successfully (id: ${bodyPrem.watch.id || 'ok'})`);
  }

  // Verify Premium user has exactly 5 active watches in DB
  const premActiveCount = await prisma.discoveryWatch.count({
    where: { userId: premiumUserId, enabled: true },
  });
  console.log(`  Total active watches in DB for Premium user: ${premActiveCount}`);
  assert.strictEqual(premActiveCount, 5, "Premium user must have exactly 5 active watches in DB");

  console.log("\n✓ [ALL WATCH LIMIT TESTS PASSED] Autonomous watch limits strictly enforced via PlanCapability!\n");
}

if (require.main === module) {
  runWatchLimitsEnforcementTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failed:", err);
      process.exit(1);
    });
}
