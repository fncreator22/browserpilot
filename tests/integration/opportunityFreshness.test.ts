import assert from "assert";
import http from "http";
import { 
  validateJobPageContent, 
  isListingFresh, 
  revalidateSourceListing, 
  revalidateOpportunity, 
  revalidateSavedOpportunities 
} from "@/lib/scraper/evidenceVerifier";
import { 
  upsertOpportunity, 
  upsertSourceListing, 
  getOpportunityWithSourceListings, 
  saveOpportunity 
} from "@/lib/db/opportunities";
import { prisma } from "@/lib/db/prisma";
import { browserPool } from "@/worker/browser";

export async function runOpportunityFreshnessIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Opportunity Freshness & Lifecycle Revalidation Tests (TASK-009)...");

  // 1. Test Deterministic Freshness Rules
  const recentDate = new Date(Date.now() - 1000 * 60 * 30); // 30 minutes ago
  const staleDate = new Date(Date.now() - 1000 * 60 * 60 * 48); // 48 hours ago

  assert.strictEqual(isListingFresh(recentDate), true, "Recent listing within 24h TTL must be fresh");
  assert.strictEqual(isListingFresh(staleDate), false, "48h old listing must be stale");
  assert.strictEqual(isListingFresh(null), false, "Null timestamp must not be fresh");
  assert.strictEqual(isListingFresh(undefined), false, "Undefined timestamp must not be fresh");
  console.log("  ✓ Verified deterministic freshness TTL and skip rules");

  // 2. Test Content Validation Lifecycle Classification
  const genuineValidation = validateJobPageContent(
    "Join our AI research laboratory. Responsibilities: Design and implement neural architectures, optimize LLM inference pipelines, and deploy scalable microservices. Requirements: Python, PyTorch, TypeScript, and distributed systems. Salary: $180k - $240k USD.",
    "Senior AI Engineer - Careers"
  );
  assert.strictEqual(genuineValidation.isValid, true);
  assert.strictEqual(genuineValidation.status, "VERIFIED");

  const expiredValidation = validateJobPageContent(
    "Thank you for your interest. This job has expired and is no longer accepting applications.",
    "Job Expired"
  );
  assert.strictEqual(expiredValidation.isValid, false);
  assert.strictEqual(expiredValidation.status, "EXPIRED");

  const removed404Validation = validateJobPageContent(
    "404 - The page you were looking for doesn't exist.",
    "404 Page Not Found",
    404
  );
  assert.strictEqual(removed404Validation.isValid, false);
  assert.strictEqual(removed404Validation.status, "REMOVED");

  const blocked403Validation = validateJobPageContent(
    "Access Denied. You do not have permission to view this resource.",
    "403 Forbidden",
    403
  );
  assert.strictEqual(blocked403Validation.isValid, false);
  assert.strictEqual(blocked403Validation.status, "BLOCKED");

  const captchaValidation = validateJobPageContent(
    "Please verify you are human to continue. Cloudflare Ray ID: 8899aabbcc.",
    "Security Check"
  );
  assert.strictEqual(captchaValidation.isValid, false);
  assert.strictEqual(captchaValidation.status, "BLOCKED", "CAPTCHA must be classified as BLOCKED, not EXPIRED");

  const blankValidation = validateJobPageContent("Too short", "Empty");
  assert.strictEqual(blankValidation.isValid, false);
  assert.strictEqual(blankValidation.status, "UNVERIFIED");
  console.log("  ✓ Verified deterministic lifecycle classifications (VERIFIED, EXPIRED, REMOVED, BLOCKED, UNVERIFIED)");

  // 3. Test Local Mock HTTP Fixture Server for Revalidation
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/active-job") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Full Stack Engineer - WorkAtAStartup</title></head>
          <body>
            <h1>Full Stack Engineer</h1>
            <p>About the role: Build scalable distributed web applications using TypeScript and Node.js.</p>
            <p>Responsibilities: Architect backend microservices, implement high-performance APIs, collaborate with ML teams.</p>
            <p>Requirements: 5+ years experience, solid understanding of distributed databases and cloud platforms.</p>
            <button id="apply-btn">Apply Now</button>
          </body>
        </html>
      `);
    } else if (url === "/expired-job") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Position Closed</title></head>
          <body>
            <h1>Position Closed</h1>
            <p>This job has expired and the position has been filled. Thank you for your interest.</p>
          </body>
        </html>
      `);
    } else if (url === "/not-found") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<html><body><h1>404 Page Not Found</h1></body></html>");
    } else {
      res.writeHead(400);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const serverAddress = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${serverAddress.port}`;

  try {
    // 4. Test revalidateSourceListing against live local fixtures
    const activeResult = await revalidateSourceListing(
      {
        sourcePlatform: "YC",
        sourceUrl: `${baseUrl}/active-job`,
      },
      { allowLocalForTests: true, timeoutMs: 3000, force: true }
    );
    assert.strictEqual(activeResult.status, "VERIFIED");
    assert.ok(activeResult.screenshotPath, "Verified source must capture screenshot proof");

    const expiredResult = await revalidateSourceListing(
      {
        sourcePlatform: "LinkedIn",
        sourceUrl: `${baseUrl}/expired-job`,
      },
      { allowLocalForTests: true, timeoutMs: 3000, force: true }
    );
    assert.strictEqual(expiredResult.status, "EXPIRED");
    assert.strictEqual(expiredResult.screenshotPath, null, "Expired source must not have fake screenshot");

    const removedResult = await revalidateSourceListing(
      {
        sourcePlatform: "Indeed",
        sourceUrl: `${baseUrl}/not-found`,
      },
      { allowLocalForTests: true, timeoutMs: 3000, force: true }
    );
    assert.strictEqual(removedResult.status, "REMOVED");

    // SSRF Guard
    const ssrfResult = await revalidateSourceListing(
      {
        sourcePlatform: "Malicious",
        sourceUrl: "http://169.254.169.254/latest/meta-data/",
      },
      { allowLocalForTests: false, timeoutMs: 2000, force: true }
    );
    assert.strictEqual(ssrfResult.status, "BLOCKED");
    console.log("  ✓ Verified live revalidation of active, expired, removed, and SSRF-blocked listings");

    // 5. Test Canonical Opportunity State Derivation
    // Opportunity A: Has 1 active and 1 expired source -> Canonical Status remains ACTIVE
    const multiOpp = await upsertOpportunity({
      canonicalHash: `multi_source_opp_${Date.now()}`,
      title: "Full Stack Engineer",
      companyName: "Hyper Scale Inc",
      location: "San Francisco, CA",
      workMode: "HYBRID",
      description: "Build distributed architectures",
      primaryApplyUrl: `${baseUrl}/active-job`,
      status: "ACTIVE",
    });

    await upsertSourceListing({
      opportunityId: multiOpp.id,
      sourcePlatform: "YC",
      sourceUrl: `${baseUrl}/active-job`,
      applyUrl: `${baseUrl}/active-job`,
      verificationStatus: "UNVERIFIED",
    });

    await upsertSourceListing({
      opportunityId: multiOpp.id,
      sourcePlatform: "LinkedIn",
      sourceUrl: `${baseUrl}/expired-job`,
      applyUrl: `${baseUrl}/expired-job`,
      verificationStatus: "UNVERIFIED",
    });

    const multiSummary = await revalidateOpportunity(multiOpp.id, {
      allowLocalForTests: true,
      force: true,
    });

    assert.ok(multiSummary, "Must produce revalidation summary");
    assert.strictEqual(multiSummary?.newStatus, "ACTIVE", "Canonical status remains ACTIVE if at least 1 source is verified");
    assert.strictEqual(multiSummary?.sourcesVerified, 1);
    assert.strictEqual(multiSummary?.sourcesExpired, 1);

    // Opportunity B: Has ONLY expired and removed sources -> Canonical Status flips to EXPIRED
    const deadOpp = await upsertOpportunity({
      canonicalHash: `dead_source_opp_${Date.now()}`,
      title: "Deprecated Legacy Role",
      companyName: "Legacy Corp",
      location: "Remote",
      workMode: "REMOTE",
      description: "Old listing",
      primaryApplyUrl: `${baseUrl}/expired-job`,
      status: "ACTIVE",
    });

    await upsertSourceListing({
      opportunityId: deadOpp.id,
      sourcePlatform: "LinkedIn",
      sourceUrl: `${baseUrl}/expired-job`,
      applyUrl: `${baseUrl}/expired-job`,
      verificationStatus: "UNVERIFIED",
    });

    await upsertSourceListing({
      opportunityId: deadOpp.id,
      sourcePlatform: "Indeed",
      sourceUrl: `${baseUrl}/not-found`,
      applyUrl: `${baseUrl}/not-found`,
      verificationStatus: "UNVERIFIED",
    });

    const deadSummary = await revalidateOpportunity(deadOpp.id, {
      allowLocalForTests: true,
      force: true,
    });

    assert.strictEqual(deadSummary?.newStatus, "EXPIRED", "Canonical status must flip to EXPIRED when all sources are dead");

    const updatedDeadOpp = await getOpportunityWithSourceListings(deadOpp.id);
    assert.strictEqual(updatedDeadOpp?.status, "EXPIRED", "Persisted opportunity status must be EXPIRED");
    console.log("  ✓ Verified canonical opportunity status derivation from independent child source listings");

    // 6. Test Saved Opportunity Prioritization & Revalidation
    const testUser = await prisma.user.create({
      data: {
        email: `saved-freshness-${Date.now()}@integration.ai`,
        name: "Saved Freshness User",
        passwordHash: "dummy-hash",
      },
    });

    await saveOpportunity(testUser.id, multiOpp.id, "Saved target");
    await saveOpportunity(testUser.id, deadOpp.id, "Saved dead target");

    const savedRevalResult = await revalidateSavedOpportunities(testUser.id, {
      maxCandidates: 5,
      force: true,
      allowLocalForTests: true,
    });

    assert.strictEqual(savedRevalResult.totalSaved, 2);
    assert.strictEqual(savedRevalResult.revalidatedCount, 2);
    console.log("  ✓ Verified saved opportunity monitoring and priority revalidation");

  } finally {
    server.closeAllConnections?.();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await browserPool.closeAll().catch(() => {});
  }

  console.log("✓ [INTEGRATION] Opportunity Freshness & Lifecycle Revalidation Tests Passed!\n");
}
