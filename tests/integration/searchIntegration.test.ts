import assert from "assert";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { executeSearchPipeline } from "@/lib/scraper/searchPipeline";
import { 
  saveOpportunity, 
  unsaveOpportunity, 
  isOpportunitySaved, 
  getSavedOpportunities,
  getSearchResults,
  upsertOpportunity
} from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export async function runSearchIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Production Search & Opportunity Integration Tests (TASK-005)...");

  // -------------------------------------------------------------
  // 1. Deterministic SearchIntent Extraction Tests
  // -------------------------------------------------------------
  const query = "Find remote AI internships for 2026 graduates in India at startups";
  const intent = parseSearchIntent(query);

  assert.strictEqual(intent.workMode, "REMOTE", "Must extract workMode = REMOTE");
  assert.strictEqual(intent.experienceLevel, "INTERN", "Must extract experienceLevel = INTERN");
  assert.strictEqual(intent.opportunityType, "INTERNSHIP", "Must extract opportunityType = INTERNSHIP");
  assert.strictEqual(intent.targetGradYear, 2026, "Must extract targetGradYear = 2026");
  assert.strictEqual(intent.companyType, "STARTUP", "Must extract companyType = STARTUP");
  assert.strictEqual(intent.location, "India", "Must extract location = India");
  assert.strictEqual(intent.role, "AI Engineer", "Must extract role = AI Engineer");
  assert.ok(Array.isArray(intent.skills) && intent.skills.includes("ai"), "Must extract 'ai' skill");
  console.log("  ✓ Verified deterministic SearchIntent extraction (role, skills, workMode, gradYear, companyType)");

  // Filter overrides test
  const intentOverridden = parseSearchIntent("Python jobs", {
    workMode: "HYBRID",
    experienceLevel: "SENIOR",
    targetGradYear: 2025,
  });
  assert.strictEqual(intentOverridden.workMode, "HYBRID", "Explicit filter override must take priority");
  assert.strictEqual(intentOverridden.experienceLevel, "SENIOR");
  assert.strictEqual(intentOverridden.targetGradYear, 2025);
  console.log("  ✓ Verified filter overrides precedence over natural language extraction");

  // -------------------------------------------------------------
  // 2. Search Pipeline & DAL Persistence Integration Test
  // -------------------------------------------------------------
  // Create test user
  const testEmail = `search-user-${Date.now()}@integration.ai`;
  const testUser = await prisma.user.create({
    data: {
      email: testEmail,
      name: "Search Integration User",
      passwordHash: "dummy-hash",
    },
  });

  const pipelineResult = await executeSearchPipeline(intent, {
    userId: testUser.id,
    rawQuery: query,
    persistToDb: true,
    maxResults: 3,
  });

  assert.ok(pipelineResult.rankedOpportunities.length > 0, "Must return ranked opportunities");
  assert.ok(pipelineResult.rankedOpportunities.length <= 3, "Must respect maxResults = 3");
  assert.ok(pipelineResult.searchId, "Must persist and return searchId");
  assert.strictEqual(pipelineResult.rankedOpportunities[0].rankPosition, 1, "Top item must have rankPosition = 1");
  console.log(`  ✓ Verified Search Pipeline execution & maxResults boundary (${pipelineResult.rankedOpportunities.length} returned)`);

  // Verify persistence in SQLite / Turso database
  const searchResultsFromDb = await getSearchResults(pipelineResult.searchId!);
  assert.ok(searchResultsFromDb.length > 0, "SearchResults must be persisted in database");
  assert.strictEqual(searchResultsFromDb[0].searchId, pipelineResult.searchId);
  assert.ok(searchResultsFromDb[0].opportunity.title, "Attached opportunity must be loaded");
  assert.ok(searchResultsFromDb[0].opportunity.sourceListings.length > 0, "Attached source listings must be loaded");
  console.log("  ✓ Verified Database Persistence (Search -> SearchResults -> Opportunity -> SourceListings)");

  // -------------------------------------------------------------
  // 3. User Bookmarking / Saved Opportunity Flow
  // -------------------------------------------------------------
  const topOppId = searchResultsFromDb[0].opportunityId;

  // Initial state: not saved
  let isSaved = await isOpportunitySaved(testUser.id, topOppId);
  assert.strictEqual(isSaved, false, "Initial opportunity must not be saved");

  // Save opportunity
  const savedRecord = await saveOpportunity(testUser.id, topOppId, "Exciting 2026 AI intern position");
  assert.ok(savedRecord.id, "Save must create SavedOpportunity record");

  isSaved = await isOpportunitySaved(testUser.id, topOppId);
  assert.strictEqual(isSaved, true, "Opportunity must be marked saved");

  // Save idempotency (calling save again should succeed without duplicate key error)
  const savedAgain = await saveOpportunity(testUser.id, topOppId, "Updated notes");
  assert.strictEqual(savedAgain.id, savedRecord.id, "Save must be idempotent");

  // Retrieve saved opportunities for testUser
  const savedList = await getSavedOpportunities(testUser.id);
  assert.strictEqual(savedList.length, 1, "Must return exactly 1 saved opportunity");
  assert.strictEqual(savedList[0].opportunityId, topOppId);
  assert.strictEqual(savedList[0].notes, "Updated notes");
  assert.ok(savedList[0].opportunity.title, "Saved opportunity must include full opportunity relation");
  assert.ok(savedList[0].opportunity.sourceListings.length > 0, "Saved opportunity must include sourceListings");
  console.log("  ✓ Verified saveOpportunity() idempotency and getSavedOpportunities() retrieval");

  // User isolation: Create another user and verify User B cannot see User A's saved opportunities
  const otherUser = await prisma.user.create({
    data: {
      email: `other-user-${Date.now()}@integration.ai`,
      name: "Other User",
      passwordHash: "dummy-hash",
    },
  });

  const otherUserSaved = await getSavedOpportunities(otherUser.id);
  assert.strictEqual(otherUserSaved.length, 0, "Other user must have 0 saved opportunities (Strict User Isolation)");

  const isSavedForOther = await isOpportunitySaved(otherUser.id, topOppId);
  assert.strictEqual(isSavedForOther, false, "Opportunity must not be saved for other user");
  console.log("  ✓ Verified Multi-Tenant Saved Opportunity User Isolation");

  // Unsave opportunity
  const unsaveResult = await unsaveOpportunity(testUser.id, topOppId);
  assert.strictEqual(unsaveResult.deleted, true, "Unsave must report deleted = true");

  isSaved = await isOpportunitySaved(testUser.id, topOppId);
  assert.strictEqual(isSaved, false, "Opportunity must no longer be saved after unsave");

  // Unsave idempotency
  const unsaveAgain = await unsaveOpportunity(testUser.id, topOppId);
  assert.strictEqual(unsaveAgain.deleted, false, "Second unsave must safely return deleted = false");
  console.log("  ✓ Verified unsaveOpportunity() deletion and idempotency");

  console.log("✓ [INTEGRATION] Production Search & Opportunity Integration Tests Passed!\n");
}
