/**
 * §TASK-064: SYNTHETIC DATA & MOCK CONNECTOR PURGE VALIDATION HARNESS
 * 
 * Verifies that every production-path source of fabricated job/candidate data
 * has been permanently removed across BrowserPilot.
 * 
 * Tests:
 *  1. Missing external data produces 0 candidates (no synthetic candidates).
 *  2. AtsProvider with unlisted/non-targeted company returns [].
 *  3. LinkedInBrowserConnector without active live browser session returns [].
 *  4. IndeedBrowserConnector without active live browser session returns [].
 *  5. AtsBrowserConnector returns [].
 *  6. CareerPortalBrowserConnector returns [].
 *  7. GitHubJobsProvider returns [].
 *  8. HackerNewsProvider returns [].
 *  9. Database persistence firewall rejects synthetic candidates with explicit Error.
 * 10. DiscoveryExecutionService fallback does not generate mock TechCorp candidates.
 */

process.env.IS_TEST_HARNESS = "true";
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import assert from "node:assert";
import { atsProvider } from "../lib/scraper/providers/atsProvider";
import { githubJobsProvider } from "../lib/scraper/providers/githubJobsProvider";
import { hackerNewsProvider } from "../lib/scraper/providers/hackerNewsProvider";
import { linkedInBrowserConnector } from "../lib/discovery/browser/connectors/linkedInConnector";
import { indeedBrowserConnector } from "../lib/discovery/browser/connectors/indeedConnector";
import {
  greenhouseBrowserConnector,
  ashbyBrowserConnector,
  leverBrowserConnector,
} from "../lib/discovery/browser/connectors/atsBrowserConnector";
import { careerPortalBrowserConnector } from "../lib/discovery/browser/connectors/careerPortalConnector";
import { upsertOpportunity, detectSyntheticOpportunity } from "../lib/db/opportunities";
import { discoveryExecutionService } from "../lib/discovery/execution/discoveryExecutionService";
import { prisma, ensureDatabaseSchema } from "../lib/db/prisma";

async function runTask064Validation() {
  console.log("=================================================================");
  console.log("   TASK-064: SYNTHETIC DATA & MOCK CONNECTOR PURGE VALIDATION    ");
  console.log("=================================================================\n");

  await ensureDatabaseSchema();
  let passedCount = 0;

  // ---------------------------------------------------------------------------
  // SCENARIO 1: AtsProvider returns [] (no fabricated Stripe, Linear, Vercel)
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 1] Verifying AtsProvider does not fabricate mock candidates...");
  {
    const candidates = await atsProvider.harvestCandidates(
      { role: "Software Engineer", location: "Remote" },
      { maxCandidates: 10, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "AtsProvider must return 0 candidates when no live target");
    assert.deepStrictEqual(candidates, []);
    passedCount++;
    console.log("  ✓ AtsProvider returned [] (zero synthetic candidates)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: AtsProvider with company intent returns []
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 2] Verifying AtsProvider with company intent returns []...");
  {
    const candidates = await atsProvider.harvestCandidates(
      { role: "Staff Engineer", company: "Stripe", companies: ["Stripe"] },
      { maxCandidates: 10, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "AtsProvider must not synthesize unverified ATS URLs");
    passedCount++;
    console.log("  ✓ AtsProvider with company intent returned [] without fabrication");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: LinkedInBrowserConnector returns [] without active DOM session
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 3] Verifying LinkedInBrowserConnector returns []...");
  {
    const candidates = await linkedInBrowserConnector.search(
      { role: "Software Engineer", location: "San Francisco, CA" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "LinkedIn connector must not synthesize 'Leading Organization'");
    
    const crawlCandidates = await linkedInBrowserConnector.crawl("https://www.linkedin.com/jobs");
    assert.strictEqual(crawlCandidates.length, 0, "LinkedIn crawl must not fabricate mock candidates");
    passedCount++;
    console.log("  ✓ LinkedInBrowserConnector returned [] (no 'Leading Organization' or fake job IDs)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: IndeedBrowserConnector returns [] without active DOM session
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 4] Verifying IndeedBrowserConnector returns []...");
  {
    const candidates = await indeedBrowserConnector.search(
      { role: "Product Manager", location: "New York, NY" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "Indeed connector must not synthesize 'Leading Employer'");
    
    const crawlCandidates = await indeedBrowserConnector.crawl("https://www.indeed.com/jobs");
    assert.strictEqual(crawlCandidates.length, 0, "Indeed crawl must not fabricate mock candidates");
    passedCount++;
    console.log("  ✓ IndeedBrowserConnector returned [] (no 'Leading Employer' or fake job IDs)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: AtsBrowserConnector (Greenhouse, Ashby, Lever) returns []
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 5] Verifying AtsBrowserConnector returns [] across all ATS types...");
  {
    const ghRes = await greenhouseBrowserConnector.search(
      { role: "Backend Engineer", location: "Remote" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(ghRes.length, 0, "Greenhouse connector must not synthesize job_5001");

    const ashbyRes = await ashbyBrowserConnector.search(
      { role: "Frontend Engineer", location: "Remote" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(ashbyRes.length, 0, "Ashby connector must not synthesize job_5001");

    const leverRes = await leverBrowserConnector.search(
      { role: "DevOps Engineer", location: "Remote" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(leverRes.length, 0, "Lever connector must not synthesize job_5001");
    passedCount++;
    console.log("  ✓ AtsBrowserConnector (Greenhouse, Ashby, Lever) returned [] (no 'job_5001' or fake companies)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: CareerPortalBrowserConnector returns []
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 6] Verifying CareerPortalBrowserConnector returns []...");
  {
    const candidates = await careerPortalBrowserConnector.search(
      { role: "Founding Engineer", location: "Remote" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "Career portal connector must not synthesize defaultCompanies");
    
    const crawlCandidates = await careerPortalBrowserConnector.crawl("https://careers.example.com");
    assert.strictEqual(crawlCandidates.length, 0, "Career portal crawl must not synthesize fake candidates");
    passedCount++;
    console.log("  ✓ CareerPortalBrowserConnector returned [] (no mock career portal links)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: GitHubJobsProvider returns []
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 7] Verifying GitHubJobsProvider returns []...");
  {
    const candidates = await githubJobsProvider.harvestCandidates(
      { role: "Software Engineer Intern", location: "Remote", experienceLevel: "INTERN" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "GitHubJobsProvider must not synthesize sampleRepos");
    passedCount++;
    console.log("  ✓ GitHubJobsProvider returned [] (no mock repo internships)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: HackerNewsProvider returns []
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 8] Verifying HackerNewsProvider returns []...");
  {
    const candidates = await hackerNewsProvider.harvestCandidates(
      { role: "Founding Engineer", location: "Remote" },
      { maxCandidates: 5, timeoutMs: 5000 }
    );
    assert.strictEqual(candidates.length, 0, "HackerNewsProvider must not synthesize sampleStartups");
    passedCount++;
    console.log("  ✓ HackerNewsProvider returned [] (no mock HN hiring thread posts)");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: Database Persistence Firewall rejects synthetic candidates
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 9] Verifying Database Persistence Firewall rejects synthetic data...");
  {
    // 9a. Test detectSyntheticOpportunity helper directly
    const syntheticDetection = detectSyntheticOpportunity({
      title: "Software Engineer",
      companyName: "Leading Organization",
      primaryApplyUrl: "https://www.example.com/apply",
    });
    assert.strictEqual(syntheticDetection.isSynthetic, true);
    assert.ok(syntheticDetection.reason?.includes("leading organization"));

    // 9b. Test upsertOpportunity rejection
    let rejectedAsExpected = false;
    try {
      await upsertOpportunity({
        canonicalHash: "test_synthetic_hash_123",
        title: "Staff Engineer - job_5001",
        companyName: "Acme Corp",
        location: "Remote",
        description: "Test synthetic description",
        primaryApplyUrl: "https://boards.ashby.io/acme/jobs/job_5001",
      });
    } catch (err: any) {
      if (err.message.includes("Cannot upsert synthetic opportunity")) {
        rejectedAsExpected = true;
      } else {
        throw err;
      }
    }
    assert.strictEqual(rejectedAsExpected, true, "upsertOpportunity must reject synthetic opportunity with Error");

    // 9c. Verify genuine non-synthetic record CAN be upserted cleanly
    const genuineRecord = await upsertOpportunity({
      canonicalHash: `genuine_test_hash_${Date.now()}`,
      title: "Senior Backend Engineer",
      companyName: "Stripe",
      location: "San Francisco, CA",
      primaryApplyUrl: "https://stripe.com/jobs/senior-backend-engineer",
      description: "Build payment processing infrastructure.",
      requirements: ["Go", "Distributed Systems"],
      skills: ["Go", "Postgres"],
      status: "ACTIVE",
    });
    assert.ok(genuineRecord.id);
    assert.strictEqual(genuineRecord.companyName, "Stripe");

    passedCount++;
    console.log("  ✓ Database Persistence Firewall successfully blocked synthetic records and allowed genuine records");
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: DiscoveryExecutionService fallback does NOT generate mock TechCorp
  // ---------------------------------------------------------------------------
  console.log("▶ [SCENARIO 10] Verifying DiscoveryExecutionService does not synthesize candidates...");
  {
    const executionResult = await discoveryExecutionService.executeDiscovery({
      intent: {
        role: "Civil Engineer",
        location: "Dallas, TX",
      },
      executionMode: "ONE_TIME",
    });

    const hasMockTechCorp = executionResult.rawCandidates.some(
      (c) => c.companyName === "TechCorp" || c.externalJobId?.includes("cand_")
    );
    assert.strictEqual(hasMockTechCorp, false, "Must not contain TechCorp mock candidate");
    passedCount++;
    console.log("  ✓ DiscoveryExecutionService returned clean results without TechCorp mock fallback");
  }

  console.log("\n=================================================================");
  console.log(`  TASK-064 VALIDATION COMPLETE: ${passedCount}/10 SCENARIOS PASSED! ✅ `);
  console.log("=================================================================\n");
}

runTask064Validation()
  .catch((err) => {
    console.error("❌ TASK-064 Validation Failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
