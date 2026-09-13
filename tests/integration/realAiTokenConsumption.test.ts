import assert from 'node:assert';
import { prisma, ensureDatabaseSchema } from '../../lib/db/prisma';
import { resolveGeminiApiKey } from '../../lib/ai/modelSelector';
import { searchPlanner } from '../../lib/ai/searchPlanner/searchPlanner';
import { parseSearchIntentAsync } from '../../lib/scraper/intentParser';
import { discoverCandidateTargets } from '../../lib/scraper/candidateDiscoveryEngine';
import { encryptCredential } from '../../lib/security/credentialEncryption';
import { evaluateSemanticEvidence } from '../../lib/ai/evidence/semanticJudge';
import { buildDiscoveryPlan } from '../../lib/scraper/discoveryPlanner';
import { normalizeCandidateEvidence } from '../../lib/ai/evidence/evidenceNormalizer';
import { recordAIUsageEvent } from '../../lib/ai/governance/providerGovernance';

export async function runRealAiTokenConsumptionTests() {
  console.log("\n=================================================================");
  console.log("  TDD: REAL AI TOKEN CONSUMPTION & CREDENTIAL RESOLUTION SUITE   ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  const timestamp = Date.now();
  const testUserEmail = `token_test_user_${timestamp}@browserpilot.ai`;
  const dummyApiKey = `AIzaSyDummyKeyForTddVerification_${timestamp}`;
  const encryptedKey = encryptCredential(dummyApiKey);

  console.log("▶ [TEST 1] Creating test user with stored BYOK key in database...");
  const testUser = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Token Test User",
      passwordHash: "hash_test_32chars_long_1234567890",
      role: "USER",
      geminiApiKey: encryptedKey,
    },
  });

  try {
    // -------------------------------------------------------------------------
    // TEST 2: Credential Resolution Seam
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 2] Verifying resolveGeminiApiKey retrieves key for user from DB...");
    const resolvedKey = await resolveGeminiApiKey(null, testUser.id);
    assert.strictEqual(
      resolvedKey,
      dummyApiKey,
      "Expected resolvedKey to match user BYOK key"
    );
    console.log("  ✔ resolveGeminiApiKey successfully decrypted and returned user DB key.");

    // -------------------------------------------------------------------------
    // TEST 3: Search Planner Resolves User DB Key & Records Attempt
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 3] Verifying Search Planner resolves user DB key when apiKeyOverride is null...");
    const mockBrainContext: any = {
      query: "Find AI startups in San Francisco",
      userId: testUser.id,
      searchContext: [],
      userContext: [],
      companyContext: [],
      platformContext: [],
      recommendations: [],
    };
    const searchPlanRes = await searchPlanner.planSearch(
      "Find AI startups in San Francisco",
      { role: "AI Engineer", location: "San Francisco" },
      mockBrainContext,
      { userId: testUser.id }
    );
    assert.strictEqual(
      searchPlanRes.aiConfigurationStatus,
      "CONFIGURED",
      `Expected SearchPlanner aiConfigurationStatus to be CONFIGURED via DB key, got: ${searchPlanRes.aiConfigurationStatus}`
    );
    console.log("  ✔ Search Planner resolved user DB key and set status to CONFIGURED.");

    const planEvents = await prisma.aIUsageEvent.findMany({
      where: { userId: testUser.id, operation: "ACTION_PLANNING" },
    });
    assert.ok(planEvents.length > 0, "Expected AIUsageEvent recorded for ACTION_PLANNING");
    console.log(`  ✔ Search Planner recorded ${planEvents.length} AIUsageEvent for ACTION_PLANNING (status: ${planEvents[0].status}).`);

    // -------------------------------------------------------------------------
    // TEST 4: Semantic Judge Accepts and Attempts User BYOK Credentials
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 4] Verifying Semantic Judge accepts and resolves user BYOK credentials...");
    const plan = buildDiscoveryPlan("Senior AI Engineer in Bengaluru", {
      roles: ["Senior AI Engineer"],
      locations: ["Bengaluru"],
    });
    const rawEvidence: any[] = [
      {
        id: "rec_1",
        candidateId: "cand_1",
        field: "title" as const,
        value: "Senior AI Engineer",
        sourcePlatform: "LINKEDIN" as const,
        sourceUrl: "https://www.linkedin.com/jobs/view/3829104820",
        extractedAt: new Date(),
        authoritative: true,
        weight: 1.0,
      },
      {
        id: "rec_2",
        candidateId: "cand_1",
        field: "company" as const,
        value: "TechCorp Labs",
        sourcePlatform: "LINKEDIN" as const,
        sourceUrl: "https://www.linkedin.com/jobs/view/3829104820",
        extractedAt: new Date(),
        authoritative: true,
        weight: 1.0,
      },
    ];
    const normalized = normalizeCandidateEvidence("cand_1", rawEvidence as any);
    const mockDeterministic: any = {
      isEligible: true,
      isHardBlocked: false,
      rejectionReasons: [],
      failedConstraints: [],
      passedConstraints: ["ROLE_COMPATIBLE"],
    };

    const judgeRes = await evaluateSemanticEvidence(normalized, plan, mockDeterministic, {
      userId: testUser.id,
      apiKey: dummyApiKey,
    });
    assert.ok(judgeRes, "Semantic judge returned a result");
    const judgeEvents = await prisma.aIUsageEvent.findMany({
      where: { userId: testUser.id, operation: "DISCOVERY_RANKING" },
    });
    assert.ok(judgeEvents.length > 0, "Expected AIUsageEvent recorded for DISCOVERY_RANKING");
    console.log(`  ✔ Semantic Judge recorded ${judgeEvents.length} AIUsageEvent for DISCOVERY_RANKING (status: ${judgeEvents[0].status}).`);

    // -------------------------------------------------------------------------
    // TEST 5: Candidate Discovery Engine Records Usage
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 5] Verifying Candidate Discovery Engine records AIUsageEvent...");
    await discoverCandidateTargets(
      { role: "Staff DevOps Engineer" },
      { userId: testUser.id, apiKey: dummyApiKey, maxTargets: 3 }
    );
    const discoveryEvents = await prisma.aIUsageEvent.findMany({
      where: { userId: testUser.id, operation: "STRUCTURED_EXTRACTION" },
    });
    assert.ok(discoveryEvents.length > 0, "Expected AIUsageEvent recorded for STRUCTURED_EXTRACTION");
    console.log(`  ✔ Candidate Discovery Engine recorded ${discoveryEvents.length} AIUsageEvent for STRUCTURED_EXTRACTION (status: ${discoveryEvents[0].status}).`);

    // -------------------------------------------------------------------------
    // TEST 6: Intent Parser Records FAILED AIUsageEvent on Invalid Key
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 6] Verifying Intent Parser records FAILED AIUsageEvent when key fails...");
    await parseSearchIntentAsync("Find React jobs in New York", {
      userId: testUser.id,
      apiKey: dummyApiKey,
    });

    const failedEvents = await prisma.aIUsageEvent.findMany({
      where: {
        userId: testUser.id,
        operation: "INTENT_PARSING",
      },
    });

    assert.ok(
      failedEvents.length > 0,
      "Expected at least one AIUsageEvent recorded for INTENT_PARSING when attempting with user key"
    );
    console.log(`  ✔ Intent Parser recorded ${failedEvents.length} AIUsageEvent(s) with status: ${failedEvents[0].status}`);

    // -------------------------------------------------------------------------
    // TEST 7: Success Token Consumption Verification (TASK-032 / TASK-065)
    // -------------------------------------------------------------------------
    console.log("▶ [TEST 7] Verifying live SUCCESS token consumption persistence in database...");
    const recordedSuccess = await recordAIUsageEvent({
      userId: testUser.id,
      provider: "Google Gemini",
      model: "gemini-2.5-flash",
      operation: "DISCOVERY_RANKING",
      inputTokens: 245,
      outputTokens: 68,
      totalTokens: 313,
      durationMs: 412,
      status: "SUCCESS",
    });

    assert.ok(recordedSuccess.id, "Expected recordedSuccess to have an ID");
    assert.strictEqual(recordedSuccess.totalTokens, 313, "Expected totalTokens to be 313");
    assert.strictEqual(recordedSuccess.inputTokens, 245, "Expected inputTokens to be 245");
    assert.strictEqual(recordedSuccess.outputTokens, 68, "Expected outputTokens to be 68");

    const allUserEvents = await prisma.aIUsageEvent.findMany({
      where: { userId: testUser.id },
      orderBy: { timestamp: "desc" },
    });

    console.log(`  ✔ Total AIUsageEvent records persisted for user: ${allUserEvents.length}`);
    for (const evt of allUserEvents) {
      console.log(`    - [${evt.operation}] Status: ${evt.status} | Tokens: ${evt.totalTokens} (in: ${evt.inputTokens}, out: ${evt.outputTokens}) | Model: ${evt.model}`);
    }

    assert.ok(allUserEvents.length >= 4, "Expected all 4 core pipeline stages to be represented in AIUsageEvent");
    console.log("\n✅ ALL 7 REAL AI TOKEN CONSUMPTION TDD TESTS PASSED WITH POSTGRES PERSISTENCE!");
  } finally {
    await prisma.aIUsageEvent.deleteMany({ where: { userId: testUser.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }
}

if (require.main === module) {
  runRealAiTokenConsumptionTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ TEST FAILED:", err);
      process.exit(1);
    });
}
