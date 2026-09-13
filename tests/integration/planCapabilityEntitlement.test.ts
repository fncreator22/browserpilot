import assert from "node:assert";
import { prisma } from "../../lib/db/prisma";
import {
  hasCapability,
  checkCapabilityEntitlement,
  setPlanCapability,
  seedDefaultPlanCapabilities,
  getPlanCapabilities,
} from "../../lib/billing/entitlementService";
import { ensureDefaultPlans } from "../../lib/billing/planService";
import { checkFeatureEntitlement } from "../../lib/ai/governance/providerGovernance";

export async function runPlanCapabilityEntitlementTests() {
  console.log("\n=================================================================");
  console.log("  PLANCAPABILITY MODEL & UNIFIED ENTITLEMENT TEST SUITE          ");
  console.log("=================================================================\n");

  const testRunId = `cap_test_${Date.now()}`;
  let freeUserId = "";
  let premiumUserId = "";

  try {
    // -------------------------------------------------------------
    // Setup: Seed plans & capabilities, create isolated test users
    // -------------------------------------------------------------
    console.log("[1/6] Ensuring default plans and seeding baseline PlanCapability rows...");
    await ensureDefaultPlans();
    await seedDefaultPlanCapabilities();

    const freeUser = await prisma.user.create({
      data: {
        email: `${testRunId}_free@example.com`,
        name: "Test Free User",
        role: "USER",
        passwordHash: "test_dummy_hash_123",
      },
    });
    freeUserId = freeUser.id;

    const premiumPlan = await prisma.plan.findUniqueOrThrow({
      where: { code: "PREMIUM" },
    });

    const premiumUser = await prisma.user.create({
      data: {
        email: `${testRunId}_prem@example.com`,
        name: "Test Premium User",
        role: "USER",
        passwordHash: "test_dummy_hash_123",
      },
    });
    premiumUserId = premiumUser.id;

    await prisma.subscription.create({
      data: {
        userId: premiumUser.id,
        planId: premiumPlan.id,
        status: "ACTIVE",
        billingInterval: "MONTHLY",
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
    });
    console.log("  ✓ Test users created: Free (" + freeUserId + "), Premium (" + premiumUserId + ")");

    // -------------------------------------------------------------
    // Test 1: Verify seeded rows reflecting Plan.supportsX & CSV_EXPORT
    // -------------------------------------------------------------
    console.log("\n[2/6] Verifying seeded capabilities on FREE and PREMIUM tiers...");
    const freeCaps = await getPlanCapabilities("FREE");
    const premCaps = await getPlanCapabilities("PREMIUM");

    assert(freeCaps.length >= 5, "FREE tier should have at least 5 seeded capabilities");
    assert(premCaps.length >= 5, "PREMIUM tier should have at least 5 seeded capabilities");

    const freeCsv = freeCaps.find((c) => c.capabilityKey === "CSV_EXPORT");
    const premCsv = premCaps.find((c) => c.capabilityKey === "CSV_EXPORT");

    assert(freeCsv, "CSV_EXPORT should be seeded for FREE");
    assert.strictEqual(freeCsv.enabled, false, "CSV_EXPORT must be DISABLED on FREE tier");

    assert(premCsv, "CSV_EXPORT should be seeded for PREMIUM");
    assert.strictEqual(premCsv.enabled, true, "CSV_EXPORT must be ENABLED on PREMIUM tier");
    console.log("  ✓ Seeded capabilities match expected baseline and proof capability CSV_EXPORT");

    // -------------------------------------------------------------
    // Test 2: Explicit PlanCapability check via hasCapability
    // -------------------------------------------------------------
    console.log("\n[3/6] Testing hasCapability and checkCapabilityEntitlement resolution...");
    const freeCanExport = await hasCapability(freeUserId, "CSV_EXPORT");
    const premCanExport = await hasCapability(premiumUserId, "CSV_EXPORT");

    assert.strictEqual(freeCanExport, false, "Free user must not have CSV_EXPORT");
    assert.strictEqual(premCanExport, true, "Premium user must have CSV_EXPORT");

    const freeDetail = await checkCapabilityEntitlement(freeUserId, "CSV_EXPORT");
    assert.strictEqual(freeDetail.source, "EXPLICIT_ROW");
    assert.strictEqual(freeDetail.allowed, false);
    assert.strictEqual(freeDetail.planCode, "FREE");

    const premDetail = await checkCapabilityEntitlement(premiumUserId, "CSV_EXPORT");
    assert.strictEqual(premDetail.source, "EXPLICIT_ROW");
    assert.strictEqual(premDetail.allowed, true);
    assert.strictEqual(premDetail.planCode, "PREMIUM");
    console.log("  ✓ Explicit rows correctly grant or deny access based on plan tier");

    // -------------------------------------------------------------
    // Test 3: Legacy column fallback when explicit row is absent
    // -------------------------------------------------------------
    console.log("\n[4/6] Testing legacy column fallback order (supportsCompanyTargeting)...");
    const freePlan = await prisma.plan.findUniqueOrThrow({ where: { code: "FREE" } });
    await prisma.planCapability.deleteMany({
      where: { planId: freePlan.id, capabilityKey: "COMPANY_TARGETING" },
    });

    const fallbackCheck = await checkCapabilityEntitlement(freeUserId, "COMPANY_TARGETING");
    assert.strictEqual(fallbackCheck.source, "LEGACY_COLUMN", "Source must be LEGACY_COLUMN when row is absent");
    assert.strictEqual(fallbackCheck.allowed, false, "FREE plan supportsCompanyTargeting is false");

    // Restore seeded row
    await seedDefaultPlanCapabilities();
    console.log("  ✓ Legacy column fallback functions seamlessly when no explicit row exists");

    // -------------------------------------------------------------
    // Test 4: Genuinely NEW capability key -> STRICT DEFAULT-DENY
    // -------------------------------------------------------------
    console.log("\n[5/6] Testing STRICT DEFAULT-DENY for genuinely new / unseen capability key...");
    const unknownCapabilityKey = "GENUINELY_NEW_UNSEEN_CAPABILITY_XYZ";

    const freeNewCap = await checkCapabilityEntitlement(freeUserId, unknownCapabilityKey);
    assert.strictEqual(freeNewCap.allowed, false, "CRITICAL: New unseen capability MUST be denied for FREE");
    assert.strictEqual(freeNewCap.source, "DEFAULT_DENIED", "Source must be DEFAULT_DENIED");
    assert(freeNewCap.reason?.includes("Defaulting to denied"), "Reason must specify default denial");

    const premNewCap = await checkCapabilityEntitlement(premiumUserId, unknownCapabilityKey);
    assert.strictEqual(premNewCap.allowed, false, "CRITICAL: New unseen capability MUST be denied for PREMIUM");
    assert.strictEqual(premNewCap.source, "DEFAULT_DENIED", "Source must be DEFAULT_DENIED");
    assert(premNewCap.reason?.includes("Defaulting to denied"), "Reason must specify default denial");

    const freeBool = await hasCapability(freeUserId, unknownCapabilityKey);
    const premBool = await hasCapability(premiumUserId, unknownCapabilityKey);
    assert.strictEqual(freeBool, false, "hasCapability must return false for unseen key on FREE");
    assert.strictEqual(premBool, false, "hasCapability must return false for unseen key on PREMIUM");
    console.log("  ✓ STRICT DEFAULT-DENY VERIFIED: Unknown keys return false with source DEFAULT_DENIED");

    // -------------------------------------------------------------
    // Test 5: End-to-end Admin Toggle & Provider Governance Forwarding
    // -------------------------------------------------------------
    console.log("\n[6/6] Testing End-to-End Admin Toggle and Provider Governance forwarding...");
    const proofToggleKey = `EXPERIMENTAL_RADAR_${Date.now()}`;

    // Step a: Initially denied for everyone (strict default-deny)
    assert.strictEqual(await hasCapability(freeUserId, proofToggleKey), false);
    assert.strictEqual(await hasCapability(premiumUserId, proofToggleKey), false);

    // Step b: Admin activates capability for PREMIUM tier
    console.log("  Enabling " + proofToggleKey + " on PREMIUM tier via admin setPlanCapability...");
    await setPlanCapability("PREMIUM", proofToggleKey, true, 100);

    // Step c: Verify PREMIUM now has access while FREE remains denied
    const premCheckAfterToggle = await checkCapabilityEntitlement(premiumUserId, proofToggleKey);
    assert.strictEqual(premCheckAfterToggle.allowed, true, "Premium user must now have access");
    assert.strictEqual(premCheckAfterToggle.source, "EXPLICIT_ROW");
    assert.strictEqual(premCheckAfterToggle.limitValue, 100);

    const freeCheckAfterToggle = await checkCapabilityEntitlement(freeUserId, proofToggleKey);
    assert.strictEqual(freeCheckAfterToggle.allowed, false, "Free user must still be denied");
    assert.strictEqual(freeCheckAfterToggle.source, "DEFAULT_DENIED");

    // Step d: Check providerGovernance forwarding
    const govCheckFree = await checkFeatureEntitlement(freeUserId, proofToggleKey);
    assert.strictEqual(govCheckFree.allowed, false, "Governance check for FREE must be denied");

    const govCheckPrem = await checkFeatureEntitlement(premiumUserId, proofToggleKey);
    assert.strictEqual(govCheckPrem.allowed, true, "Governance check for PREMIUM must be allowed");
    assert.strictEqual(govCheckPrem.plan, "PREMIUM");
    console.log("  ✓ Admin toggle dynamically enables capability; providerGovernance forwarded cleanly");

    console.log("\n=================================================================");
    console.log("  ALL PLANCAPABILITY & ENTITLEMENT TESTS PASSED (6/6)            ");
    console.log("=================================================================\n");
  } finally {
    // Teardown
    if (freeUserId) {
      await prisma.user.delete({ where: { id: freeUserId } }).catch(() => {});
    }
    if (premiumUserId) {
      await prisma.subscription.deleteMany({ where: { userId: premiumUserId } }).catch(() => {});
      await prisma.user.delete({ where: { id: premiumUserId } }).catch(() => {});
    }
  }
}

// Allow direct execution via tsx
if (process.argv[1]?.includes("planCapabilityEntitlement.test")) {
  runPlanCapabilityEntitlementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ Test Suite Failed:", err);
      process.exit(1);
    });
}
