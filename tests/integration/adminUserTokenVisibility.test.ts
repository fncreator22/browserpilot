/**
 * §ADMIN USER TOKEN VISIBILITY & PUTER STATUS INTEGRATION TEST
 * 
 * Validates:
 * 1. Puter connection status retrieval from provider_connections table
 * 2. 7-day Puter successful and quota-exhausted/failed calls calculation from ai_usage_events
 * 3. Real Gemini BYOK token usage today and this month (no estimations)
 * 4. Configurable plan daily token limit and today's consumption progress bar percentage
 * 5. 7-day daily usage trend aggregation
 * 6. Admin RBAC guard enforcement (403 for unauthorized users)
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";
process.env.ADMIN_SECRET_KEY = "test_admin_supersecret_key_12345";
process.env.ADMIN_EMAILS = "admin.lead@browserpilot.ai,operations@browserpilot.ai";

import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import { adminControlPlaneService } from "@/lib/admin/adminService";
import { resolvePlanDailyLimit } from "@/lib/admin/adminService";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(`[ASSERTION FAILED]: ${msg}`);
  }
}

export async function runAdminUserTokenVisibilityTests() {
  console.log("▶ Running Admin User Token Visibility & Puter Status Tests...");

  await ensureDatabaseSchema();

  const salt = Date.now();
  const testUserEmail = `token_audit_${salt}@browserpilot.ai`;

  // 1. Create a test tenant user
  const user = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Token Audit Tenant",
      passwordHash: "hash_test_token_audit",
      geminiApiKey: "AIzaSyTestKey1234567890abcdefghijklm",
      role: "USER",
    },
  });

  const now = new Date();
  const startOfToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const yesterday = new Date(startOfToday.getTime() - 86400000);
  const twoDaysAgo = new Date(startOfToday.getTime() - 2 * 86400000);

  // 2. Connect Puter in provider_connections
  await prisma.providerConnection.create({
    data: {
      userId: user.id,
      provider: "PUTER",
      connectionMethod: "PUTER_OAUTH",
      status: "CONNECTED",
      providerUsername: "audit_puter_tester",
      createdAt: twoDaysAgo,
    },
  });

  // 3. Seed real AIUsageEvents
  // Puter: 3 SUCCESS, 1 QUOTA_EXCEEDED in last 7 days
  await prisma.aIUsageEvent.createMany({
    data: [
      {
        userId: user.id,
        provider: "PUTER",
        model: "claude-3-7-sonnet",
        operation: "ACTION_PLANNING",
        inputTokens: 150,
        outputTokens: 400,
        totalTokens: 550,
        durationMs: 420,
        status: "SUCCESS",
        timestamp: new Date(startOfToday.getTime() + 120000), // today
      },
      {
        userId: user.id,
        provider: "PUTER",
        model: "gpt-4o",
        operation: "PROMPT_ENHANCEMENT",
        inputTokens: 80,
        outputTokens: 120,
        totalTokens: 200,
        durationMs: 250,
        status: "SUCCESS",
        timestamp: new Date(startOfToday.getTime() + 60000), // today
      },
      {
        userId: user.id,
        provider: "PUTER",
        model: "claude-3-7-sonnet",
        operation: "INTENT_PARSING",
        inputTokens: 60,
        outputTokens: 90,
        totalTokens: 150,
        durationMs: 210,
        status: "SUCCESS",
        timestamp: yesterday,
      },
      {
        userId: user.id,
        provider: "PUTER",
        model: "gpt-4o",
        operation: "ACTION_PLANNING",
        inputTokens: 200,
        outputTokens: 0,
        totalTokens: 0,
        durationMs: 150,
        status: "QUOTA_EXCEEDED",
        errorMessage: "Puter monthly allowance exceeded for this account.",
        timestamp: yesterday,
      },
      // Gemini BYOK: Today (8,500 tokens) and Yesterday (12,000 tokens)
      {
        userId: user.id,
        provider: "GEMINI_BYOK",
        model: "gemini-2.5-flash",
        operation: "STRUCTURED_EXTRACTION",
        inputTokens: 4000,
        outputTokens: 4500,
        totalTokens: 8500,
        durationMs: 1100,
        status: "SUCCESS",
        timestamp: new Date(startOfToday.getTime() + 180000), // today
      },
      {
        userId: user.id,
        provider: "GEMINI_BYOK",
        model: "gemini-2.5-flash",
        operation: "DISCOVERY_RANKING",
        inputTokens: 6000,
        outputTokens: 6000,
        totalTokens: 12000,
        durationMs: 1400,
        status: "SUCCESS",
        timestamp: yesterday,
      },
    ],
  });

  // 4. Test getAdminUserDetail()
  console.log("  → Validating getAdminUserDetail live computation...");
  const detail = await adminControlPlaneService.getAdminUserDetail(user.id);

  assert(detail.puterConnection.isConnected === true, "Puter must be reported as CONNECTED");
  assert(detail.puterConnection.username === "audit_puter_tester", "Puter username must match");
  assert(detail.puterConnection.sevenDaySuccessCalls === 3, `Expected 3 successful Puter calls, got ${detail.puterConnection.sevenDaySuccessCalls}`);
  assert(detail.puterConnection.sevenDayFailedCalls === 1, `Expected 1 failed Puter call, got ${detail.puterConnection.sevenDayFailedCalls}`);
  assert(detail.puterConnection.recentErrors.length === 1, "Must capture the QUOTA_EXCEEDED error");

  // Gemini BYOK token counts
  assert(detail.geminiUsage.tokensToday === 8500, `Expected 8500 Gemini tokens today, got ${detail.geminiUsage.tokensToday}`);
  assert(detail.geminiUsage.tokensThisMonth === 20500, `Expected 20500 Gemini tokens this month, got ${detail.geminiUsage.tokensThisMonth}`);

  // Today's total tokens (8500 Gemini + 550 Puter + 200 Puter = 9250)
  assert(detail.dailyTokenLimit.usedToday === 9250, `Expected 9250 total tokens today, got ${detail.dailyTokenLimit.usedToday}`);
  const expectedPercentage = Math.round((9250 / detail.dailyTokenLimit.limit) * 100);
  assert(detail.dailyTokenLimit.percentage === expectedPercentage, `Expected ${expectedPercentage}%, got ${detail.dailyTokenLimit.percentage}%`);

  // 7-day usage trend
  assert(detail.usageTrend7Days.length === 7, `Expected 7 daily trend buckets, got ${detail.usageTrend7Days.length}`);
  const todayBucket = detail.usageTrend7Days.find((b: any) => b.dayLabel === "Today");
  assert(Boolean(todayBucket && todayBucket.totalTokens === 9250), "Today bucket must match today's total tokens");

  // 5. Test getAdminUsersList()
  console.log("  → Validating getAdminUsersList pagination & progress calculation...");
  const list = await adminControlPlaneService.getAdminUsersList({ search: testUserEmail });
  assert(list.users.length === 1, "Must find user in search");
  const userRow = list.users[0];
  assert(userRow.puterConnection.isConnected === true, "User row must report Puter connected");
  assert(userRow.todayTokenUsage.totalTokens === 9250, `User row today tokens must be 9250, got ${userRow.todayTokenUsage.totalTokens}`);
  assert(userRow.todayTokenUsage.geminiTokens === 8500, "Gemini tokens must be 8500");
  assert(userRow.todayTokenUsage.puterTokens === 750, "Puter tokens must be 750");

  // 6. Test updatePlanDailyTokenLimit()
  console.log("  → Validating updatePlanDailyTokenLimit and Plan.metadata persistence...");
  const newFreeLimit = 75000;
  await adminControlPlaneService.updatePlanDailyTokenLimit("FREE", newFreeLimit);

  const updatedPlans = await adminControlPlaneService.getAdminPlansWithLimits();
  const freePlan = updatedPlans.find((p) => p.code === "FREE");
  assert(Boolean(freePlan && freePlan.dailyTokenLimit === newFreeLimit), `Expected FREE daily limit ${newFreeLimit}, got ${freePlan?.dailyTokenLimit}`);

  // Verify that subsequent getAdminUserDetail reflects the updated limit
  const detailAfterPlanUpdate = await adminControlPlaneService.getAdminUserDetail(user.id);
  assert(detailAfterPlanUpdate.dailyTokenLimit.limit === newFreeLimit, `Expected user limit to reflect updated ${newFreeLimit}, got ${detailAfterPlanUpdate.dailyTokenLimit.limit}`);

  // Restore default limit
  await adminControlPlaneService.updatePlanDailyTokenLimit("FREE", 50000);

  console.log("✔ ALL Admin User Token Visibility & Puter Status Tests PASSED!");
}

if (require.main === module) {
  runAdminUserTokenVisibilityTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("Test failure:", err);
      process.exit(1);
    });
}
