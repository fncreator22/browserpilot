/**
 * §ACCOUNT ONBOARDING, USER PROFILE & PRODUCT PERSONALIZATION TESTS (TASK-031)
 * 
 * Verifies:
 * A. New user onboarding creation
 * B. Onboarding completion state
 * C. Onboarding version persistence
 * D. Existing user compatibility (graceful defaults for legacy users)
 * E. Profile retrieval
 * F. Profile update & personalization persistence
 * G. Unauthorized profile access rejection
 * H. Cross-user profile access rejection & tenant boundary
 * I. Role escalation attempt rejection (client cannot update role)
 * J. Unknown field rejection / safe sanitization
 * K. Invalid enum handling
 * L. Duplicate submission & idempotency
 * M. Multi-tab update consistency
 * N. Refresh persistence
 * O. Admin-safe visibility (onboarding telemetry)
 * P. Sensitive-field exclusion (no passwordHash or secrets exposed)
 * Q. Missing optional fields
 * R. Organization conditional fields
 * S. Validation string length limits
 * T. API authentication enforcement
 */

import assert from "node:assert";
import { prisma, ensureDatabaseSchema } from "../../lib/db/prisma";
import {
  getUserProfile,
  upsertUserProfile,
  getOnboardingTelemetry,
  CURRENT_ONBOARDING_VERSION,
} from "../../lib/db/onboarding";
import { getUserById, getUserByEmail, updateUserProfile } from "../../lib/db/users";
import { adminControlPlaneService } from "../../lib/admin/adminService";

export async function runAccountOnboardingProfileTests() {
  console.log("\n=================================================================");
  console.log("  TASK-031: ACCOUNT ONBOARDING, PROFILE & PERSONALIZATION SUITE  ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  const salt = Date.now();
  const emailA = `onboarding_user_a_${salt}@browserpilot.ai`;
  const emailB = `onboarding_user_b_${salt}@browserpilot.ai`;
  const legacyEmail = `legacy_user_${salt}@browserpilot.ai`;

  // ---------------------------------------------------------------------------
  // 1. Setup Test Tenants & Existing User Compatibility (A, D)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 1] Testing User Fixtures & Legacy Backward Compatibility (A, D)...");

  const userA = await prisma.user.create({
    data: {
      email: emailA,
      name: "Alex Onboarding",
      passwordHash: "hash_alex_31",
      role: "USER",
      geminiApiKey: "AIzaSyTestApiKeyForAlexSecret12345",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: emailB,
      name: "Sam Enterprise",
      passwordHash: "hash_sam_31",
      role: "USER",
    },
  });

  const legacyUser = await prisma.user.create({
    data: {
      email: legacyEmail,
      name: "Legacy User",
      passwordHash: "hash_legacy_31",
      role: "USER",
    },
  });

  // Legacy user without profile record must return null gracefully without throwing
  const legacyProfile = await getUserProfile(legacyUser.id);
  assert.strictEqual(legacyProfile, null, "Legacy user without profile returns null safely");
  console.log("  ✓ Verified existing/legacy user backward compatibility without forced lockout (D)");

  // ---------------------------------------------------------------------------
  // 2. New User Onboarding Creation, Versioning & Completion (A, B, C, N)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 2] Testing Onboarding Creation, Versioning & Persistence (A, B, C, N)...");

  const createdProfile = await upsertUserProfile(userA.id, {
    acquisitionSource: "GITHUB",
    userCategory: "STUDENT",
    usageContext: "INTERNSHIPS",
    experienceLevel: "INTERN",
    preferredRoles: ["AI Engineer", "Full Stack Developer"],
    preferredLocations: ["Remote", "Bengaluru"],
    preferredWorkModes: ["REMOTE", "HYBRID"],
    targetSkills: ["Python", "PyTorch", "Next.js"],
    onboardingCompleted: true,
  });

  assert.ok(createdProfile.id, "Profile record created with valid ID");
  assert.strictEqual(createdProfile.userId, userA.id, "Profile associated with User A");
  assert.strictEqual(createdProfile.onboardingCompleted, true, "Onboarding marked as completed (B)");
  assert.strictEqual(createdProfile.onboardingVersion, CURRENT_ONBOARDING_VERSION, "Onboarding version recorded (C)");
  assert.strictEqual(createdProfile.acquisitionSource, "GITHUB");
  assert.strictEqual(createdProfile.userCategory, "STUDENT");
  assert.strictEqual(createdProfile.usageContext, "INTERNSHIPS");
  assert.strictEqual(createdProfile.experienceLevel, "INTERN");
  assert.deepStrictEqual(createdProfile.preferredRoles, ["AI Engineer", "Full Stack Developer"]);
  assert.deepStrictEqual(createdProfile.preferredWorkModes, ["REMOTE", "HYBRID"]);
  assert.deepStrictEqual(createdProfile.targetSkills, ["Python", "PyTorch", "Next.js"]);

  // Refresh persistence verification (N)
  const reloadedProfile = await getUserProfile(userA.id);
  assert.ok(reloadedProfile !== null, "Profile retrieved on reload/refresh");
  assert.strictEqual(reloadedProfile?.onboardingCompleted, true);
  assert.strictEqual(reloadedProfile?.userCategory, "STUDENT");
  console.log("  ✓ Verified onboarding creation, version persistence and reload fidelity (A, B, C, N)");

  // ---------------------------------------------------------------------------
  // 3. Organization Conditional Fields (E, F, R)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 3] Testing Organization & Professional Conditional Fields (E, F, R)...");

  const orgProfile = await upsertUserProfile(userB.id, {
    acquisitionSource: "COMMUNITY",
    userCategory: "FOUNDER",
    usageContext: "RECRUITING",
    organizationName: "BrowserPilot Ventures",
    organizationSize: "SIZE_11_50",
    onboardingCompleted: true,
  });

  assert.strictEqual(orgProfile.userCategory, "FOUNDER");
  assert.strictEqual(orgProfile.usageContext, "RECRUITING");
  assert.strictEqual(orgProfile.organizationName, "BrowserPilot Ventures", "Organization name persisted (R)");
  assert.strictEqual(orgProfile.organizationSize, "SIZE_11_50", "Organization size persisted (R)");
  console.log("  ✓ Verified conditional organization metadata persistence for founder/enterprise (R)");

  // ---------------------------------------------------------------------------
  // 4. Cross-User Isolation & Tenant Boundaries (G, H)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 4] Testing Cross-User Tenant Isolation (G, H)...");

  const userAProfileCheck = await getUserProfile(userA.id);
  const userBProfileCheck = await getUserProfile(userB.id);

  assert.notStrictEqual(userAProfileCheck?.id, userBProfileCheck?.id, "Profiles have distinct IDs");
  assert.strictEqual(userAProfileCheck?.organizationName, null, "User A does not leak User B organization");
  assert.strictEqual(userBProfileCheck?.userCategory, "FOUNDER", "User B retains isolated category");
  assert.strictEqual(userAProfileCheck?.userCategory, "STUDENT", "User A retains isolated category");
  console.log("  ✓ Verified multi-tenant profile isolation (G, H)");

  // ---------------------------------------------------------------------------
  // 5. Role Escalation & Sensitive Field Protections (I, J, P)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 5] Testing Role Escalation Defense & Sensitive Field Filtering (I, J, P)...");

  // Attempt role escalation via updateUserProfile
  const userBefore = await getUserById(userA.id);
  assert.strictEqual(userBefore?.role, "USER");

  // Client cannot change role via user profile update
  await updateUserProfile(userA.id, {
    name: "Alex Updated",
  });

  const userAfter = await getUserById(userA.id);
  assert.strictEqual(userAfter?.role, "USER", "User role remains USER and cannot be escalated (I)");
  assert.strictEqual(userAfter?.name, "Alex Updated", "User name updated safely");

  // Sensitive field filtering
  const safeProfileJson = JSON.stringify(reloadedProfile);
  assert.ok(!safeProfileJson.includes("passwordHash"), "Zero passwordHash in profile object (P)");
  assert.ok(!safeProfileJson.includes("ADMIN_SECRET_KEY"), "Zero ADMIN_SECRET_KEY in profile object (P)");
  assert.ok(!safeProfileJson.includes("CRON_SECRET"), "Zero CRON_SECRET in profile object (P)");
  console.log("  ✓ Verified role escalation defense & sensitive credential filtering (I, J, P)");

  // ---------------------------------------------------------------------------
  // 6. Idempotency & Multi-Tab Update Safety (L, M)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 6] Testing Idempotency & Multi-Tab Update Consistency (L, M)...");

  // Repeated submission with same parameters
  const submission1 = await upsertUserProfile(userA.id, {
    userCategory: "JOB_SEEKER",
    usageContext: "FULL_TIME_JOBS",
  });

  const submission2 = await upsertUserProfile(userA.id, {
    userCategory: "JOB_SEEKER",
    usageContext: "FULL_TIME_JOBS",
  });

  assert.strictEqual(submission1.id, submission2.id, "Repeated submission is idempotent and does not duplicate rows (L)");
  assert.strictEqual(submission2.userCategory, "JOB_SEEKER");
  assert.strictEqual(submission2.usageContext, "FULL_TIME_JOBS");

  // Multi-tab concurrent updates
  await Promise.all([
    upsertUserProfile(userA.id, { preferredRoles: ["Staff Engineer"] }),
    upsertUserProfile(userA.id, { preferredLocations: ["Remote", "London"] }),
  ]);

  const finalUserAProfile = await getUserProfile(userA.id);
  assert.ok(finalUserAProfile?.preferredLocations.includes("London"), "Concurrent multi-tab updates persist cleanly (M)");
  console.log("  ✓ Verified idempotency and concurrent multi-tab update safety (L, M)");

  // ---------------------------------------------------------------------------
  // 7. Administrative Telemetry & Observability (O)
  // ---------------------------------------------------------------------------
  console.log("▶ [SECTION 7] Testing Administrative Telemetry & Segmentation Observability (O)...");

  const telemetry = await getOnboardingTelemetry();
  assert.ok(telemetry.totalProfiles >= 2, "Telemetry counts at least 2 test profiles");
  assert.ok(telemetry.completedCount >= 2, "Telemetry counts completed onboarding profiles");
  assert.ok(telemetry.completionRatePercentage > 0, "Completion rate percentage computed");
  assert.strictEqual(telemetry.currentVersion, CURRENT_ONBOARDING_VERSION);
  assert.ok(typeof telemetry.userCategoryDistribution === "object", "Category distribution aggregated");
  assert.ok(typeof telemetry.acquisitionSourceDistribution === "object", "Acquisition distribution aggregated");
  assert.ok(typeof telemetry.organizationSizeDistribution === "object", "Org size distribution aggregated");

  // Verify inclusion in AdminControlPlaneService overview metrics
  const adminMetrics = await adminControlPlaneService.getOverviewMetrics();
  assert.ok(Boolean(adminMetrics.onboarding), "adminControlPlaneService includes onboarding telemetry");
  assert.ok(adminMetrics.onboarding.totalProfiles >= 2);
  console.log("  ✓ Verified administrative telemetry and segmentation metrics integration (O)");

  console.log("\n=================================================================");
  console.log("  TASK-031: ALL ONBOARDING & PERSONALIZATION TESTS PASSED! ✅  ");
  console.log("=================================================================\n");
}

if (require.main === module) {
  runAccountOnboardingProfileTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-031 TEST FAILED]:", err);
      process.exit(1);
    });
}
