(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from 'node:assert';
import { prisma, ensureDatabaseSchema } from '../../lib/db/prisma';
import { POST } from '../../app/api/search/route';
import { NextRequest } from 'next/server';
import { upsertApiKeyConnection, upsertPuterConnection } from '../../lib/ai/governance/providerGovernance';

export async function runStrictAiEnforcementTests() {
  console.log("\n=================================================================");
  console.log("  TDD: STRICT AI ENFORCEMENT & IN-APP CONFIGURATION TEST SUITE   ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  const timestamp = Date.now();
  const testUserEmail = `strict_ai_user_${timestamp}@browserpilot.ai`;

  // 1. Create a clean test user without any AI key or Puter connection
  console.log("▶ [TEST 1] Creating test user with NO AI credentials...");
  const testUser = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Strict AI Test User",
      passwordHash: "hash_test_32chars_long_1234567890",
      role: "USER",
    },
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 2: Strict AI blocks silent scraper fallback when no AI provider exists
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 2] Verifying search returns MODEL_CONFIGURATION_REQUIRED when no AI provider is configured...");
    const req1 = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": testUser.id,
      },
      body: JSON.stringify({
        query: "Find Staff AI Engineers in Bengaluru",
        strictAi: true,
      }),
    });

    const res1 = await POST(req1);
    const body1 = await res1.json();

    assert.strictEqual(
      body1.status,
      "MODEL_CONFIGURATION_REQUIRED",
      `Expected status to be MODEL_CONFIGURATION_REQUIRED, got: ${body1.status}`
    );
    assert.strictEqual(
      body1.errorCode,
      "MODEL_CONFIGURATION_REQUIRED",
      `Expected errorCode to be MODEL_CONFIGURATION_REQUIRED, got: ${body1.errorCode}`
    );
    console.log("  ✔ Strict AI mode correctly blocked silent scraper fallback and returned MODEL_CONFIGURATION_REQUIRED.");

    // -------------------------------------------------------------------------
    // TEST 3: Explicit scraper fallback flag allows execution when user asks for it
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 3] Verifying allowDeterministicFallback: true bypasses strict AI blocker...");
    const req2 = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": testUser.id,
      },
      body: JSON.stringify({
        query: "Find Staff AI Engineers in Bengaluru",
        allowDeterministicFallback: true,
      }),
    });

    const res2 = await POST(req2);
    const body2 = await res2.json();

    assert.notStrictEqual(
      body2.status,
      "MODEL_CONFIGURATION_REQUIRED",
      "Expected search to proceed when allowDeterministicFallback is true"
    );
    console.log(`  ✔ allowDeterministicFallback: true allowed execution (status: ${body2.status}).`);

    // -------------------------------------------------------------------------
    // TEST 4: Connecting Puter immediately unblocks Strict AI mode
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 4] Connecting Puter account for user and verifying search is unblocked...");
    await upsertPuterConnection(testUser.id, {
      username: `puter_user_${timestamp}`,
      token: `ptok_test_${timestamp}`,
    });

    const req3 = new NextRequest("http://localhost:3000/api/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-test-user-id": testUser.id,
      },
      body: JSON.stringify({
        query: "Find Staff AI Engineers in Bengaluru",
        strictAi: true,
      }),
    });

    const res3 = await POST(req3);
    const body3 = await res3.json();

    assert.notStrictEqual(
      body3.status,
      "MODEL_CONFIGURATION_REQUIRED",
      "Expected Puter-connected user to be unblocked from MODEL_CONFIGURATION_REQUIRED"
    );
    console.log(`  ✔ Puter connection successfully unlocked search (status: ${body3.status}).`);

    console.log("\n✅ ALL STRICT AI ENFORCEMENT & IN-APP CONFIGURATION TESTS PASSED!");
  } finally {
    await prisma.providerConnection.deleteMany({ where: { userId: testUser.id } });
    await prisma.search.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
}

if (require.main === module) {
  runStrictAiEnforcementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ TEST FAILED:", err);
      process.exit(1);
    });
}
