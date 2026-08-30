import { prisma, ensureDatabaseSchema } from "@/lib/db/prisma";
import {
  upsertOpportunity,
  upsertSourceListing,
  recordDiscoveredOpportunity,
  createSearch,
  attachOpportunityToSearch,
  saveOpportunity,
  unsaveOpportunity,
  isOpportunitySaved,
  getSavedOpportunities,
  getOpportunityById,
  getOpportunityByCanonicalHash,
  getOpportunityWithSourceListings,
  getSearchResults,
} from "@/lib/db/opportunities";
import assert from "assert";

export async function runOpportunityDbIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Opportunity Database & DAL Tests (TASK-001 & TASK-002)...");

  await ensureDatabaseSchema();

  const testSuffix = Date.now().toString();
  const testEmail = `test_student_dal_${testSuffix}@example.com`;
  const canonicalHash1 = `hash_intern_acme_${testSuffix}`;
  const canonicalHash2 = `hash_fulltime_beta_${testSuffix}`;

  // 1. Create a test user
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      passwordHash: "$2a$12$e8YQ/fakeHashForIntegrationTesting1234567890",
      name: "DAL Integration Student",
    },
  });
  assert.ok(user.id, "User should have an ID");
  console.log("  ✓ Created test user fixture");

  // 2. Test Atomic Opportunity Upsert (Create New)
  const oppCreated = await upsertOpportunity({
    canonicalHash: canonicalHash1,
    title: "AI Research & Engineering Intern",
    companyName: "Acme AI Labs",
    location: "Bengaluru, India",
    workMode: "HYBRID",
    experienceLevel: "INTERN",
    opportunityType: "INTERNSHIP",
    salaryMin: 45000,
    salaryMax: 65000,
    salaryCurrency: "INR",
    description: "Original comprehensive description of the internship role with deep technical requirements.",
    requirements: ["Python", "PyTorch", "Next.js", "Batch 2025/2026"],
    skills: ["Python", "PyTorch", "Next.js"],
    primaryApplyUrl: "https://acmelabs.ai/careers/intern-2026",
    status: "ACTIVE",
  });
  assert.strictEqual(oppCreated.canonicalHash, canonicalHash1);
  assert.strictEqual(oppCreated.companyName, "Acme AI Labs");
  const initialFirstSeen = oppCreated.firstSeenAt.getTime();
  const initialLastVerified = oppCreated.lastVerifiedAt.getTime();
  console.log("  ✓ Tested atomic Opportunity creation via upsertOpportunity()");

  // 3. Test firstSeenAt Preservation and lastVerifiedAt Update
  await new Promise((r) => setTimeout(r, 50)); // Tick time
  const oppUpdated = await upsertOpportunity({
    canonicalHash: canonicalHash1,
    title: "AI Research & Engineering Intern (Updated Title)",
    companyName: "Acme AI Labs",
    location: "Bengaluru, India",
    description: "Updated description text.",
    primaryApplyUrl: "https://acmelabs.ai/careers/intern-2026-v2",
  });
  assert.strictEqual(oppUpdated.id, oppCreated.id);
  assert.strictEqual(oppUpdated.firstSeenAt.getTime(), initialFirstSeen, "firstSeenAt must remain unchanged across updates");
  assert.ok(oppUpdated.lastVerifiedAt.getTime() >= initialLastVerified, "lastVerifiedAt must be updated to current timestamp");
  assert.strictEqual(oppUpdated.title, "AI Research & Engineering Intern (Updated Title)");
  console.log("  ✓ Verified firstSeenAt preservation and lastVerifiedAt update");

  // 4. Test Partial Data Preservation (Safe Merge Semantics)
  // An incoming scrape with empty description/skills/salary must NOT erase existing populated values.
  const oppPartialMerge = await upsertOpportunity({
    canonicalHash: canonicalHash1,
    title: "AI Research & Engineering Intern (Updated Title)",
    companyName: "Acme AI Labs",
    location: "Bengaluru, India",
    description: "", // Incomplete/empty incoming description
    skills: [], // Empty incoming skills
    requirements: [], // Empty incoming requirements
    salaryMin: undefined,
    salaryMax: undefined,
    primaryApplyUrl: "", // Empty incoming apply url
  });
  assert.strictEqual(oppPartialMerge.description, "Updated description text.", "Empty incoming description must NOT overwrite existing description");
  const parsedSkills = JSON.parse(oppPartialMerge.skills);
  assert.ok(parsedSkills.includes("Python"), "Empty incoming skills must NOT overwrite existing skills");
  assert.strictEqual(oppPartialMerge.salaryMin, 45000, "Undefined salaryMin must NOT overwrite existing salary");
  assert.strictEqual(oppPartialMerge.primaryApplyUrl, "https://acmelabs.ai/careers/intern-2026-v2", "Empty applyUrl must NOT overwrite existing applyUrl");
  console.log("  ✓ Verified safe partial data merge (incomplete incoming data preserves existing rich attributes)");

  // 5. Test SourceListing Upsert and Multi-Source Association
  const sourceListingLinkedIn = await upsertSourceListing({
    opportunityId: oppCreated.id,
    sourcePlatform: "LinkedIn",
    externalJobId: `li_${testSuffix}`,
    sourceUrl: `https://linkedin.com/jobs/view/${testSuffix}`,
    applyUrl: `https://linkedin.com/jobs/view/${testSuffix}?source=li_easy_apply`,
    verificationStatus: "VERIFIED",
    rawSnippet: "LinkedIn snippet text",
  });
  assert.strictEqual(sourceListingLinkedIn.sourcePlatform, "LinkedIn");
  assert.strictEqual(sourceListingLinkedIn.opportunityId, oppCreated.id);

  const sourceListingYC = await upsertSourceListing({
    opportunityId: oppCreated.id,
    sourcePlatform: "Y Combinator",
    externalJobId: `yc_${testSuffix}`,
    sourceUrl: `https://workatastartup.com/jobs/${testSuffix}`,
    applyUrl: `https://workatastartup.com/jobs/${testSuffix}/direct-founder-apply`,
    verificationStatus: "VERIFIED",
    rawSnippet: "YC founder direct apply snippet",
  });
  assert.strictEqual(sourceListingYC.sourcePlatform, "Y Combinator");
  assert.notStrictEqual(sourceListingLinkedIn.applyUrl, sourceListingYC.applyUrl, "Multi-source apply URLs must remain distinct");
  console.log("  ✓ Verified multiple SourceListings coexisting with independent source-specific apply URLs");

  // 6. Test SourceListing Idempotency on [sourcePlatform, sourceUrl]
  const sourceListingLinkedInUpdate = await upsertSourceListing({
    opportunityId: oppCreated.id,
    sourcePlatform: "LinkedIn",
    sourceUrl: `https://linkedin.com/jobs/view/${testSuffix}`, // Same composite key
    applyUrl: `https://linkedin.com/jobs/view/${testSuffix}?source=li_updated`,
    rawSnippet: "Updated LinkedIn snippet",
  });
  assert.strictEqual(sourceListingLinkedInUpdate.id, sourceListingLinkedIn.id, "Upserting existing SourceListing must update in-place");
  assert.strictEqual(sourceListingLinkedInUpdate.applyUrl, `https://linkedin.com/jobs/view/${testSuffix}?source=li_updated`);
  console.log("  ✓ Verified SourceListing upsert idempotency on (sourcePlatform, sourceUrl)");

  // 7. Test recordDiscoveredOpportunity Composite Transaction
  const compositeResult = await recordDiscoveredOpportunity(
    {
      canonicalHash: canonicalHash2,
      title: "Founding Full-Stack Developer",
      companyName: "Beta AI Startups",
      location: "Remote - Global",
      workMode: "REMOTE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      salaryMin: 90000,
      salaryMax: 120000,
      salaryCurrency: "USD",
      description: "Join as our first full-stack engineer building AI browser workflows.",
      requirements: ["TypeScript", "Next.js", "Node.js"],
      skills: ["TypeScript", "Next.js", "Node.js"],
      primaryApplyUrl: "https://betaaistartups.com/careers/founding-dev",
    },
    {
      sourcePlatform: "YC WorkAtAStartup",
      sourceUrl: `https://workatastartup.com/jobs/beta_${testSuffix}`,
      applyUrl: `https://workatastartup.com/jobs/beta_${testSuffix}/apply`,
      verificationStatus: "VERIFIED",
    }
  );
  assert.ok(compositeResult.opportunity.id);
  assert.strictEqual(compositeResult.sourceListing.opportunityId, compositeResult.opportunity.id);
  console.log("  ✓ Tested atomic recordDiscoveredOpportunity() composite transaction");

  // 8. Test Search Creation & SearchResult Association
  const searchSession = await createSearch({
    userId: user.id,
    rawQuery: "Find remote React and AI internships for 2026 batch",
    intentType: "JOB_SEARCH_INTERNSHIP",
    parsedRole: "AI Intern",
    parsedSkills: ["Python", "React", "Next.js"],
    parsedLocation: "Global",
    parsedWorkMode: "REMOTE",
    targetGradYear: 2026,
    status: "COMPLETED",
    totalFound: 2,
  });
  assert.strictEqual(searchSession.userId, user.id);

  const searchResult1 = await attachOpportunityToSearch({
    searchId: searchSession.id,
    opportunityId: oppCreated.id,
    matchScore: 96.5,
    rankPosition: 1,
  });
  assert.strictEqual(searchResult1.searchId, searchSession.id);
  assert.strictEqual(searchResult1.opportunityId, oppCreated.id);

  // Test SearchResult idempotency
  const searchResult1Updated = await attachOpportunityToSearch({
    searchId: searchSession.id,
    opportunityId: oppCreated.id,
    matchScore: 98.0, // Updated score
    rankPosition: 1,
  });
  assert.strictEqual(searchResult1Updated.id, searchResult1.id, "SearchResult attach must be idempotent");
  assert.strictEqual(searchResult1Updated.matchScore, 98.0);

  const searchResult2 = await attachOpportunityToSearch({
    searchId: searchSession.id,
    opportunityId: compositeResult.opportunity.id,
    matchScore: 89.0,
    rankPosition: 2,
  });
  assert.strictEqual(searchResult2.rankPosition, 2);
  console.log("  ✓ Verified Search creation and idempotent SearchResult attachment with ranking");

  // 9. Test Search Results Retrieval with Deep Relations
  const retrievedSearchResults = await getSearchResults(searchSession.id);
  assert.strictEqual(retrievedSearchResults.length, 2);
  assert.strictEqual(retrievedSearchResults[0].opportunityId, oppCreated.id);
  assert.strictEqual(retrievedSearchResults[0].opportunity.sourceListings.length, 2);
  assert.strictEqual(retrievedSearchResults[1].opportunityId, compositeResult.opportunity.id);
  console.log("  ✓ Verified getSearchResults() retrieves ranked opportunities with nested source listings");

  // 10. Test SavedOpportunity Bookmark Lifecycle (Save, Unsave, Check, Idempotency)
  const isSavedBefore = await isOpportunitySaved(user.id, oppCreated.id);
  assert.strictEqual(isSavedBefore, false);

  const savedRecord = await saveOpportunity(user.id, oppCreated.id, "Top choice for summer 2026");
  assert.strictEqual(savedRecord.userId, user.id);
  assert.strictEqual(savedRecord.opportunityId, oppCreated.id);

  const isSavedAfter = await isOpportunitySaved(user.id, oppCreated.id);
  assert.strictEqual(isSavedAfter, true);

  // Idempotent save call (update notes)
  const savedRecordAgain = await saveOpportunity(user.id, oppCreated.id, "Updated notes: interview scheduled");
  assert.strictEqual(savedRecordAgain.id, savedRecord.id, "Saving already bookmarked job must be idempotent");
  assert.strictEqual(savedRecordAgain.notes, "Updated notes: interview scheduled");

  // User-scoped saved opportunities retrieval
  const userSavedList = await getSavedOpportunities(user.id);
  assert.strictEqual(userSavedList.length, 1);
  assert.strictEqual(userSavedList[0].opportunity.id, oppCreated.id);
  assert.strictEqual(userSavedList[0].opportunity.sourceListings.length, 2);

  // Unsave opportunity
  const unsaveResult = await unsaveOpportunity(user.id, oppCreated.id);
  assert.strictEqual(unsaveResult.deleted, true);

  // Idempotent unsave (second call returns { deleted: false } without throwing)
  const unsaveResultAgain = await unsaveOpportunity(user.id, oppCreated.id);
  assert.strictEqual(unsaveResultAgain.deleted, false);

  const isSavedFinal = await isOpportunitySaved(user.id, oppCreated.id);
  assert.strictEqual(isSavedFinal, false);
  console.log("  ✓ Verified SavedOpportunity lifecycle: save, idempotent update, retrieval, and idempotent unsave");

  // 11. Test Direct Retrieval Queries
  const oppById = await getOpportunityById(oppCreated.id);
  assert.strictEqual(oppById?.id, oppCreated.id);

  const oppByHash = await getOpportunityByCanonicalHash(canonicalHash1);
  assert.strictEqual(oppByHash?.id, oppCreated.id);

  const oppWithSources = await getOpportunityWithSourceListings(oppCreated.id);
  assert.strictEqual(oppWithSources?.sourceListings.length, 2);
  console.log("  ✓ Verified getOpportunityById(), getOpportunityByCanonicalHash(), and getOpportunityWithSourceListings()");

  // 12. Test Concurrent Canonical Opportunity Upserts (Simulating 5 concurrent search tasks discovering the same job)
  const concurrentHash = `concurrent_hash_${testSuffix}`;
  const concurrentPromises = Array.from({ length: 5 }).map((_, idx) =>
    upsertOpportunity({
      canonicalHash: concurrentHash,
      title: "Concurrent AI Scientist",
      companyName: "Concurrency Labs",
      location: "San Francisco, CA",
      description: `Discovered concurrently by worker thread ${idx}`,
      primaryApplyUrl: "https://concurrencylabs.ai/apply",
    })
  );

  const concurrentResults = await Promise.all(concurrentPromises);
  const distinctIds = new Set(concurrentResults.map((r) => r.id));
  assert.strictEqual(distinctIds.size, 1, "5 concurrent upserts for the same canonicalHash must resolve to exactly 1 database record");

  const totalInDb = await prisma.opportunity.count({
    where: { canonicalHash: concurrentHash },
  });
  assert.strictEqual(totalInDb, 1, "Database must contain exactly 1 Opportunity for the concurrent canonicalHash");
  console.log("  ✓ Verified concurrent upsert race protection: 5 simultaneous discoveries resolved to exactly 1 record");

  // 13. Test Input Validation & Error Propagation
  let invalidHashRejected = false;
  try {
    await upsertOpportunity({
      canonicalHash: "", // Invalid empty hash
      title: "Invalid",
      companyName: "Invalid",
      location: "Invalid",
      description: "Invalid",
      primaryApplyUrl: "Invalid",
    });
  } catch {
    invalidHashRejected = true;
  }
  assert.ok(invalidHashRejected, "upsertOpportunity must reject empty canonicalHash");

  // Cleanup test fixtures
  await prisma.opportunity.deleteMany({
    where: {
      canonicalHash: {
        in: [canonicalHash1, canonicalHash2, concurrentHash],
      },
    },
  });
  await prisma.search.delete({ where: { id: searchSession.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("  ✓ Cleaned up all integration test records");

  console.log("✓ [INTEGRATION] Opportunity Database & DAL Tests Passed!\n");
}
