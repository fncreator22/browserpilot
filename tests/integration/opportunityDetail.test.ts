import assert from "assert";
import { 
  upsertOpportunity, 
  upsertSourceListing, 
  getOpportunityWithSourceListings, 
  saveOpportunity, 
  isOpportunitySaved 
} from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";

export async function runOpportunityDetailIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Opportunity Detail & Evidence Workspace Tests (TASK-007)...");

  // 1. Create test user fixture
  const testUser = await prisma.user.create({
    data: {
      email: `detail-user-${Date.now()}@integration.ai`,
      name: "Detail Integration User",
      passwordHash: "dummy-hash",
    },
  });

  const otherUser = await prisma.user.create({
    data: {
      email: `detail-other-${Date.now()}@integration.ai`,
      name: "Detail Other User",
      passwordHash: "dummy-hash",
    },
  });

  // 2. Persist canonical opportunity with multiple source listings and evidence
  const canonicalHash = `detail_canonical_${Date.now()}`;
  const opp = await upsertOpportunity({
    canonicalHash,
    title: "Lead AI Systems Architect",
    companyName: "Frontier Intelligence",
    location: "San Francisco, CA",
    workMode: "HYBRID",
    experienceLevel: "MID",
    opportunityType: "FULL_TIME",
    salaryMin: 220000,
    salaryMax: 310000,
    salaryCurrency: "USD",
    description: "Architect and lead real-time multi-agent autonomous browser execution fleets.",
    requirements: ["10+ years backend systems", "Expertise in Playwright/Puppeteer", "Distributed Redis queues"],
    skills: ["TypeScript", "Node.js", "Playwright", "Distributed Systems"],
    primaryApplyUrl: "https://frontier.ai/careers/lead-architect",
    status: "ACTIVE",
  });

  assert.ok(opp.id, "Opportunity record must be created with ID");

  // Attach multiple independent source listings
  await upsertSourceListing({
    opportunityId: opp.id,
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/999111",
    applyUrl: "https://linkedin.com/jobs/apply/999111",
    verificationStatus: "VERIFIED",
    screenshotPath: "/api/artifacts/search_test/evidence_lead_ai_1.png",
  });

  await upsertSourceListing({
    opportunityId: opp.id,
    sourcePlatform: "Y Combinator",
    sourceUrl: "https://workatastartup.com/companies/frontier/jobs/lead-arch",
    applyUrl: "https://workatastartup.com/apply/lead-arch",
    verificationStatus: "UNVERIFIED",
  });

  // 3. Test DAL lookup by ID and by canonical hash
  const fetchedById = await getOpportunityWithSourceListings(opp.id);
  assert.ok(fetchedById, "Must retrieve opportunity by ID");
  assert.strictEqual(fetchedById?.title, "Lead AI Systems Architect");
  assert.strictEqual(fetchedById?.sourceListings.length, 2, "Must retrieve all 2 independent source listings");

  const fetchedByHash = await getOpportunityWithSourceListings(canonicalHash);
  assert.ok(fetchedByHash, "Must retrieve opportunity by canonical hash");
  assert.strictEqual(fetchedByHash?.id, opp.id, "Lookup by canonical hash must match ID");
  console.log("  ✓ Verified Opportunity DAL lookup by ID and canonical hash with complete source listings");

  // 4. Verify independent source URLs and apply URLs
  const linkedInSource = fetchedById?.sourceListings.find((s) => s.sourcePlatform === "LinkedIn");
  const ycSource = fetchedById?.sourceListings.find((s) => s.sourcePlatform === "Y Combinator");

  assert.ok(linkedInSource, "LinkedIn source must exist");
  assert.ok(ycSource, "YC source must exist");
  assert.strictEqual(linkedInSource?.applyUrl, "https://linkedin.com/jobs/apply/999111");
  assert.strictEqual(ycSource?.applyUrl, "https://workatastartup.com/apply/lead-arch");
  assert.notStrictEqual(linkedInSource?.applyUrl, ycSource?.applyUrl, "Source apply URLs must remain independent");
  assert.strictEqual(linkedInSource?.verificationStatus, "VERIFIED");
  assert.strictEqual(linkedInSource?.screenshotPath, "/api/artifacts/search_test/evidence_lead_ai_1.png");
  assert.strictEqual(ycSource?.verificationStatus, "UNVERIFIED");
  assert.strictEqual(ycSource?.screenshotPath, null);
  console.log("  ✓ Verified independent source listings, apply URLs, and truthful visual evidence metadata");

  // 5. Test user bookmarking state
  let isSaved = await isOpportunitySaved(testUser.id, opp.id);
  assert.strictEqual(isSaved, false, "Initial state must be unsaved");

  await saveOpportunity(testUser.id, opp.id, "Target position for Q4");
  isSaved = await isOpportunitySaved(testUser.id, opp.id);
  assert.strictEqual(isSaved, true, "Must be marked saved for testUser");

  const otherUserSaved = await isOpportunitySaved(otherUser.id, opp.id);
  assert.strictEqual(otherUserSaved, false, "Must remain unsaved for otherUser (Strict Multi-Tenant Isolation)");
  console.log("  ✓ Verified user-scoped saved state and multi-tenant bookmark isolation");

  // 6. Test nonexistent lookup
  const notFound = await getOpportunityWithSourceListings("nonexistent_id_99999");
  assert.strictEqual(notFound, null, "Nonexistent opportunity must return null");
  console.log("  ✓ Verified 404 behavior for nonexistent opportunity lookup");

  console.log("✓ [INTEGRATION] Opportunity Detail & Evidence Workspace Tests Passed!\n");
}
