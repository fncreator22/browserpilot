(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from 'node:assert';
import { prisma, ensureDatabaseSchema } from '../../lib/db/prisma';
import { POST as registerPost } from '../../app/api/auth/register/route';
import { decryptCredential, encryptCredential } from '../../lib/security/credentialEncryption';
import { upsertApiKeyConnection, disconnectProviderConnection } from '../../lib/ai/governance/providerGovernance';

export async function runAccountApiKeyManagementTests() {
  console.log("\n=================================================================");
  console.log("  TDD: SIGNUP WITHOUT KEY AND API KEY LIFECYCLE MANAGEMENT SUITE ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  const timestamp = Date.now();
  const testEmail = `test_signup_nokey_${timestamp}@browserpilot.ai`;
  const testPassword = "Password1234!";
  let createdUserId: string | null = null;

  try {
    // TEST 1: User Registration succeeds WITHOUT a Gemini API key
    console.log("▶ [TEST 1] Verifying user registration succeeds with NO Gemini API key provided...");
    const regReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Keyless Signup User",
        email: testEmail,
        password: testPassword,
      }),
    });

    const regRes = await registerPost(regReq);
    const regData = await regRes.json();

    assert.strictEqual(regRes.status, 201, `Expected registration to return 201, got ${regRes.status}: ${JSON.stringify(regData)}`);
    assert.strictEqual(regData.success, true, "Expected success to be true");
    assert.ok(regData.user?.id, "Expected created user to have an id");
    createdUserId = regData.user.id;

    const dbUser1 = await prisma.user.findUnique({ where: { id: createdUserId! } });
    assert.ok(dbUser1, "User must exist in database");
    assert.strictEqual(dbUser1.geminiApiKey, null, "User geminiApiKey in database must be null");
    console.log("  ✔ Registration succeeded with email/password only; geminiApiKey is null in DB.");

    // TEST 2: Add Gemini BYOK API Key and verify encryption and masking
    console.log("▶ [TEST 2] Saving Gemini BYOK key via API and verifying encryption and masking...");
    const dummyKey = `AIzaSyTestApiKey_${timestamp}_RealLength12345`;

    const savedConnection = await upsertApiKeyConnection(createdUserId!, {
      provider: "GEMINI_BYOK",
      apiKey: dummyKey,
    });

    assert.strictEqual(savedConnection.status, "CONNECTED", "Connection status must be CONNECTED");
    assert.ok(savedConnection.maskedCredential, "Must have a masked credential");
    assert.ok(savedConnection.maskedCredential.includes("••••"), "Masked credential must contain masking characters");
    assert.ok(!savedConnection.maskedCredential.includes(dummyKey), "Masked credential must NOT expose full raw key");

    const dbUser2 = await prisma.user.findUnique({ where: { id: createdUserId! } });
    assert.ok(dbUser2?.geminiApiKey, "Database user.geminiApiKey must be set");
    const decryptedKey = decryptCredential(dbUser2.geminiApiKey);
    assert.strictEqual(decryptedKey, dummyKey, "Decrypted database key must match original key");
    console.log(`  ✔ Gemini API key saved and encrypted in DB (Masked: ${savedConnection.maskedCredential}).`);

    // TEST 3: Delete / Remove Gemini BYOK API Key via disconnectProviderConnection
    console.log("▶ [TEST 3] Removing Gemini BYOK key and verifying complete database cleanup...");
    const disconnectResult = await disconnectProviderConnection(createdUserId!, "GEMINI_BYOK");

    assert.strictEqual(disconnectResult.success, true, "Disconnect result must be true");
    assert.strictEqual(disconnectResult.status, "DISCONNECTED", "Status must be DISCONNECTED");

    const dbUser3 = await prisma.user.findUnique({ where: { id: createdUserId! } });
    assert.strictEqual(dbUser3?.geminiApiKey, null, "User geminiApiKey in database must be cleared to null");

    const connectionRecord = await prisma.providerConnection.findUnique({
      where: {
        userId_provider: {
          userId: createdUserId!,
          provider: "GEMINI_BYOK",
        },
      },
    });
    assert.strictEqual(connectionRecord?.status, "DISCONNECTED", "ProviderConnection status must be DISCONNECTED");
    assert.strictEqual(connectionRecord?.encryptedCredential, null, "encryptedCredential must be null");
    assert.strictEqual(connectionRecord?.maskedCredential, null, "maskedCredential must be null");
    console.log("  ✔ Gemini API key completely removed from both User and ProviderConnection in DB.");

    // TEST 4: Deleting a key when only legacy User.geminiApiKey exists
    console.log("▶ [TEST 4] Verifying disconnect clears User.geminiApiKey even without providerConnection row...");
    const dummyKey2 = `AIzaSyLegacyKey_${timestamp}_54321`;
    await prisma.user.update({
      where: { id: createdUserId! },
      data: { geminiApiKey: encryptCredential(dummyKey2) },
    });
    await prisma.providerConnection.deleteMany({ where: { userId: createdUserId! } });

    await disconnectProviderConnection(createdUserId!, "GEMINI_BYOK");
    const dbUser4 = await prisma.user.findUnique({ where: { id: createdUserId! } });
    assert.strictEqual(dbUser4?.geminiApiKey, null, "Legacy user.geminiApiKey must be wiped to null");
    console.log("  ✔ Legacy key wiped successfully even without providerConnection row.");

    console.log("\n✅ ALL SIGNUP AND API KEY LIFECYCLE TESTS PASSED!\n");
  } finally {
    if (createdUserId) {
      await prisma.providerConnection.deleteMany({ where: { userId: createdUserId } });
      await prisma.search.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  }
}

if (require.main === module) {
  runAccountApiKeyManagementTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ TEST SUITE FAILED:", err);
      process.exit(1);
    });
}
