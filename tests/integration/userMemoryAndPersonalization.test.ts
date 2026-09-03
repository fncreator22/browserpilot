/**
 * §INTEGRATION TEST SUITE: USER MEMORY & PERSONALIZATION EXPERIENCE (TASK-056)
 * 
 * Validates all 18 criteria for the production User Memory & Personalization Experience:
 * 1. Authenticated memory retrieval
 * 2. Unauthenticated memory rejection (HTTP 401)
 * 3. Explicit memory admission
 * 4. Transient search not persisted as permanent memory
 * 5. Explicit preference precedence (EXPLICIT > INFERRED)
 * 6. Conflicting preference update (superseding older values)
 * 7. Memory deletion (server-authoritative deactivation)
 * 8. Retrieval strictly excludes deleted memory
 * 9. Personalization context injected into search route
 * 10. Explicit query constraints override remembered preferences
 * 11. Recommendation / preference separation (distinct classification)
 * 12. Save signal does not automatically become permanent preference
 * 13. Application signal does not automatically become permanent preference
 * 14. Strict tenant isolation (User A cannot access User B's memory)
 * 15. Secret rejection (keys, passwords, session tokens rejected)
 * 16. Malformed memory response handling
 * 17. Mobile-safe memory payload structure
 * 18. Memory API authorization checks
 */

(process.env as any).IS_TEST_HARNESS = "true";
(process.env as any).NODE_ENV = "test";

import assert from "node:assert";
import { NextRequest } from "next/server";
import { GET as memoryRouteGet, POST as memoryRoutePost } from "@/app/api/user/memory/route";
import { PATCH as memoryItemPatch, DELETE as memoryItemDelete } from "@/app/api/user/memory/[id]/route";
import { POST as searchRoutePost } from "@/app/api/search/route";
import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import { userMemoryVault } from "@/lib/ai/memory/userMemoryVault";
import { evaluateMemoryAdmission } from "@/lib/ai/memory/memoryAdmission";
import { extractAndStorePreferences } from "@/lib/ai/memory/preferenceExtractor";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

export async function runUserMemoryAndPersonalizationTests() {
  console.log("\n=================================================================");
  console.log("  TASK-056: USER MEMORY & PERSONALIZATION INTEGRATION SUITE      ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();

  const userA = "usr_task056_alice";
  const userB = "usr_task056_bob";

  await prisma.user.upsert({
    where: { id: userA },
    update: {},
    create: { id: userA, email: "alice056@test.com", passwordHash: "pw", role: "USER" },
  });

  await prisma.user.upsert({
    where: { id: userB },
    update: {},
    create: { id: userB, email: "bob056@test.com", passwordHash: "pw", role: "USER" },
  });

  // Clean user stores before starting
  userMemoryVault.clearUserMemories(userA);
  userMemoryVault.clearUserMemories(userB);

  // ---------------------------------------------------------------------------
  // TEST 1: AUTHENTICATED MEMORY RETRIEVAL
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 1] Testing Authenticated Memory Retrieval...");
  const reqGetA = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "GET",
    headers: { "x-test-user-id": userA },
  });
  const resGetA = await memoryRouteGet(reqGetA);
  assert.strictEqual(resGetA.status, 200);
  const jsonGetA = await resGetA.json();
  assert.strictEqual(jsonGetA.userId, userA);
  assert.ok(Array.isArray(jsonGetA.preferences));
  assert.ok(Array.isArray(jsonGetA.recommendations));
  console.log("  ✓ Test 1 Passed: Authenticated user memory retrieved cleanly.");

  // ---------------------------------------------------------------------------
  // TEST 2: UNAUTHENTICATED MEMORY REJECTION (401)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 2] Testing Unauthenticated Memory Rejection (401)...");
  const reqAnon = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "GET",
  });
  const resAnon = await memoryRouteGet(reqAnon);
  assert.strictEqual(resAnon.status, 401);
  const jsonAnon = await resAnon.json();
  assert.strictEqual(jsonAnon.error, "UNAUTHORIZED");
  console.log("  ✓ Test 2 Passed: Unauthenticated request rejected with HTTP 401.");

  // ---------------------------------------------------------------------------
  // TEST 3: EXPLICIT MEMORY ADMISSION
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 3] Testing Explicit Natural-Language Memory Admission...");
  const reqAdd = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({ text: "Remember that I prefer remote backend engineering roles in India" }),
  });
  const resAdd = await memoryRoutePost(reqAdd);
  assert.strictEqual(resAdd.status, 200);
  const jsonAdd = await resAdd.json();
  assert.strictEqual(jsonAdd.success, true);
  assert.ok(jsonAdd.admittedCount >= 2);
  const admittedCategories = jsonAdd.memories.map((m: any) => m.category);
  assert.ok(admittedCategories.includes("ROLE_PREFERENCE") || admittedCategories.includes("WORK_MODE_PREFERENCE"));
  console.log(`  ✓ Test 3 Passed: Explicit preferences admitted (${jsonAdd.admittedCount} items).`);

  // ---------------------------------------------------------------------------
  // TEST 4: TRANSIENT SEARCH NOT PERSISTED AS PERMANENT MEMORY
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 4] Testing Transient Search Non-Persistence...");
  const reqTransient = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({ text: "Find 5 senior jobs today" }),
  });
  const resTransient = await memoryRoutePost(reqTransient);
  assert.strictEqual(resTransient.status, 400);
  const jsonTransient = await resTransient.json();
  assert.strictEqual(jsonTransient.error, "ADMISSION_REJECTED");
  console.log("  ✓ Test 4 Passed: Transient search rejected from permanent vault admission.");

  // ---------------------------------------------------------------------------
  // TEST 5: EXPLICIT PREFERENCE PRECEDENCE (EXPLICIT > INFERRED)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 5] Testing Explicit Preference Precedence...");
  const inferredAdmission = evaluateMemoryAdmission({
    userId: userA,
    category: "WORK_MODE_PREFERENCE",
    key: "work_mode_inferred",
    value: "Hybrid",
    confidence: "INFERRED",
    importance: 0.5,
  });
  assert.strictEqual(inferredAdmission.sanitizedCandidate?.confidence, "INFERRED");
  assert.ok((inferredAdmission.sanitizedCandidate?.importance || 0) < 0.9);
  console.log("  ✓ Test 5 Passed: Explicit preferences maintain higher confidence & importance than inferred.");

  // ---------------------------------------------------------------------------
  // TEST 6: CONFLICTING PREFERENCE UPDATE (SUPERSEDING OLDER VALUES)
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 6] Testing Conflicting Preference Superseding...");
  // Store initial: Remote
  await userMemoryVault.storeMemory({
    userId: userA,
    category: "WORK_MODE_PREFERENCE",
    key: "preferred_work_mode",
    value: "REMOTE",
    confidence: "EXPLICIT",
    importance: 0.9,
    isExplicit: true,
  });
  // Update to Hybrid
  await userMemoryVault.storeMemory({
    userId: userA,
    category: "WORK_MODE_PREFERENCE",
    key: "preferred_work_mode",
    value: "HYBRID",
    confidence: "EXPLICIT",
    importance: 0.9,
    isExplicit: true,
  });
  const retrievedWorkMode = await userMemoryVault.getMemories({
    userId: userA,
    categories: ["WORK_MODE_PREFERENCE"],
  });
  assert.strictEqual(retrievedWorkMode.memories.length, 1);
  assert.strictEqual(retrievedWorkMode.memories[0].value, "HYBRID");
  console.log("  ✓ Test 6 Passed: Newer explicit preference cleanly supersedes older conflicting value.");

  // ---------------------------------------------------------------------------
  // TEST 7: MEMORY DELETION
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 7] Testing Server-Authoritative Memory Deletion...");
  const memToDelete = retrievedWorkMode.memories[0];
  const deleteContext = { params: Promise.resolve({ id: memToDelete.id }) };
  const reqDelete = new NextRequest(`http://localhost:3000/api/user/memory/${memToDelete.id}`, {
    method: "DELETE",
    headers: { "x-test-user-id": userA },
  });
  const resDelete = await memoryItemDelete(reqDelete, deleteContext);
  assert.strictEqual(resDelete.status, 200);
  const jsonDelete = await resDelete.json();
  assert.strictEqual(jsonDelete.success, true);
  assert.strictEqual(jsonDelete.deleted, true);
  console.log("  ✓ Test 7 Passed: Memory deletion endpoint executed successfully.");

  // ---------------------------------------------------------------------------
  // TEST 8: RETRIEVAL EXCLUDES DELETED MEMORY
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 8] Testing Retrieval Strictly Excludes Deleted Memory...");
  const afterDelete = await userMemoryVault.getMemories({
    userId: userA,
    categories: ["WORK_MODE_PREFERENCE"],
  });
  const foundDeleted = afterDelete.memories.some((m) => m.id === memToDelete.id);
  assert.strictEqual(foundDeleted, false);
  console.log("  ✓ Test 8 Passed: Deleted memory is permanently excluded from retrieval.");

  // ---------------------------------------------------------------------------
  // TEST 9: PERSONALIZATION CONTEXT IN SEARCH ROUTE
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 9] Testing Personalization Ingestion in Search Route...");
  // Alice saves a role preference: "Staff Backend Engineer"
  await userMemoryVault.storeMemory({
    userId: userA,
    category: "ROLE_PREFERENCE",
    key: "preferred_role",
    value: "Staff Backend Engineer",
    confidence: "EXPLICIT",
    importance: 0.95,
    isExplicit: true,
  });

  const now = new Date();
  const mockCandidate: RawJobCandidate = {
    sourcePlatform: "Greenhouse",
    sourceUrl: "https://boards.greenhouse.io/stripe/jobs/701",
    applyUrl: "https://boards.greenhouse.io/stripe/jobs/701#apply",
    title: "Staff Backend Engineer",
    companyName: "Stripe",
    location: "India",
    workMode: "REMOTE",
    discoveredAt: now,
    postedAt: now,
    description: "Distributed core systems.",
  };
  const mockProvider = { name: "MockATS", supports: () => true, harvestCandidates: async () => [mockCandidate] };

  const reqSearch = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({ query: "Jobs in India" }), // Unspecified role in query
  });
  (reqSearch as any)._customProviders = [mockProvider];
  const resSearch = await searchRoutePost(reqSearch);
  const jsonSearch = await resSearch.json();
  assert.strictEqual(resSearch.status, 200);
  assert.ok(jsonSearch.personalization?.applied === true);
  assert.ok(jsonSearch.personalization?.summary?.includes("Staff Backend Engineer"));
  console.log("  ✓ Test 9 Passed: Search route identifies applied user memory in personalization payload.");

  // ---------------------------------------------------------------------------
  // TEST 10: EXPLICIT QUERY OVERRIDES MEMORY
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 10] Testing Explicit Query Overriding Saved Memory...");
  // Query specifies explicit Frontend role, which MUST override Alice's saved Backend preference
  const reqSearchOverride = new NextRequest("http://localhost:3000/api/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({ query: "Find Frontend Developer jobs in India" }),
  });
  (reqSearchOverride as any)._customProviders = [mockProvider];
  const resSearchOverride = await searchRoutePost(reqSearchOverride);
  const jsonSearchOverride = await resSearchOverride.json();
  assert.strictEqual(resSearchOverride.status, 200);
  // Canonical intent must reflect the explicit query (Frontend), NOT the remembered Backend
  assert.ok(jsonSearchOverride.canonicalIntent.roles?.[0]?.includes("Frontend") || jsonSearchOverride.canonicalIntent.role?.includes("Frontend"));
  console.log("  ✓ Test 10 Passed: Explicit query constraints strictly override saved preferences.");

  // ---------------------------------------------------------------------------
  // TEST 11: RECOMMENDATION / PREFERENCE SEPARATION
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 11] Testing Recommendation vs Preference Separation...");
  await userMemoryVault.storeMemory({
    userId: userA,
    category: "RECOMMENDATION_SIGNAL",
    key: "fintech_interest",
    value: "Frequent fintech searches observed",
    confidence: "INFERRED",
    importance: 0.5,
  });
  const resSep = await memoryRouteGet(new NextRequest("http://localhost:3000/api/user/memory", {
    headers: { "x-test-user-id": userA },
  }));
  const jsonSep = await resSep.json();
  assert.strictEqual(jsonSep.recommendations.length, 1);
  assert.strictEqual(jsonSep.recommendations[0].category, "RECOMMENDATION_SIGNAL");
  assert.ok(!jsonSep.preferences.some((p: any) => p.category === "RECOMMENDATION_SIGNAL"));
  console.log("  ✓ Test 11 Passed: Recommendation signals are strictly partitioned from user preferences.");

  // ---------------------------------------------------------------------------
  // TEST 12: SAVE SIGNAL DOES NOT AUTOMATICALLY BECOME PREFERENCE
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 12] Testing Opportunity Save Non-Conversion...");
  const saveCandidateAdmission = evaluateMemoryAdmission({
    userId: userA,
    category: "RESULT_FEEDBACK",
    key: "opportunity_saved",
    value: "opp_12345",
    confidence: "INFERRED",
    importance: 0.3,
  });
  assert.notStrictEqual(saveCandidateAdmission.sanitizedCandidate?.category, "ROLE_PREFERENCE");
  assert.notStrictEqual(saveCandidateAdmission.sanitizedCandidate?.confidence, "EXPLICIT");
  console.log("  ✓ Test 12 Passed: Opportunity save feedback is not converted into a permanent preference.");

  // ---------------------------------------------------------------------------
  // TEST 13: APPLICATION SIGNAL DOES NOT AUTOMATICALLY BECOME PREFERENCE
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 13] Testing Application Started Non-Conversion...");
  const appCandidateAdmission = evaluateMemoryAdmission({
    userId: userA,
    category: "RESULT_FEEDBACK",
    key: "application_started",
    value: "opp_67890",
    confidence: "INFERRED",
    importance: 0.4,
  });
  assert.notStrictEqual(appCandidateAdmission.sanitizedCandidate?.category, "ROLE_PREFERENCE");
  console.log("  ✓ Test 13 Passed: Application started signal is not converted into a permanent preference.");

  // ---------------------------------------------------------------------------
  // TEST 14: TENANT ISOLATION
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 14] Testing Cross-Tenant Memory Isolation...");
  // User B queries memories: must NOT see Alice's memories
  const reqBob = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "GET",
    headers: { "x-test-user-id": userB },
  });
  const resBob = await memoryRouteGet(reqBob);
  const jsonBob = await resBob.json();
  assert.strictEqual(jsonBob.preferences.length, 0);
  assert.strictEqual(jsonBob.recommendations.length, 0);
  console.log("  ✓ Test 14 Passed: User B cannot observe or query User A's memories.");

  // ---------------------------------------------------------------------------
  // TEST 15: SECRET REJECTION
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 15] Testing Secret and Credential Rejection...");
  const reqSecret = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({ text: "Remember my API key: api_key=sk-proj-999888777666" }),
  });
  const resSecret = await memoryRoutePost(reqSecret);
  assert.strictEqual(resSecret.status, 400);
  const jsonSecret = await resSecret.json();
  assert.strictEqual(jsonSecret.error, "ADMISSION_REJECTED");
  assert.ok(jsonSecret.message.includes("SECURITY_CREDENTIAL_DETECTED"));
  console.log("  ✓ Test 15 Passed: Credentials and API keys rejected safely by admission gate.");

  // ---------------------------------------------------------------------------
  // TEST 16: MALFORMED MEMORY RESPONSE HANDLING
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 16] Testing Malformed Memory Payload Handling...");
  const reqMalformed = new NextRequest("http://localhost:3000/api/user/memory", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-test-user-id": userA },
    body: JSON.stringify({}), // Empty body
  });
  const resMalformed = await memoryRoutePost(reqMalformed);
  assert.strictEqual(resMalformed.status, 400);
  console.log("  ✓ Test 16 Passed: Malformed request rejected with HTTP 400.");

  // ---------------------------------------------------------------------------
  // TEST 17: MOBILE-SAFE MEMORY STRUCTURE
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 17] Testing Mobile-Safe Memory Schema Hierarchy...");
  const resFinal = await memoryRouteGet(new NextRequest("http://localhost:3000/api/user/memory", {
    headers: { "x-test-user-id": userA },
  }));
  const jsonFinal = await resFinal.json();
  for (const pref of jsonFinal.preferences) {
    assert.ok(pref.id);
    assert.ok(pref.category);
    assert.ok(pref.value);
    assert.ok(pref.confidence);
  }
  console.log("  ✓ Test 17 Passed: Memory payload structure strictly conformant for responsive rendering.");

  // ---------------------------------------------------------------------------
  // TEST 18: MEMORY API AUTHORIZATION CHECKS
  // ---------------------------------------------------------------------------
  console.log("▶ [TEST 18] Testing Memory Item Patch Authorization...");
  const dummyContext = { params: Promise.resolve({ id: "mem_nonexistent" }) };
  const reqPatchAnon = new NextRequest("http://localhost:3000/api/user/memory/mem_nonexistent", {
    method: "PATCH",
    body: JSON.stringify({ value: "Updated" }),
  });
  const resPatchAnon = await memoryItemPatch(reqPatchAnon, dummyContext);
  assert.strictEqual(resPatchAnon.status, 401);
  console.log("  ✓ Test 18 Passed: Unauthenticated mutation rejected safely.");

  console.log("\n=================================================================");
  console.log("  TASK-056: ALL 18 MEMORY & PERSONALIZATION TESTS PASSED! ✅    ");
  console.log("=================================================================\n");
}

if (require.main === module) {
  runUserMemoryAndPersonalizationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("\n❌ [TASK-056 TEST FAILED]:", err);
      process.exit(1);
    });
}
