import assert from "assert";
import { 
  validateOpportunityExtraction, 
  validateAndNormalizeExtractionBatch,
  sanitizeStringArray,
  type OpportunityExtraction 
} from "@/lib/scraper/extractionContract";
import { parseTextToDossierItems } from "@/lib/scraper/textDossierParser";
import { generateCanonicalHash, canonicalizeUrl } from "@/lib/scraper/normalizer";

export async function runStructuredOpportunityExtractionIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Structured Opportunity Extraction & Contract Tests (TASK-012)...");

  // 1. Test Valid Complete Extraction Contract (Status: VALID)
  const validCandidate: OpportunityExtraction = {
    title: "Senior Backend Engineer",
    company: "Apex Systems",
    sourceUrl: "https://apex.example.com/jobs/101?utm_source=feed",
    applyUrl: "https://apex.example.com/apply/101",
    location: "San Francisco, CA",
    workMode: "HYBRID",
    salaryMin: 150000,
    salaryMax: 195000,
    salaryCurrency: "USD",
    description: "Lead distributed systems development",
    requirements: ["5+ years TypeScript", "Experience with Redis & SQL"],
    skills: ["Node.js", "TypeScript", "PostgreSQL"],
    sourcePlatform: "LinkedIn",
  };

  const validResult = validateOpportunityExtraction(validCandidate, { allowLocalForTests: true });
  assert.strictEqual(validResult.status, "VALID", "Complete extraction must have VALID status");
  assert.ok(validResult.cleaned, "Must return cleaned extraction object");
  assert.strictEqual(validResult.cleaned?.title, "Senior Backend Engineer");
  assert.strictEqual(validResult.cleaned?.company, "Apex Systems");
  assert.strictEqual(validResult.cleaned?.sourceUrl, "https://apex.example.com/jobs/101", "Must strip tracking parameters");
  assert.strictEqual(validResult.cleaned?.applyUrl, "https://apex.example.com/apply/101");
  assert.strictEqual(validResult.cleaned?.salaryMin, 150000);
  assert.strictEqual(validResult.cleaned?.salaryMax, 195000);
  assert.strictEqual(validResult.cleaned?.workMode, "HYBRID");
  console.log("  ✓ Verified valid complete opportunity extraction contract & tracking parameter cleanup");

  // 2. Test Partial Extraction Contract (Status: PARTIAL - e.g. missing salary & location)
  const partialCandidate = {
    title: "Site Reliability Engineer",
    company: "CloudScale Inc",
    sourceUrl: "https://cloudscale.example.com/careers/sre",
    description: "Maintain high-availability infrastructure",
  };

  const partialResult = validateOpportunityExtraction(partialCandidate, { allowLocalForTests: true });
  assert.strictEqual(partialResult.status, "PARTIAL", "Extraction with missing optional fields must have PARTIAL status");
  assert.ok(partialResult.cleaned);
  assert.strictEqual(partialResult.cleaned?.salaryMin, null, "Must NOT fabricate missing salary");
  assert.strictEqual(partialResult.cleaned?.location, undefined, "Must NOT fabricate missing location");
  console.log("  ✓ Verified partial extraction handling with zero field fabrication");

  // 3. Test Identity Rejection: Boilerplate / Navigation Titles (Status: REJECTED)
  const boilerplateTitles = [
    "Click Here",
    "Search Results",
    "Jobs",
    "All Jobs",
    "Careers",
    "Home",
    "Sign In",
    "Loading...",
    "Apply Now",
    "",
  ];

  for (const bpTitle of boilerplateTitles) {
    const res = validateOpportunityExtraction({
      title: bpTitle,
      company: "Real Corp",
      sourceUrl: "https://realcorp.example.com/job/1",
    }, { allowLocalForTests: true });
    assert.strictEqual(res.status, "REJECTED", `Boilerplate title "${bpTitle}" must be rejected`);
  }
  console.log("  ✓ Verified deterministic rejection of navigation boilerplate titles");

  // 4. Test Identity Rejection: Invalid Placeholder Companies (Status: REJECTED)
  const placeholderCompanies = [
    "Unknown Company",
    "Company",
    "Organization",
    "N/A",
    "None",
    "",
  ];

  for (const phComp of placeholderCompanies) {
    const res = validateOpportunityExtraction({
      title: "Real Software Engineer",
      company: phComp,
      sourceUrl: "https://example.com/job/1",
    }, { allowLocalForTests: true });
    assert.strictEqual(res.status, "REJECTED", `Placeholder company "${phComp}" must be rejected`);
  }
  console.log("  ✓ Verified deterministic rejection of placeholder company names");

  // 5. Test URL Safety & SSRF Rejection (Status: REJECTED)
  const unsafeUrls = [
    "http://169.254.169.254/latest/meta-data", // AWS Metadata
    "http://10.0.0.1/admin",                  // Private subnet
    "http://192.168.1.1/secret",              // Private network
    "ftp://ftp.example.com/file",             // Non-HTTP protocol
    "javascript:alert(1)",                    // Script URI
    "",                                       // Missing URL
  ];

  for (const badUrl of unsafeUrls) {
    const res = validateOpportunityExtraction({
      title: "Security Engineer",
      company: "Defend AI",
      sourceUrl: badUrl,
    }, { allowLocalForTests: false });
    assert.strictEqual(res.status, "REJECTED", `Unsafe / SSRF target URL "${badUrl}" must be rejected`);
  }
  console.log("  ✓ Verified deterministic rejection of malformed protocols and SSRF IP targets");

  // 6. Test Array Sanitization (Requirements / Skills)
  const messyArray = [
    "  5+ years Node.js  ",
    "Home",
    "apply now",
    "",
    "Node.js",
    "5+ years Node.js", // Duplicate
    "Share",
    "- Strong SQL optimization",
  ];

  const cleanedArr = sanitizeStringArray(messyArray);
  assert.strictEqual(cleanedArr.length, 3, "Must discard boilerplate, empty strings, and duplicates");
  assert.strictEqual(cleanedArr[0], "5+ years Node.js");
  assert.strictEqual(cleanedArr[1], "Node.js");
  assert.strictEqual(cleanedArr[2], "Strong SQL optimization");
  console.log("  ✓ Verified array sanitization, boilerplate filtering, and deduplication");

  // 7. Test Batch Extraction Validation
  const batchCandidates = [
    validCandidate,
    partialCandidate,
    { title: "Click Here", company: "Fake Corp", sourceUrl: "https://fake.com" }, // REJECTED
    { title: "DevOps Engineer", company: "N/A", sourceUrl: "https://fake.com" },   // REJECTED
  ];

  const batchResult = validateAndNormalizeExtractionBatch(batchCandidates, { allowLocalForTests: true });
  assert.strictEqual(batchResult.valid.length, 1, "Must have 1 VALID item");
  assert.strictEqual(batchResult.partial.length, 1, "Must have 1 PARTIAL item");
  assert.strictEqual(batchResult.rejected.length, 2, "Must have 2 REJECTED items");
  assert.strictEqual(batchResult.telemetry.total, 4);
  assert.strictEqual(batchResult.telemetry.validCount, 1);
  assert.strictEqual(batchResult.telemetry.partialCount, 1);
  assert.strictEqual(batchResult.telemetry.rejectedCount, 2);
  console.log("  ✓ Verified batch validation and telemetry accounting (VALID / PARTIAL / REJECTED)");

  // 8. Test Canonical Hashing Consistency
  const hash1 = generateCanonicalHash("Amazon Web Services, Inc.", "Senior Product Manager - AWS");
  const hash2 = generateCanonicalHash("amazon-web-services", "senior product manager aws");
  assert.strictEqual(hash1, hash2, "Canonical hashes must be consistent across punctuation and corporate suffixes");
  console.log("  ✓ Verified canonical hash consistency and normalization");

  // 9. Test Upstream Integration with Text Dossier Parser Fallback
  const textWithBoilerplate = `
1. [Senior Frontend Engineer](https://acme.example.com/job/101)
Company: Acme Corp
Location: Remote
Salary: $130,000 - $160,000

2. [Click Here to View All Jobs](https://acme.example.com/all-jobs)
Company: Acme Corp

3. [Staff AI Researcher](https://acme.example.com/job/102)
Company: Acme Corp
Location: San Francisco, CA
Salary: $200,000 - $260,000
  `;

  const parsedFromText = parseTextToDossierItems(textWithBoilerplate);
  assert.strictEqual(parsedFromText.items.length, 2, "Must extract 2 real jobs and discard the 'Click Here' boilerplate");
  assert.strictEqual(parsedFromText.items[0].title, "Senior Frontend Engineer");
  assert.strictEqual(parsedFromText.items[1].title, "Staff AI Researcher");
  console.log("  ✓ Verified fallback parser integrates canonical contract and rejects navigation items");

  console.log("✓ [INTEGRATION] Structured Opportunity Extraction Tests Passed!\n");
}
