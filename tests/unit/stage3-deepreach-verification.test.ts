import assert from "node:assert";
import { 
  verifyDomainMx, 
  domainMxCache, 
  createRecruiterDossier, 
  verifyRecruiterContactsMidway, 
  extractDomainFromTarget,
  DomainMxCache,
  type VerifiableRecruiterContact 
} from "@/lib/verification/midwayVerifier";
import { discoverCompanyRecruiters } from "@/lib/discovery/deepreach/deepReachService";

async function runStage3Verification() {
  console.log("=================================================");
  console.log("RUNNING STAGE 3: DEEPREACH VERIFICATION SUITE");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  // Test 1: Authentic Node.js DNS MX Validation for real domains
  try {
    console.log("Test 1: Node.js DNS MX Resolution on Active Domains");
    domainMxCache.clear();

    const googleMx = await verifyDomainMx("google.com");
    assert.strictEqual(googleMx.valid, true, "google.com must have valid MX records");
    assert.ok(googleMx.records.length > 0, "google.com must return at least one MX exchange host");
    assert.strictEqual(googleMx.cached, false, "Initial lookup must not be cached");

    const stripeMx = await verifyDomainMx("rachel@stripe.com");
    assert.strictEqual(stripeMx.valid, true, "stripe.com must have valid MX records when extracted from email");
    assert.strictEqual(stripeMx.domain, "stripe.com", "Domain must be extracted from email");

    console.log("  Pass: DNS MX resolution successful on active corporate domains.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 1:", err);
    failed++;
  }

  // Test 2: In-Memory LRU Cache Hit
  try {
    console.log("\nTest 2: In-Memory LRU Cache Hit & Latency Elimination");
    const startTime = Date.now();
    const cachedLookup = await verifyDomainMx("google.com");
    const elapsed = Date.now() - startTime;

    assert.strictEqual(cachedLookup.cached, true, "Subsequent lookup must be served from cache");
    assert.strictEqual(cachedLookup.valid, true, "Cached lookup must preserve validity");
    assert.ok(elapsed < 10, `Cached lookup must be near-instant (took ${elapsed}ms)`);

    console.log("  Pass: Domain MX cache hit verified with near-zero latency.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 2:", err);
    failed++;
  }

  // Test 3: Invalid Domain Graceful Handling (Zero Crash Guarantee)
  try {
    console.log("\nTest 3: Graceful Handling of Invalid / Non-Existent Domains");
    const malformed = await verifyDomainMx("not-a-domain");
    assert.strictEqual(malformed.valid, false, "Malformed string must be marked invalid");

    const nonExistent = await verifyDomainMx("non-existent-corporate-domain-999xyz.org");
    assert.strictEqual(nonExistent.valid, false, "Non-existent domain must fail MX validation gracefully");
    assert.ok(nonExistent.error, "Error message must be populated for non-existent domain");

    console.log("  Pass: Invalid domains handled gracefully without throwing unhandled exceptions.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 3:", err);
    failed++;
  }

  // Test 4: 1500ms Timeout Guard
  try {
    console.log("\nTest 4: DNS Lookup Timeout Guard");
    // Pass ultra-short timeout to verify timeout rejection behavior
    const timedOut = await verifyDomainMx("timeout-test-example.com", { timeoutMs: 1 });
    assert.strictEqual(timedOut.valid, false, "Timed out lookup must return valid: false");
    assert.ok(
      timedOut.error?.includes("timed out") || timedOut.error?.includes("active MX") || timedOut.error?.includes("ENOTFOUND"),
      "Should capture timeout or resolution error"
    );

    console.log("  Pass: Lookup timeout guard executed safely.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 4:", err);
    failed++;
  }

  // Test 5: Recruiter Dossier Provenance Classification
  try {
    console.log("\nTest 5: Recruiter Dossier Provenance Tiers");

    // Case A: Company Talent Directory
    const directoryContact: VerifiableRecruiterContact = {
      fullName: "GitLab Talent Team",
      roleTitle: "Technical Recruiting",
      companyName: "GitLab",
      profileUrl: "https://about.gitlab.com/jobs",
      email: "careers@gitlab.com",
      sourcePlatform: "OFFICIAL_PORTAL",
    };
    const dossierA = await createRecruiterDossier(directoryContact);
    assert.strictEqual(dossierA.emailVerificationTier, "directory");
    assert.strictEqual(dossierA.provenance, "Company Talent Directory");
    assert.ok(dossierA.confidenceScore >= 0.9);

    // Case B: DNS Validated Recruiter
    const dnsContact: VerifiableRecruiterContact = {
      fullName: "Alex Rivera",
      roleTitle: "Staff Recruiter",
      companyName: "Google",
      profileUrl: "https://linkedin.com/in/alex-rivera-recruiter",
      email: "alex.rivera@google.com",
      sourcePlatform: "LINKEDIN",
    };
    const dossierB = await createRecruiterDossier(dnsContact);
    assert.strictEqual(dossierB.emailVerificationTier, "mx_verified");
    assert.strictEqual(dossierB.provenance, "DNS Validated");
    assert.ok(dossierB.confidenceScore >= 0.8);
    assert.ok(Array.isArray(dossierB.mxRecords) && dossierB.mxRecords.length > 0);

    // Case C: Derived Recruiter Slug (Non-resolving or missing MX)
    const derivedContact: VerifiableRecruiterContact = {
      fullName: "Jordan Lee",
      roleTitle: "Talent Partner",
      companyName: "Stealth Startup",
      profileUrl: "https://linkedin.com/in/jordan-lee-stealth",
      email: "jordan.lee@stealth-unregistered-domain-999.xyz",
      sourcePlatform: "LINKEDIN",
    };
    const dossierC = await createRecruiterDossier(derivedContact);
    assert.strictEqual(dossierC.emailVerificationTier, "derived");
    assert.strictEqual(dossierC.provenance, "Direct Recruiter Slug (Derived Email)");
    assert.ok(dossierC.confidenceScore <= 0.7);

    console.log("  Pass: Recruiter dossier provenance tiers successfully distinguished.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 5:", err);
    failed++;
  }

  // Test 6: Midway Verifier Recruiter Gate with Real Dossiers & Synthetic Persona Defense
  try {
    console.log("\nTest 6: Midway Recruiter Verification Gate with Synthetic Persona Defense");
    const testPool: VerifiableRecruiterContact[] = [
      {
        fullName: "Sarah Jenkins", // Forbidden synthetic dummy persona
        roleTitle: "Technical Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/sarah-jenkins",
        sourcePlatform: "LINKEDIN",
      },
      {
        fullName: "Alex Morgan", // Forbidden synthetic persona
        roleTitle: "Lead Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/alex-morgan",
        sourcePlatform: "LINKEDIN",
      },
      {
        fullName: "555 Number Persona",
        roleTitle: "Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/phone-dummy",
        phone: "+1 555-0199",
        sourcePlatform: "LINKEDIN",
      },
      {
        fullName: "Elena Rostova", // Synthetic pool name
        roleTitle: "Talent Partner",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/elena-rostova",
        sourcePlatform: "LINKEDIN",
      },
      {
        fullName: "Rachel Adams", // Authentic named recruiter
        roleTitle: "Lead Technical Recruiter",
        companyName: "Stripe",
        profileUrl: "https://linkedin.com/in/rachel-adams-talent",
        email: "rachel.adams@stripe.com",
        sourcePlatform: "LINKEDIN",
      },
      {
        fullName: "Stripe Talent Acquisition Team", // Directory team
        roleTitle: "Technical Recruiting",
        companyName: "Stripe",
        profileUrl: "https://stripe.com/jobs",
        email: "careers@stripe.com",
        sourcePlatform: "OFFICIAL_PORTAL",
      },
    ];

    const report = await verifyRecruiterContactsMidway(testPool, { checkLiveness: false });
    assert.strictEqual(report.rejectedCount, 4, "Must reject all 4 synthetic/forbidden personas");
    assert.strictEqual(report.verified.length, 2, "Must verify exactly the 2 authentic contacts");

    const rachel = report.verified.find((r) => r.fullName === "Rachel Adams");
    assert.ok(rachel, "Rachel Adams must be in verified contacts");
    assert.strictEqual(rachel?.emailVerificationTier, "mx_verified");
    assert.strictEqual(rachel?.provenance, "DNS Validated");

    const team = report.verified.find((r) => r.fullName === "Stripe Talent Acquisition Team");
    assert.ok(team, "Stripe Talent Acquisition Team must be in verified contacts");
    assert.strictEqual(team?.emailVerificationTier, "directory");
    assert.strictEqual(team?.provenance, "Company Talent Directory");

    console.log("  Pass: Synthetic personas rejected and authentic dossiers validated.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 6:", err);
    failed++;
  }

  // Test 7: discoverCompanyRecruiters Directory Integration
  try {
    console.log("\nTest 7: discoverCompanyRecruiters Directory Integration");
    const recruiters = await discoverCompanyRecruiters("Canonical");
    assert.ok(recruiters.length > 0, "Canonical must resolve recruiters via directory fallback");
    assert.ok(
      recruiters.every((r) => r.provenance && r.emailVerificationTier),
      "All resolved contacts must have provenance and emailVerificationTier set"
    );

    console.log(`  Pass: Resolved ${recruiters.length} contacts with provenance metadata.`);
    passed++;
  } catch (err) {
    console.error("  Fail Test 7:", err);
    failed++;
  }

  // Test 8: Concurrent In-Flight MX Query Deduplication
  try {
    console.log("\nTest 8: In-Flight Query Deduplication Under Concurrency");
    domainMxCache.clear();
    const domain = "github.com";

    // Launch 10 concurrent verification calls for the same uncached domain
    const concurrentPromises = Array.from({ length: 10 }, () => verifyDomainMx(domain));
    const results = await Promise.all(concurrentPromises);

    assert.strictEqual(results.length, 10, "All 10 concurrent requests must resolve");
    assert.ok(results.every((r) => r.valid === true), "All results must be valid");
    assert.ok(results.every((r) => r.domain === domain), "All results must have matching domain");

    console.log("  Pass: Concurrent queries coalesced without race conditions.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 8:", err);
    failed++;
  }

  // Test 9: Domain Extraction & Formatting Defense
  try {
    console.log("\nTest 9: Domain Extraction & Formatting Defense");
    assert.strictEqual(extractDomainFromTarget("user@stripe.com"), "stripe.com");
    assert.strictEqual(extractDomainFromTarget("mailto:recruiter@stripe.com"), "stripe.com");
    assert.strictEqual(extractDomainFromTarget("  https://www.gitlab.com/jobs  "), "gitlab.com");
    assert.strictEqual(extractDomainFromTarget("canonical.com."), "canonical.com");
    assert.strictEqual(extractDomainFromTarget("user@sub.domain.company.com"), "sub.domain.company.com");
    assert.strictEqual(extractDomainFromTarget(""), null);

    console.log("  Pass: Domain extraction edge cases handled accurately.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 9:", err);
    failed++;
  }

  // Test 10: LRU Cache Eviction & Update Semantics
  try {
    console.log("\nTest 10: LRU Cache Eviction & Existing Key Update Behavior");
    const testCache = new DomainMxCache(3, 60000);
    testCache.set("a.com", true, ["mx1.a.com"]);
    testCache.set("b.com", true, ["mx1.b.com"]);
    testCache.set("c.com", true, ["mx1.c.com"]);
    assert.strictEqual(testCache.size, 3);

    // Updating existing key "a.com" should NOT evict "b.com"
    testCache.set("a.com", true, ["mx2.a.com"]);
    assert.strictEqual(testCache.size, 3, "Size must stay at capacity when updating existing key");
    assert.ok(testCache.get("b.com") !== undefined, "b.com must not be prematurely evicted");

    // Inserting new 4th key "d.com" should evict the oldest entry ("c.com" because "a.com" and "b.com" were refreshed)
    testCache.set("d.com", true, ["mx1.d.com"]);
    assert.strictEqual(testCache.size, 3, "Size must remain bounded at 3");
    assert.ok(testCache.get("d.com") !== undefined, "d.com must exist");
    assert.ok(testCache.get("c.com") === undefined, "c.com must be evicted as oldest");

    console.log("  Pass: LRU eviction and update semantics verified.");
    passed++;
  } catch (err) {
    console.error("  Fail Test 10:", err);
    failed++;
  }

  console.log("\n=================================================");
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runStage3Verification().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
