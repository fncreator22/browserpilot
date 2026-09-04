/**
 * §TASK-063 PHYSICAL VALIDATION & RUNTIME AUDIT SUITE
 * 
 * Physically executes and validates all 20 required scenarios (A through T)
 * plus the Section 35 domain-neutral search engine acceptance flow:
 * 
 * A. Valid public job -> LIVE_OPEN_JOB
 * B. Dead valid-looking ATS URL -> DEAD_NOT_FOUND (NOT VERIFIED)
 * C. Closed job -> LIVE_CLOSED_JOB (NOT VERIFIED)
 * D. Generic career page -> GENERIC_PORTAL (NOT VERIFIED)
 * E. Search results page -> SEARCH_RESULTS_PAGE (NOT VERIFIED)
 * F. Redirect to career root -> GENERIC_PORTAL (Rejection)
 * G. Ashby application URL -> APPLICATION_PORTAL
 * H. 403 HTTP response -> BLOCKED
 * I. 429 HTTP response -> RATE_LIMITED
 * J. CAPTCHA response -> CAPTCHA_DETECTED (No bypass)
 * K. Timeout -> TIMEOUT
 * L. SSRF / Private IP / Localhost -> Rejected
 * M. Synthetic candidates -> Rejected by Firewall (NOT VERIFIED)
 * N. Dynamic source discovery (Non-software queries)
 * O. Google/open-web discovery (Intent -> Formulations -> Domains -> Classifications)
 * P. Login classification (PUBLIC, OPTIONAL_LOGIN, REQUIRED_LOGIN)
 * Q. Sandbox plan approval -> ALLOW_EXECUTION
 * R. Sandbox plan correction -> REQUIRES_CORRECTION with structured feedback
 * S. Hard constraint preservation (Count, role, location, freshness, workMode)
 * T. Tenant isolation (Zero cross-tenant leakage, hashed identifiers)
 * Section 35 Acceptance Test: "Find 10 relevant jobs for freshers in healthcare in Hyderabad posted in the last 15 days"
 */

import http from "http";
import {
  globalVerificationSandbox,
  urlLivelinessVerifier,
  type VerificationRequest,
} from "@/lib/ai/verification";
import {
  openWebDiscoveryEngine,
} from "@/lib/ai/discovery";
import { classifyJobUrl } from "@/lib/scraper/normalizer";
import { evaluateCandidateQualityGate } from "@/lib/scraper/searchQualityGate";
import { parseSearchIntent } from "@/lib/scraper/intentParser";
import { searchPlanner } from "@/lib/ai/searchPlanner";
import { intelligenceBrain } from "@/lib/ai/brain";

interface ScenarioResult {
  code: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

const results: ScenarioResult[] = [];

function recordResult(res: ScenarioResult) {
  results.push(res);
  const mark = res.passed ? "✓ [PASS]" : "✗ [FAIL]";
  console.log(`${mark} [Scenario ${res.code}] ${res.name}`);
  if (!res.passed) {
    console.error(`       Expected: ${res.expected}`);
    console.error(`       Actual:   ${res.actual}`);
    if (res.details) console.error(`       Details:  ${res.details}`);
  }
}

async function runValidation() {
  console.log("\n" + "=".repeat(80));
  console.log("  TASK-063 PHYSICAL VERIFICATION SANDBOX & TRUTH GATE VALIDATION");
  console.log("=".repeat(80) + "\n");

  // ---------------------------------------------------------------------------
  // 1. SETUP CONTROLLED LOCAL HTTP TEST FIXTURES
  // ---------------------------------------------------------------------------
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (url.pathname === "/jobs/valid-101") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Staff Nurse - Apollo Hospitals</title></head>
          <body>
            <h1>Staff Nurse</h1>
            <p>Apollo Hospitals Hyderabad is hiring freshers for inpatient care.</p>
            <a href="/apply/nurse-101">Apply Now</a>
          </body>
        </html>
      `);
      return;
    }

    if (url.pathname === "/jobs/dead-404") {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<html><body><h1>404 Not Found</h1><p>The job has been removed.</p></body></html>");
      return;
    }

    if (url.pathname === "/jobs/closed-410") {
      res.writeHead(410, { "Content-Type": "text/html" });
      res.end("<html><body><h1>410 Gone</h1><p>Position closed permanently.</p></body></html>");
      return;
    }

    if (url.pathname === "/jobs/closed-in-page") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Job Details</title></head>
          <body>
            <div class="banner">The job you are looking for is no longer open</div>
            <p>Thank you for your interest. Please check our other openings.</p>
          </body>
        </html>
      `);
      return;
    }

    if (url.pathname === "/careers") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Careers at Apollo</title></head><body><h1>Join Our Team</h1></body></html>");
      return;
    }

    if (url.pathname === "/jobs/search") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><head><title>Search Results</title></head><body><h1>Current Openings (12)</h1></body></html>");
      return;
    }

    if (url.pathname === "/jobs/redirect-to-careers") {
      res.writeHead(302, { Location: "/careers" });
      res.end();
      return;
    }

    if (url.pathname === "/blocked-403") {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end("<html><body><h1>403 Forbidden</h1></body></html>");
      return;
    }

    if (url.pathname === "/rate-limited-429") {
      res.writeHead(429, { "Content-Type": "text/html" });
      res.end("<html><body><h1>429 Too Many Requests</h1></body></html>");
      return;
    }

    if (url.pathname === "/captcha-challenge") {
      res.writeHead(403, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Attention Required! | Cloudflare</title></head>
          <body>
            <div id="cf-chl-bypass">Please complete the security check to access this page.</div>
          </body>
        </html>
      `);
      return;
    }

    if (url.pathname === "/slow-timeout") {
      setTimeout(() => {
        if (!res.writableEnded) {
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Delayed response");
        }
      }, 2000);
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    // -------------------------------------------------------------------------
    // SCENARIO A: Valid Public Job -> LIVE_OPEN_JOB & Eligible
    // -------------------------------------------------------------------------
    const resA = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/jobs/valid-101`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "A",
      name: "Valid Public Job Liveliness & Detail Verification",
      passed: resA.classification === "LIVE_OPEN_JOB" && resA.isVerified === true,
      expected: "LIVE_OPEN_JOB & isVerified=true",
      actual: `${resA.classification} & isVerified=${resA.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO B: Dead Valid-Looking ATS URL -> DEAD_NOT_FOUND (NOT VERIFIED)
    // -------------------------------------------------------------------------
    const resB = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/jobs/dead-404`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "B",
      name: "Dead Valid-Looking URL Classified as DEAD_NOT_FOUND",
      passed: resB.classification === "DEAD_NOT_FOUND" && resB.isVerified === false,
      expected: "DEAD_NOT_FOUND & isVerified=false",
      actual: `${resB.classification} & isVerified=${resB.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO C: Closed Job (200 with Closure Text) -> LIVE_CLOSED_JOB
    // -------------------------------------------------------------------------
    const resC = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/jobs/closed-in-page`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "C",
      name: "Closed Job Content Signature Detected as LIVE_CLOSED_JOB",
      passed: resC.classification === "LIVE_CLOSED_JOB" && resC.isVerified === false && resC.closureSignalDetected === true,
      expected: "LIVE_CLOSED_JOB & isVerified=false & closureSignalDetected=true",
      actual: `${resC.classification} & isVerified=${resC.isVerified} & closureSignalDetected=${resC.closureSignalDetected}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO D: Generic Career Page -> GENERIC_PORTAL
    // -------------------------------------------------------------------------
    const resD = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/careers`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "D",
      name: "Generic Career Root Classified as GENERIC_PORTAL",
      passed: resD.classification === "GENERIC_PORTAL" && resD.isVerified === false,
      expected: "GENERIC_PORTAL & isVerified=false",
      actual: `${resD.classification} & isVerified=${resD.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO E: Search Results Page -> SEARCH_RESULTS_PAGE
    // -------------------------------------------------------------------------
    const resE = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/jobs/search`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "E",
      name: "Search Results Page Classified as SEARCH_RESULTS_PAGE",
      passed: resE.classification === "SEARCH_RESULTS_PAGE" && resE.isVerified === false,
      expected: "SEARCH_RESULTS_PAGE & isVerified=false",
      actual: `${resE.classification} & isVerified=${resE.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO F: Redirect to Career Root -> GENERIC_PORTAL & Rejected
    // -------------------------------------------------------------------------
    const resF = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/jobs/redirect-to-careers`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "F",
      name: "Redirect to Career Root Post-Redirect Reclassified as GENERIC_PORTAL",
      passed: resF.classification === "GENERIC_PORTAL" && resF.isVerified === false && resF.redirectCount > 0,
      expected: "GENERIC_PORTAL & isVerified=false & redirectCount>0",
      actual: `${resF.classification} & isVerified=${resF.isVerified} & redirectCount=${resF.redirectCount}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO G: Ashby Application URL -> APPLICATION_PORTAL
    // -------------------------------------------------------------------------
    const ashbyAppType = classifyJobUrl("https://jobs.ashbyhq.com/resend/application");
    const ashbyJobType = classifyJobUrl("https://jobs.ashbyhq.com/resend/c8976b05-950c-43fe-a9bb-d20f66e06225");
    recordResult({
      code: "G",
      name: "Ashby URL Classifier Fix (BUG-002 Resolution)",
      passed: ashbyAppType === "APPLICATION_PORTAL" && ashbyJobType === "JOB_DETAIL",
      expected: "APPLICATION_PORTAL for /application and JOB_DETAIL for /jobId",
      actual: `appType=${ashbyAppType}, jobType=${ashbyJobType}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO H: 403 Response -> BLOCKED
    // -------------------------------------------------------------------------
    const resH = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/blocked-403`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "H",
      name: "HTTP 403 Response Classified as BLOCKED",
      passed: resH.classification === "BLOCKED" && resH.isVerified === false,
      expected: "BLOCKED & isVerified=false",
      actual: `${resH.classification} & isVerified=${resH.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO I: 429 Response -> RATE_LIMITED
    // -------------------------------------------------------------------------
    const resI = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/rate-limited-429`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "I",
      name: "HTTP 429 Response Classified as RATE_LIMITED",
      passed: resI.classification === "RATE_LIMITED" && resI.isVerified === false,
      expected: "RATE_LIMITED & isVerified=false",
      actual: `${resI.classification} & isVerified=${resI.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO J: CAPTCHA Response -> CAPTCHA_DETECTED (No bypass)
    // -------------------------------------------------------------------------
    const resJ = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/captcha-challenge`, {
      allowTestLocalhost: true,
    });
    recordResult({
      code: "J",
      name: "Anti-Bot/CAPTCHA Signature Detected Without Bypass",
      passed: resJ.classification === "CAPTCHA_DETECTED" && resJ.captchaDetected === true,
      expected: "CAPTCHA_DETECTED & captchaDetected=true",
      actual: `${resJ.classification} & captchaDetected=${resJ.captchaDetected}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO K: Request Timeout -> TIMEOUT
    // -------------------------------------------------------------------------
    const resK = await urlLivelinessVerifier.verifyUrlLiveness(`${baseUrl}/slow-timeout`, {
      timeoutMs: 300,
      allowTestLocalhost: true,
    });
    recordResult({
      code: "K",
      name: "Bounded Network Timeout Triggered",
      passed: resK.classification === "TIMEOUT" && resK.isVerified === false,
      expected: "TIMEOUT & isVerified=false",
      actual: `${resK.classification} & isVerified=${resK.isVerified}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO L: SSRF / Private IP / Metadata Protection
    // -------------------------------------------------------------------------
    const ssrfMetadata = urlLivelinessVerifier.isSafePublicUrl("http://169.254.169.254/latest/meta-data/");
    const ssrfLocal = urlLivelinessVerifier.isSafePublicUrl("http://127.0.0.1:8080/admin");
    const ssrfPrivate = urlLivelinessVerifier.isSafePublicUrl("http://10.0.1.50/jobs");
    const ssrfFile = urlLivelinessVerifier.isSafePublicUrl("file:///etc/passwd");
    const ssrfCredentials = urlLivelinessVerifier.isSafePublicUrl("http://admin:password@example.com/job");
    const isSsrfSafe = !ssrfMetadata.safe && !ssrfLocal.safe && !ssrfPrivate.safe && !ssrfFile.safe && !ssrfCredentials.safe;

    recordResult({
      code: "L",
      name: "SSRF & Cloud Metadata Protection",
      passed: isSsrfSafe,
      expected: "All 5 unsafe vectors strictly rejected (safe=false)",
      actual: `ssrfSafe=${isSsrfSafe}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO M: Synthetic Candidate Firewall
    // -------------------------------------------------------------------------
    const fakeCand1 = {
      title: "Senior Engineer",
      companyName: "Leading Organization",
      sourceUrl: "https://linkedin.com/jobs/view/123",
    };
    const fakeCand2 = {
      title: "Mechanical Engineer",
      companyName: "Leading Employer",
      sourceUrl: "https://indeed.com/viewjob?jk=abc",
    };
    const fakeCand3 = {
      title: "Software Engineer (job_5001)",
      companyName: "Stripe",
      sourceUrl: "https://boards.ashby.io/stripe/5001",
    };
    const check1 = globalVerificationSandbox.evaluateSyntheticCandidateFirewall(fakeCand1 as any);
    const check2 = globalVerificationSandbox.evaluateSyntheticCandidateFirewall(fakeCand2 as any);
    const check3 = globalVerificationSandbox.evaluateSyntheticCandidateFirewall(fakeCand3 as any);

    const gateEval1 = evaluateCandidateQualityGate(fakeCand1 as any, { freshnessWindowHours: 720 } as any);
    const gateEval3 = evaluateCandidateQualityGate(fakeCand3 as any, { freshnessWindowHours: 720 } as any);

    const syntheticBlocked = check1.isSynthetic && check2.isSynthetic && check3.isSynthetic && !gateEval1.isEligible && !gateEval3.isEligible;
    recordResult({
      code: "M",
      name: "Synthetic Candidate Firewall Rejects Mock Patterns",
      passed: syntheticBlocked,
      expected: "isSynthetic=true for all mock candidates & QualityGate isEligible=false",
      actual: `syntheticBlocked=${syntheticBlocked}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO N: Dynamic Source Discovery for Non-Software Roles
    // -------------------------------------------------------------------------
    const healthcareIntent = parseSearchIntent("Find 10 nursing jobs in Hyderabad for freshers posted in the last 10 days");
    const discoveredHealthcare = openWebDiscoveryEngine.classifyDiscoveredDomain("apollohospitals.com/careers", healthcareIntent);
    const discoveredGovt = openWebDiscoveryEngine.classifyDiscoveredDomain("upsc.gov.in", healthcareIntent);

    recordResult({
      code: "N",
      name: "Dynamic Source Discovery for Non-Software Query",
      passed: discoveredHealthcare.sourceType === "HOSPITAL_PORTAL" && discoveredGovt.sourceType === "GOVERNMENT_PORTAL" && discoveredHealthcare.relevance > 0.8,
      expected: "HOSPITAL_PORTAL & GOVERNMENT_PORTAL with high relevance",
      actual: `sourceType=${discoveredHealthcare.sourceType}, govtType=${discoveredGovt.sourceType}, relevance=${discoveredHealthcare.relevance}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO O: Open-Web Query Generation & Role Expansion Barriers
    // -------------------------------------------------------------------------
    const queries = openWebDiscoveryEngine.generateDiscoveryQueries(healthcareIntent);
    const hasNurseRole = queries.some((q) => q.query.toLowerCase().includes("nurse"));
    const hasFresher = queries.some((q) => q.query.toLowerCase().includes("fresher"));
    const hasHyderabad = queries.some((q) => q.query.toLowerCase().includes("hyderabad"));
    // Prohibited confusion check: ensure 'nursing assistant' or 'medical representative' was NOT introduced
    const hasFalseExpansion = queries.some((q) => /nursing assistant|medical representative/i.test(q.query));

    recordResult({
      code: "O",
      name: "Open-Web Search Query Generation with Role Barrier Enforcement",
      passed: queries.length >= 3 && hasNurseRole && hasFresher && hasHyderabad && !hasFalseExpansion,
      expected: ">=3 query formulations, preserving nurse/fresher/Hyderabad, without false synonyms",
      actual: `queries=${queries.length}, nurse=${hasNurseRole}, fresher=${hasFresher}, hyd=${hasHyderabad}, falseExpansion=${hasFalseExpansion}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO P: Login / Access Classification
    // -------------------------------------------------------------------------
    const googleCareers = openWebDiscoveryEngine.classifyDiscoveredDomain("careers.google.com", healthcareIntent);
    const linkedIn = openWebDiscoveryEngine.classifyDiscoveredDomain("linkedin.com", healthcareIntent);
    const internalSso = openWebDiscoveryEngine.classifyDiscoveredDomain("intranet.hospital.org", healthcareIntent);

    recordResult({
      code: "P",
      name: "Login & Public Access Classification Model",
      passed: googleCareers.loginRequired === "PUBLIC" && linkedIn.loginRequired === "OPTIONAL_LOGIN" && internalSso.loginRequired === "REQUIRED_LOGIN",
      expected: "Google=PUBLIC, LinkedIn=OPTIONAL_LOGIN, Intranet=REQUIRED_LOGIN",
      actual: `Google=${googleCareers.loginRequired}, LinkedIn=${linkedIn.loginRequired}, Intranet=${internalSso.loginRequired}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO Q: Sandbox Plan Approval (ALLOW_EXECUTION)
    // -------------------------------------------------------------------------
    const validPlan = {
      planId: "plan_valid_1",
      query: "Nursing jobs in Hyderabad",
      actions: [
        {
          actionId: "act_1",
          capabilityId: "discovery.search_pipeline",
          priority: 1,
          input: { query: "Nursing jobs Hyderabad", requestedCount: 10 },
          purpose: "Harvest healthcare jobs",
          expectedEvidence: "Job detail URLs",
          maxResults: 10,
          timeoutMs: 10000,
          dependencyIds: [],
        },
      ],
      constraints: {
        roles: ["Nurse"],
        locations: ["Hyderabad"],
        requestedCount: 10,
        postedWithinDays: 10,
      },
      stoppingCriteria: { maxResults: 10, stopOnTargetCount: true, maxPlanningRounds: 2 },
      confidence: 0.9,
      reasoningSummary: "Valid healthcare search plan",
      createdAt: new Date(),
    };

    const reqQ: VerificationRequest = {
      requestId: "req_q_1",
      userIdHash: globalVerificationSandbox.hashUserId("user_alice"),
      correlationId: "corr_q_1",
      originalQuery: "Nursing jobs in Hyderabad",
      canonicalIntent: healthcareIntent,
      proposedPlan: validPlan as any,
      requestedCapabilities: ["discovery.search_pipeline"],
      requestedSources: ["Web"],
      constraints: validPlan.constraints,
      expectedEvidence: ["Job detail URLs"],
      securityChecks: ["ssrf_check", "hard_constraints"],
      createdAt: new Date(),
    };

    const decQ = globalVerificationSandbox.verifyExecutionPlan(reqQ);
    recordResult({
      code: "Q",
      name: "Sandbox Pre-Execution Approval (ALLOW_EXECUTION)",
      passed: decQ.decision === "ALLOW_EXECUTION" && decQ.failures.length === 0,
      expected: "ALLOW_EXECUTION & 0 failures",
      actual: `${decQ.decision} & ${decQ.failures.length} failures`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO R: Sandbox Plan Correction (REQUIRES_CORRECTION)
    // -------------------------------------------------------------------------
    // Plan attempts unsolicited tech ATS platforms for non-tech nursing query
    const invalidNonTechPlan = {
      ...validPlan,
      planId: "plan_invalid_ats",
      actions: [
        {
          actionId: "act_invalid_ats",
          capabilityId: "company.ats",
          priority: 1,
          input: { companyName: "Unknown", atsProvider: "GREENHOUSE" },
          purpose: "Unsolicited ATS crawl for nurse",
          expectedEvidence: "ATS links",
          maxResults: 10,
          timeoutMs: 10000,
          dependencyIds: [],
        },
      ],
    };

    const reqR: VerificationRequest = {
      ...reqQ,
      requestId: "req_r_1",
      proposedPlan: invalidNonTechPlan as any,
    };

    const decR = globalVerificationSandbox.verifyExecutionPlan(reqR);
    recordResult({
      code: "R",
      name: "Sandbox Correction Feedback (REQUIRES_CORRECTION)",
      passed: decR.decision === "REQUIRES_CORRECTION" && !!decR.structuredCorrection,
      expected: "REQUIRES_CORRECTION with structuredCorrection",
      actual: `${decR.decision} & correction=${!!decR.structuredCorrection}`,
      details: decR.structuredCorrection?.reason,
    });

    // -------------------------------------------------------------------------
    // SCENARIO S: Hard Constraint Preservation During Correction
    // -------------------------------------------------------------------------
    const preserved = decR.structuredCorrection?.preservedConstraints;
    const countPreserved = preserved?.requestedCount === 10;
    const rolePreserved = preserved?.roles?.[0] === healthcareIntent.role;
    const locationPreserved = preserved?.locations?.[0] === healthcareIntent.location;
    const daysPreserved = preserved?.postedWithinDays === healthcareIntent.postedWithinDays;
    const allPreserved = countPreserved && rolePreserved && locationPreserved && daysPreserved;

    recordResult({
      code: "S",
      name: "Hard Constraint Anchor Invariance Across Correction",
      passed: allPreserved,
      expected: "requestedCount=10, role=Nurse, location=Hyderabad, days=10 strictly preserved",
      actual: `allPreserved=${allPreserved}`,
    });

    // -------------------------------------------------------------------------
    // SCENARIO T: Multi-Tenant Isolation in Global Sandbox
    // -------------------------------------------------------------------------
    const hashA = globalVerificationSandbox.hashUserId("user_alpha_123");
    const hashB = globalVerificationSandbox.hashUserId("user_beta_456");
    const telemetry = globalVerificationSandbox.getAggregateTelemetry();

    // Verify:
    // 1. Hashes are distinct and do NOT equal raw user IDs
    // 2. Telemetry does NOT contain user IDs, raw queries, or PII
    const hashesIsolated = hashA !== hashB && !hashA.includes("alpha") && !hashB.includes("beta");
    const telemetryClean = !JSON.stringify(telemetry).includes("user_alpha") && !JSON.stringify(telemetry).includes("Nursing jobs");

    recordResult({
      code: "T",
      name: "Multi-Tenant Isolation & Aggregate Telemetry Privacy",
      passed: hashesIsolated && telemetryClean && telemetry.totalRequests > 0,
      expected: "Hashes anonymized, 0 raw PII/queries in telemetry, totalRequests tracked",
      actual: `hashesIsolated=${hashesIsolated}, telemetryClean=${telemetryClean}, totalRequests=${telemetry.totalRequests}`,
    });

    // -------------------------------------------------------------------------
    // SECTION 35 ACCEPTANCE TEST: Healthcare Hyderabad Fresher Search
    // -------------------------------------------------------------------------
    console.log("\n--- Section 35 Acceptance Flow: Healthcare Hyderabad Fresher Search ---");
    const sec35Query = "Find 10 relevant jobs for freshers in healthcare in Hyderabad posted in the last 15 days";
    const sec35Intent = parseSearchIntent(sec35Query);
    
    // 1. Intent Validation
    const sec35Domain = openWebDiscoveryEngine.detectDomainCategory(sec35Intent.role || "");
    const sec35Formulations = openWebDiscoveryEngine.generateDiscoveryQueries(sec35Intent);
    
    // 2. Planning
    const sec35BrainContext = await intelligenceBrain.synthesizeBrainContext(sec35Query, null);
    const sec35PlannerResult = await searchPlanner.planSearch(sec35Query, sec35Intent, sec35BrainContext);

    // 3. Sandbox Pre-Execution Verification
    const sec35SandboxReq: VerificationRequest = {
      requestId: "sec35_req",
      userIdHash: globalVerificationSandbox.hashUserId("test_user_healthcare"),
      correlationId: "sec35_corr",
      originalQuery: sec35Query,
      canonicalIntent: sec35Intent,
      proposedPlan: sec35PlannerResult.plan,
      requestedCapabilities: sec35PlannerResult.plan.actions.map((a) => a.capabilityId),
      requestedSources: sec35Intent.sources || [],
      constraints: sec35PlannerResult.plan.constraints,
      expectedEvidence: sec35PlannerResult.plan.actions.map((a) => a.expectedEvidence).filter(Boolean),
      securityChecks: ["ssrf_check", "hard_constraints"],
      createdAt: new Date(),
    };
    const sec35SandboxDec = globalVerificationSandbox.verifyExecutionPlan(sec35SandboxReq);

    // 4. Source Status Truthfulness Evaluation
    const truthfulStatus = openWebDiscoveryEngine.evaluateSourceExecutionStatus("Public Healthcare Board", {
      candidatesFound: 0,
      httpStatus: 200,
    });

    const sec35Passed =
      sec35Domain === "healthcare" &&
      sec35Formulations.length >= 2 &&
      sec35SandboxDec.decision === "ALLOW_EXECUTION" &&
      truthfulStatus.outcome === "SOURCE_SUCCESS_NO_MATCH" &&
      truthfulStatus.isFatal === false;

    recordResult({
      code: "SEC-35",
      name: "Domain-Neutral Healthcare Hyderabad End-to-End Truth Gate Acceptance",
      passed: sec35Passed,
      expected: "Domain=healthcare, Formulations>=2, Sandbox=ALLOW_EXECUTION, Status=SOURCE_SUCCESS_NO_MATCH",
      actual: `domain=${sec35Domain}, formulations=${sec35Formulations.length}, decision=${sec35SandboxDec.decision}, status=${truthfulStatus.outcome}`,
    });

  } finally {
    server.close();
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = total - passed;

  console.log("\n" + "=".repeat(80));
  console.log(`  TASK-063 PHYSICAL VALIDATION COMPLETE: ${passed}/${total} PASSED (${failed} FAILED)`);
  console.log("=".repeat(80) + "\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runValidation().catch((err) => {
  console.error("Fatal validation error:", err);
  process.exit(1);
});
