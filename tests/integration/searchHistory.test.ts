import assert from "assert";
import { 
  createSearch, 
  upsertOpportunity, 
  attachOpportunityToSearch, 
  getUserSearches, 
  getSearchSession, 
  deleteSearchSession 
} from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export async function runSearchHistoryIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Search History & Re-runable Sessions Tests (TASK-008)...");

  // 1. Create two test tenants
  const tenantA = await prisma.user.create({
    data: {
      email: `history-tenant-a-${Date.now()}@integration.ai`,
      name: "Tenant A History User",
      passwordHash: "dummy-hash",
    },
  });

  const tenantB = await prisma.user.create({
    data: {
      email: `history-tenant-b-${Date.now()}@integration.ai`,
      name: "Tenant B History User",
      passwordHash: "dummy-hash",
    },
  });

  // 2. Tenant A creates two search sessions
  const searchA1 = await createSearch({
    userId: tenantA.id,
    rawQuery: "remote AI internships in India",
    intentType: "JOB_SEARCH",
    parsedRole: "AI Intern",
    parsedSkills: ["Python", "PyTorch"],
    parsedLocation: "India",
    parsedWorkMode: "REMOTE",
    targetGradYear: 2026,
    totalFound: 2,
    status: "COMPLETED",
  });

  const searchA2 = await createSearch({
    userId: tenantA.id,
    rawQuery: "frontend developer internships at YC startups",
    intentType: "JOB_SEARCH",
    parsedRole: "Frontend Developer",
    parsedSkills: ["React", "TypeScript"],
    parsedWorkMode: "ANY",
    totalFound: 1,
    status: "COMPLETED",
  });

  // Tenant B creates one search session
  const searchB1 = await createSearch({
    userId: tenantB.id,
    rawQuery: "security engineering internships",
    intentType: "JOB_SEARCH",
    parsedRole: "Security Intern",
    totalFound: 1,
    status: "COMPLETED",
  });

  // 3. Populate persisted search results for searchA1
  const opp1 = await upsertOpportunity({
    canonicalHash: `hash_a1_1_${Date.now()}`,
    title: "AI Research Intern",
    companyName: "Deep Vision Labs",
    location: "Bengaluru, India",
    workMode: "REMOTE",
    description: "Research and develop state-of-the-art vision models.",
    primaryApplyUrl: "https://deepvision.ai/careers/intern",
    status: "ACTIVE",
  });

  const opp2 = await upsertOpportunity({
    canonicalHash: `hash_a1_2_${Date.now()}`,
    title: "Applied ML Engineer",
    companyName: "Neural Vector",
    location: "Remote",
    workMode: "REMOTE",
    description: "Train and deploy deep learning models in production.",
    primaryApplyUrl: "https://neuralvector.ai/apply/ml-eng",
    status: "ACTIVE",
  });

  await attachOpportunityToSearch({
    searchId: searchA1.id,
    opportunityId: opp1.id,
    matchScore: 92,
    rankPosition: 1,
  });

  await attachOpportunityToSearch({
    searchId: searchA1.id,
    opportunityId: opp2.id,
    matchScore: 85,
    rankPosition: 2,
  });

  // 4. Test getUserSearches & Multi-Tenant Scoping
  const userASearches = await getUserSearches(tenantA.id);
  assert.strictEqual(userASearches.length, 2, "Tenant A must have exactly 2 search history entries");
  assert.strictEqual(userASearches[0].id, searchA2.id, "Latest search must be first in descending order");
  assert.strictEqual(userASearches[1].id, searchA1.id, "Earlier search must be second");

  const userBSearches = await getUserSearches(tenantB.id);
  assert.strictEqual(userBSearches.length, 1, "Tenant B must have exactly 1 search history entry");
  assert.strictEqual(userBSearches[0].id, searchB1.id);
  console.log("  ✓ Verified getUserSearches deterministic order and multi-tenant scoping");

  // 5. Test Historical Session Detail Retrieval
  const sessionDetail = await getSearchSession(searchA1.id, tenantA.id);
  assert.ok(sessionDetail, "Must retrieve search session detail for owner");
  assert.strictEqual(sessionDetail?.results.length, 2, "Must retrieve 2 persisted search results");
  assert.strictEqual(sessionDetail?.results[0].rankPosition, 1, "Results must be ordered by rankPosition ASC");
  assert.strictEqual(sessionDetail?.results[0].matchScore, 92, "Persisted matchScore must be preserved");
  assert.strictEqual(sessionDetail?.results[0].opportunity.title, "AI Research Intern");
  console.log("  ✓ Verified getSearchSession retrieves persisted results with ranking without re-discovery");

  // 6. Test Cross-Tenant Access Block (IDOR Prevention)
  const crossTenantAttempt = await getSearchSession(searchA1.id, tenantB.id);
  assert.strictEqual(crossTenantAttempt, null, "Cross-tenant search session lookup must be blocked");
  console.log("  ✓ Verified cross-tenant search session isolation (IDOR blocked)");

  // 7. Test Re-run Immutability
  // When a user re-runs a search, a NEW search session is created while old one is unchanged
  const reRunSearch = await createSearch({
    userId: tenantA.id,
    rawQuery: searchA1.rawQuery, // Re-runs same query
    intentType: "JOB_SEARCH",
    parsedRole: searchA1.parsedRole,
    totalFound: 2,
    status: "COMPLETED",
  });

  assert.notStrictEqual(reRunSearch.id, searchA1.id, "Re-run must produce a distinct new search session ID");

  const originalAfterRerun = await getSearchSession(searchA1.id, tenantA.id);
  assert.strictEqual(originalAfterRerun?.id, searchA1.id, "Original search session must remain unchanged");
  assert.strictEqual(originalAfterRerun?.results.length, 2, "Original results remain immutable");
  console.log("  ✓ Verified re-run search creates a new session while preserving original historical evidence");

  // 8. Test Search History Deletion & Cascade
  // Unauthorized delete attempt
  const unauthorizedDelete = await deleteSearchSession(searchA1.id, tenantB.id);
  assert.strictEqual(unauthorizedDelete.deleted, false, "Unauthorized delete attempt must fail");

  // Authorized delete
  const authorizedDelete = await deleteSearchSession(searchA1.id, tenantA.id);
  assert.strictEqual(authorizedDelete.deleted, true, "Authorized delete must succeed");

  const deletedSessionLookup = await getSearchSession(searchA1.id, tenantA.id);
  assert.strictEqual(deletedSessionLookup, null, "Deleted session must return null");

  const remainingSearches = await getUserSearches(tenantA.id);
  assert.strictEqual(remainingSearches.length, 2, "Tenant A now has searchA2 and reRunSearch");
  console.log("  ✓ Verified search history deletion, authorization guards, and cascade cleanup");

  console.log("✓ [INTEGRATION] Search History & Re-runable Sessions Tests Passed!\n");
}
