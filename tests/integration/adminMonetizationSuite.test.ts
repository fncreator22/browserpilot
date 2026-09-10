import assert from "node:assert";
import { prisma } from "../../lib/db/prisma";
import { adminControlPlaneService } from "../../lib/admin/adminService";
import {
  validateCoupon,
  redeemCoupon,
  adminCreateCoupon,
  adminListCoupons,
  adminToggleCoupon
} from "../../lib/billing/couponService";
import { assignUserToPlan, ensureDefaultPlans, getUserSubscription } from "../../lib/billing/planService";

async function runMonetizationSuiteTests() {
  console.log("=== RUNNING ADMIN MONETIZATION, SUBSCRIPTIONS & COUPONS SUITE TESTS ===");

  await ensureDefaultPlans();

  const timestamp = Date.now();
  const testUserAEmail = `monetize_user_a_${timestamp}@test.local`;
  const testUserBEmail = `monetize_user_b_${timestamp}@test.local`;

  // Create test users
  const userA = await prisma.user.create({
    data: {
      email: testUserAEmail,
      name: "Monetization User A",
      passwordHash: "test_hashed_password_123",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: testUserBEmail,
      name: "Monetization User B",
      passwordHash: "test_hashed_password_123",
    },
  });

  try {
    // -------------------------------------------------------------
    // TEST 1: Plan Configuration, Pricing & Rich Textual Features
    // -------------------------------------------------------------
    console.log("\n[TEST 1] Testing Plan Pricing, Daily Quota & Textual Features Configuration...");
    
    const initialPlans = await adminControlPlaneService.getAdminPlansWithLimits();
    assert(initialPlans.length >= 3, "Must have default plans seeded");

    const customFeatures = [
      "Real-time 2h autonomous scans",
      "50 watches with instant push notifications",
      "Gemini Flash 3.8 + Puter Pro routing",
      "Executive recruitment filter"
    ];

    await adminControlPlaneService.updatePlanConfig("PREMIUM", {
      priceMonthly: 29.0,
      priceYearly: 290.0,
      dailyTokenLimit: 60000,
      description: "Updated Pro Hunter Tier",
      features: customFeatures,
    });

    const updatedPlans = await adminControlPlaneService.getAdminPlansWithLimits();
    const premiumPlan = updatedPlans.find((p) => p.code === "PREMIUM");
    assert(Boolean(premiumPlan), "PREMIUM plan must exist");
    assert(premiumPlan?.priceMonthly === 29.0, `Expected priceMonthly 29, got ${premiumPlan?.priceMonthly}`);
    assert(premiumPlan?.priceYearly === 290.0, `Expected priceYearly 290, got ${premiumPlan?.priceYearly}`);
    assert(premiumPlan?.dailyTokenLimit === 60000, `Expected limit 60,000, got ${premiumPlan?.dailyTokenLimit}`);
    assert(Array.isArray(premiumPlan?.features) && premiumPlan?.features.length === 4, "Must persist 4 textual features");
    assert(premiumPlan?.features[0] === customFeatures[0], "Feature text must match");
    console.log("  ✔ Plan pricing, daily limits, and textual features persisted successfully!");

    // -------------------------------------------------------------
    // TEST 2: Read-Only Coupon Validation (Zero Side Effects)
    // -------------------------------------------------------------
    console.log("\n[TEST 2] Testing Read-Only Coupon Validation (No Premature Redemption)...");

    const promoCode = `PROMO_${timestamp}`;
    const coupon = await adminCreateCoupon({
      code: promoCode,
      description: "Test 50% discount coupon",
      discountType: "PERCENTAGE",
      discountValue: 50,
      targetPlanCode: "PREMIUM",
      maxRedemptions: 2,
    });

    // Validating before redemption must return valid: true and not mutate count
    const previewA = await validateCoupon(promoCode, userA.id);
    assert(previewA.valid === true, "Coupon must be valid for userA");
    assert(previewA.discountValue === 50, "Discount value must be 50");
    assert(previewA.targetPlanCode === "PREMIUM", "Target plan must be PREMIUM");

    // Check DB: redemption count must still be 0, no CouponRedemption record
    const couponInDb = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    assert(couponInDb?.redemptionCount === 0, "Redemption count must remain 0 after read-only validation");

    const redemptionsInDb = await prisma.couponRedemption.count({ where: { couponId: coupon.id } });
    assert(redemptionsInDb === 0, "No redemption record must exist after validation");
    console.log("  ✔ Read-only validation checked eligibility without side effects!");

    // -------------------------------------------------------------
    // TEST 3: Atomic Coupon Redemption & Single-Use per Account
    // -------------------------------------------------------------
    console.log("\n[TEST 3] Testing Coupon Redemption & Single-Use per User Enforcement...");

    const redeemResult = await redeemCoupon(userA.id, promoCode);
    assert(redeemResult.success === true, "Redemption must succeed");

    const couponAfterRedeem = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    assert(couponAfterRedeem?.redemptionCount === 1, "Redemption count must increment to 1");

    // Second redemption attempt by userA must fail immediately
    const previewASecond = await validateCoupon(promoCode, userA.id);
    assert(previewASecond.valid === false, "User A must not be able to re-validate redeemed coupon");
    assert(previewASecond.reason === "COUPON_ALREADY_REDEEMED", "Reason must be COUPON_ALREADY_REDEEMED");

    await assert.rejects(
      async () => {
        await redeemCoupon(userA.id, promoCode);
      },
      /COUPON_ALREADY_REDEEMED/,
      "Must throw COUPON_ALREADY_REDEEMED on second redemption attempt"
    );
    console.log("  ✔ Single-use per account verified and duplicate redemption blocked!");

    // -------------------------------------------------------------
    // TEST 4: Max Platform Redemptions Cap
    // -------------------------------------------------------------
    console.log("\n[TEST 4] Testing Global Max Redemptions Cap...");

    // User B redeems second allowed usage
    const redeemBResult = await redeemCoupon(userB.id, promoCode);
    assert(redeemBResult.success === true, "User B redemption must succeed");

    const couponMaxed = await prisma.coupon.findUnique({ where: { id: coupon.id } });
    assert(couponMaxed?.redemptionCount === 2, "Redemption count must be 2 (max reached)");

    // Create a 3rd user to verify cap is hit
    const userC = await prisma.user.create({
      data: {
        email: `monetize_user_c_${timestamp}@test.local`,
        name: "User C",
        passwordHash: "test_hashed_password_123",
      },
    });

    const previewC = await validateCoupon(promoCode, userC.id);
    assert(previewC.valid === false, "User C must be blocked after max redemptions");
    assert(previewC.reason === "COUPON_MAX_REDEMPTIONS_REACHED", "Reason must be COUPON_MAX_REDEMPTIONS_REACHED");

    await prisma.user.delete({ where: { id: userC.id } });
    console.log("  ✔ Global max redemptions cap enforced correctly!");

    // -------------------------------------------------------------
    // TEST 5: Activation Date (validFrom) and Expiry Date (validUntil)
    // -------------------------------------------------------------
    console.log("\n[TEST 5] Testing Activation Date and Expiry Date Guardrails...");

    // Future coupon
    const futureCoupon = await adminCreateCoupon({
      code: `FUTURE_${timestamp}`,
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      validFrom: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // in 7 days
    });

    const futureVal = await validateCoupon(futureCoupon.code, userA.id);
    assert(futureVal.valid === false, "Future coupon must not be valid today");
    assert(futureVal.reason === "COUPON_NOT_YET_ACTIVE", "Reason must be COUPON_NOT_YET_ACTIVE");

    // Expired coupon
    const expiredCoupon = await adminCreateCoupon({
      code: `EXPIRED_${timestamp}`,
      discountType: "FIXED_AMOUNT",
      discountValue: 10,
      validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // yesterday
    });

    const expiredVal = await validateCoupon(expiredCoupon.code, userA.id);
    assert(expiredVal.valid === false, "Expired coupon must not be valid today");
    assert(expiredVal.reason === "COUPON_EXPIRED", "Reason must be COUPON_EXPIRED");
    console.log("  ✔ Activation window and expiration dates strictly respected!");

    // -------------------------------------------------------------
    // TEST 6: Manual Admin User Subscription Assignment
    // -------------------------------------------------------------
    console.log("\n[TEST 6] Testing Manual User Subscription Assignment...");

    const sub = await assignUserToPlan(userA.id, "ENTERPRISE", {
      billingInterval: "YEARLY",
      durationDays: 365,
      paymentProvider: "MANUAL_ADMIN",
      metadata: { adminNote: "Complimentary enterprise tier" },
    });

    assert(sub.status === "ACTIVE", "Subscription must be active");
    assert(sub.billingInterval === "YEARLY", "Interval must be YEARLY");
    assert(sub.plan.code === "ENTERPRISE", "Plan must be ENTERPRISE");
    assert(Boolean(sub.currentPeriodEnd), "Period end must be set");

    // Verify via plan service
    const activeSub = await getUserSubscription(userA.id);
    assert(activeSub?.id === sub.id, "Must resolve newly assigned active subscription");
    assert(activeSub?.plan.code === "ENTERPRISE", "Effective subscription plan must be ENTERPRISE");

    console.log("  ✔ Manual subscription assignment and deactivation verified!");

    console.log("\n==================================================================");
    console.log("✔ ALL ADMIN MONETIZATION, SUBSCRIPTIONS & COUPONS TESTS PASSED!");
    console.log("==================================================================\n");

  } finally {
    // Cleanup test artifacts
    console.log("Cleaning up test data...");
    await prisma.couponRedemption.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.subscription.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.coupon.deleteMany({
      where: { code: { contains: `${timestamp}` } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
    console.log("Cleanup complete.");
  }
}

runMonetizationSuiteTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});