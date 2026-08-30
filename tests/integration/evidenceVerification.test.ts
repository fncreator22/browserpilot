import assert from "assert";
import http from "http";
import { verifyEvidenceForOpportunities } from "@/lib/scraper/evidenceVerifier";
import type { RankedOpportunity } from "@/lib/scraper/ranker";
import type { DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

const PORT = 3996;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function createTestServer(): http.Server {
  return http.createServer((req, res) => {
    const url = req.url || "/";

    if (url === "/job-genuine") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>AI Engineer Intern - Anthropic Careers</title></head>
        <body style="font-family: sans-serif; padding: 20px;">
          <h1>AI Engineer Intern</h1>
          <h2>Anthropic AI - San Francisco, CA (Remote Allowed)</h2>
          <div class="job-description">
            <p>We are seeking an exceptional AI Engineer Intern to build frontier safety architectures.</p>
            <h3>Responsibilities:</h3>
            <ul>
              <li>Implement scalable evaluation benchmarks for constitutional AI models.</li>
              <li>Work with PyTorch, CUDA, and distributed inference workers.</li>
              <li>Collaborate with research scientists on automated red-teaming.</li>
            </ul>
            <h3>Qualifications:</h3>
            <ul>
              <li>Proficiency in Python and deep learning frameworks (PyTorch, JAX).</li>
              <li>Expected graduation year: 2026 or 2027 in CS or related field.</li>
            </ul>
            <p>Salary: $65 - $80 / hour + equity participation</p>
            <button id="apply-btn" style="padding: 10px 20px; background: #0066cc; color: white;">Apply Now</button>
          </div>
        </body>
        </html>
      `);
      return;
    }

    if (url === "/job-blank") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><body>Hi</body></html>`);
      return;
    }

    if (url === "/job-login-wall") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>Sign In to Continue</title></head>
        <body>
          <h2>Enterprise Portal</h2>
          <p>Please log in to your company account to view this confidential job page.</p>
          <form>
            <input type="text" placeholder="Username" /><br/>
            <input type="password" placeholder="Password" /><br/>
            <button type="submit">Sign In</button>
          </form>
        </body>
        </html>
      `);
      return;
    }

    if (url === "/job-404") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested job posting does not exist.</p></body></html>`);
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  });
}

export async function runEvidenceVerificationIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Playwright Evidence Verification & Screenshot Proof Pipeline Tests (TASK-006)...");

  // Start local mock test server
  const server = createTestServer();
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));

  try {
    const oppGenuine: DeduplicatedOpportunity = {
      canonicalHash: "hash_genuine_ai_intern",
      title: "AI Engineer Intern",
      companyName: "Anthropic",
      location: "Remote",
      workMode: "REMOTE",
      experienceLevel: "INTERN",
      opportunityType: "INTERNSHIP",
      description: "Build frontier safety architectures with PyTorch.",
      requirements: ["Python", "PyTorch"],
      skills: ["Python", "PyTorch"],
      primaryApplyUrl: `${BASE_URL}/job-genuine`,
      sourceListings: [
        {
          sourcePlatform: "LinkedIn",
          sourceUrl: `${BASE_URL}/job-genuine`,
          applyUrl: `${BASE_URL}/job-genuine`,
          verificationStatus: "UNVERIFIED",
          seenAt: new Date(),
        },
      ],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    };

    const oppBlank: DeduplicatedOpportunity = {
      canonicalHash: "hash_blank_page",
      title: "Software Engineer",
      companyName: "Blank Corp",
      location: "Remote",
      workMode: "REMOTE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      description: "Short description",
      requirements: [],
      skills: [],
      primaryApplyUrl: `${BASE_URL}/job-blank`,
      sourceListings: [
        {
          sourcePlatform: "Indeed",
          sourceUrl: `${BASE_URL}/job-blank`,
          applyUrl: `${BASE_URL}/job-blank`,
          verificationStatus: "UNVERIFIED",
          seenAt: new Date(),
        },
      ],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    };

    const oppLogin: DeduplicatedOpportunity = {
      canonicalHash: "hash_login_wall",
      title: "Backend Engineer",
      companyName: "Private Corp",
      location: "Remote",
      workMode: "REMOTE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      description: "Private listing",
      requirements: [],
      skills: [],
      primaryApplyUrl: `${BASE_URL}/job-login-wall`,
      sourceListings: [
        {
          sourcePlatform: "Y Combinator",
          sourceUrl: `${BASE_URL}/job-login-wall`,
          applyUrl: `${BASE_URL}/job-login-wall`,
          verificationStatus: "UNVERIFIED",
          seenAt: new Date(),
        },
      ],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    };

    const opp404: DeduplicatedOpportunity = {
      canonicalHash: "hash_404_error",
      title: "DevOps Engineer",
      companyName: "Dead Corp",
      location: "Remote",
      workMode: "REMOTE",
      experienceLevel: "ENTRY_LEVEL",
      opportunityType: "FULL_TIME",
      description: "Dead link",
      requirements: [],
      skills: [],
      primaryApplyUrl: `${BASE_URL}/job-404`,
      sourceListings: [
        {
          sourcePlatform: "LinkedIn",
          sourceUrl: `${BASE_URL}/job-404`,
          applyUrl: `${BASE_URL}/job-404`,
          verificationStatus: "UNVERIFIED",
          seenAt: new Date(),
        },
      ],
      firstSeenAt: new Date(),
      lastVerifiedAt: new Date(),
      status: "ACTIVE",
    };

    const rankedCandidates: RankedOpportunity[] = [
      { opportunity: oppGenuine, totalScore: 95, rankPosition: 1, breakdown: { role: 35, skills: 25, workMode: 15, freshness: 15, verification: 5 } },
      { opportunity: oppBlank, totalScore: 70, rankPosition: 2, breakdown: { role: 25, skills: 15, workMode: 15, freshness: 10, verification: 5 } },
      { opportunity: oppLogin, totalScore: 65, rankPosition: 3, breakdown: { role: 20, skills: 15, workMode: 15, freshness: 10, verification: 5 } },
      { opportunity: opp404, totalScore: 60, rankPosition: 4, breakdown: { role: 20, skills: 10, workMode: 15, freshness: 10, verification: 5 } },
    ];

    const result = await verifyEvidenceForOpportunities(rankedCandidates, {
      maxCandidates: 4,
      candidateTimeoutMs: 5000,
      globalTimeoutMs: 15000,
      searchId: "test_integration_search_1",
      allowLocalForTests: true,
    });

    // 1. Check genuine job candidate verification
    const verifiedOpp = result.verifiedOpportunities.find((o) => o.opportunity.canonicalHash === "hash_genuine_ai_intern");
    assert.ok(verifiedOpp, "Genuine opportunity must be present in result");
    assert.strictEqual(verifiedOpp.opportunity.sourceListings[0].verificationStatus, "VERIFIED", "Genuine job listing must be marked VERIFIED");
    assert.ok(verifiedOpp.opportunity.sourceListings[0].screenshotPath, "Genuine job listing must have screenshotPath populated");
    assert.ok(verifiedOpp.opportunity.sourceListings[0].screenshotPath.startsWith("/api/artifacts/"), "Screenshot path must follow artifact storage routing");
    console.log("  ✓ Verified genuine job page visual verification & screenshot capture");

    // 2. Check blank page rejection
    const blankOpp = result.verifiedOpportunities.find((o) => o.opportunity.canonicalHash === "hash_blank_page");
    assert.strictEqual(blankOpp?.opportunity.sourceListings[0].verificationStatus, "UNVERIFIED", "Blank page must remain UNVERIFIED");
    assert.strictEqual(blankOpp?.opportunity.sourceListings[0].screenshotPath, undefined, "Blank page must not have screenshot");
    console.log("  ✓ Verified blank / white-screen page rejection without fake evidence");

    // 3. Check login wall rejection
    const loginOpp = result.verifiedOpportunities.find((o) => o.opportunity.canonicalHash === "hash_login_wall");
    assert.strictEqual(loginOpp?.opportunity.sourceListings[0].verificationStatus, "UNVERIFIED", "Login wall must remain UNVERIFIED");
    console.log("  ✓ Verified login wall rejection");

    // 4. Check 404 error rejection
    const notFoundOpp = result.verifiedOpportunities.find((o) => o.opportunity.canonicalHash === "hash_404_error");
    assert.strictEqual(notFoundOpp?.opportunity.sourceListings[0].verificationStatus, "UNVERIFIED", "404 page must remain UNVERIFIED");
    console.log("  ✓ Verified HTTP 404 error page rejection");

    // 5. Check telemetry
    assert.strictEqual(result.telemetry.candidatesConsidered, 4);
    assert.strictEqual(result.telemetry.candidatesVerified, 1);
    assert.strictEqual(result.telemetry.candidatesRejected, 3);
    assert.strictEqual(result.telemetry.screenshotsCaptured, 1);
    console.log("  ✓ Verified verification telemetry collection (1 verified, 3 rejected, 1 screenshot captured)");

    console.log("✓ [INTEGRATION] Playwright Evidence Verification Tests Passed!\n");
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
