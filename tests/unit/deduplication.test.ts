import assert from "assert";
import {
  normalizeCompany,
  normalizeJobTitle,
  normalizeLocation,
  canonicalizeUrl,
  generateCanonicalHash,
  calculateStringSimilarity,
} from "@/lib/scraper/normalizer";
import {
  deduplicateCandidates,
  extractSeniority,
  parseSalaryRange,
} from "@/lib/scraper/deduplicator";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

export async function runDeduplicationUnitTests(): Promise<void> {
  console.log("▶ [UNIT] Running Normalization & 3-Tier Deduplication Tests (TASK-004)...");

  // 1. Company Normalization
  assert.strictEqual(normalizeCompany("Acme Inc."), "acme");
  assert.strictEqual(normalizeCompany("ACME INC"), "acme");
  assert.strictEqual(normalizeCompany("Acme, Inc."), "acme");
  assert.strictEqual(normalizeCompany("Acme Technologies LLC"), "acme");
  assert.strictEqual(normalizeCompany("Acme Labs Pvt Ltd"), "acme");
  console.log("  ✓ Verified company normalization (stripped legal suffixes without over-collapsing)");

  // 2. Job Title Normalization
  assert.strictEqual(normalizeJobTitle("Software Engineer Intern"), "software engineer intern");
  assert.strictEqual(normalizeJobTitle("Software Engineer - Intern"), "software engineer intern");
  assert.strictEqual(normalizeJobTitle("SDE Internship"), "software engineer intern");
  assert.strictEqual(normalizeJobTitle("Machine Learning Engineer - Intern"), "ai engineer intern");
  assert.strictEqual(normalizeJobTitle("Full-Stack Developer"), "full stack engineer");
  console.log("  ✓ Verified job title normalization (standardized role terms, preserved seniority)");

  // 3. Location Normalization
  assert.strictEqual(normalizeLocation("Bengaluru, India"), "Bengaluru, India");
  assert.strictEqual(normalizeLocation("Remote - India"), "Remote");
  assert.strictEqual(normalizeLocation("Work from Home"), "Remote");
  console.log("  ✓ Verified location normalization");

  // 4. Safe URL Canonicalization & Tracking Parameter Stripping
  const dirtyUrl1 = "https://example.com/job/123?utm_source=linkedin&utm_medium=cpc&refId=abc";
  const dirtyUrl2 = "https://example.com/job/123/?utm_source=indeed&trk=public_jobs";
  assert.strictEqual(canonicalizeUrl(dirtyUrl1), "https://example.com/job/123");
  assert.strictEqual(canonicalizeUrl(dirtyUrl2), "https://example.com/job/123");

  const essentialParamUrl = "https://www.indeed.com/viewjob?jk=abc12345&utm_source=feed";
  assert.strictEqual(canonicalizeUrl(essentialParamUrl), "https://www.indeed.com/viewjob?jk=abc12345");
  console.log("  ✓ Verified URL canonicalization (stripped tracking query parameters, preserved job keys)");

  // 5. Seniority and Salary Parsing
  assert.strictEqual(extractSeniority("AI Engineer Intern"), "INTERN");
  assert.strictEqual(extractSeniority("Senior Machine Learning Engineer"), "SENIOR");
  assert.strictEqual(extractSeniority("Junior Full Stack Developer"), "ENTRY_LEVEL");

  const salaryRange = parseSalaryRange("$80,000 - $120,000 / yr");
  assert.strictEqual(salaryRange.min, 80000);
  assert.strictEqual(salaryRange.max, 120000);
  assert.strictEqual(salaryRange.currency, "USD");
  console.log("  ✓ Verified seniority extraction and numeric salary range parsing");

  // 6. Tier 1 Deduplication: Exact Canonical URL
  const candidateUrl1: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://example.com/jobs/ai-intern?utm_source=linkedin",
    applyUrl: "https://example.com/jobs/ai-intern/apply",
    title: "AI Intern",
    companyName: "Acme",
    description: "Short description",
    discoveredAt: new Date(),
  };

  const candidateUrl2: RawJobCandidate = {
    sourcePlatform: "Indeed",
    sourceUrl: "https://example.com/jobs/ai-intern?utm_source=indeed",
    applyUrl: "https://example.com/jobs/ai-intern/apply",
    title: "AI Intern",
    companyName: "Acme",
    description: "Detailed description with comprehensive requirements",
    discoveredAt: new Date(),
  };

  const dedupTier1 = deduplicateCandidates([candidateUrl1, candidateUrl2]);
  assert.strictEqual(dedupTier1.length, 1, "Tier 1: Two listings with same canonical URL must merge to 1 opportunity");
  assert.strictEqual(dedupTier1[0].description, "Detailed description with comprehensive requirements", "Must preserve richer description");
  assert.strictEqual(dedupTier1[0].sourceListings.length, 2, "Must preserve both source listings");
  console.log("  ✓ Verified Tier 1 exact canonical URL deduplication and rich description merge");

  // 7. Tier 2 Deduplication: Canonical Opportunity Hash (Cross-Platform)
  const candidateCrossSourceLinkedIn: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/9991",
    applyUrl: "https://acmelabs.ai/apply-li",
    title: "AI Research & Engineering Intern",
    companyName: "Acme Labs, Inc.",
    salaryText: "$50,000 - $65,000",
    discoveredAt: new Date(),
  };

  const candidateCrossSourceYC: RawJobCandidate = {
    sourcePlatform: "Y Combinator",
    sourceUrl: "https://workatastartup.com/jobs/9991",
    applyUrl: "https://acmelabs.ai/apply-yc",
    title: "AI Research and Engineering - Intern",
    companyName: "Acme Labs",
    description: "Build cutting-edge autonomous agents.",
    discoveredAt: new Date(),
  };

  const dedupTier2 = deduplicateCandidates([candidateCrossSourceLinkedIn, candidateCrossSourceYC]);
  assert.strictEqual(dedupTier2.length, 1, "Tier 2: Cross-platform identical company and title must merge to 1 opportunity");
  assert.strictEqual(dedupTier2[0].sourceListings.length, 2, "Both LinkedIn and YC SourceListings must be attached");
  assert.strictEqual(dedupTier2[0].salaryMin, 50000);
  assert.strictEqual(dedupTier2[0].description, "Build cutting-edge autonomous agents.");
  console.log("  ✓ Verified Tier 2 canonical hash cross-source deduplication and attribute consolidation");

  // 8. Tier 3 Deduplication: Fuzzy Similarity with Strict Seniority Guard
  const candidateIntern: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/1001",
    applyUrl: "https://linkedin.com/jobs/view/1001",
    title: "Software Engineer Intern",
    companyName: "Beta Corp",
    discoveredAt: new Date(),
  };

  const candidateSenior: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/1002",
    applyUrl: "https://linkedin.com/jobs/view/1002",
    title: "Senior Software Engineer",
    companyName: "Beta Corp",
    discoveredAt: new Date(),
  };

  const dedupSeniority = deduplicateCandidates([candidateIntern, candidateSenior]);
  assert.strictEqual(dedupSeniority.length, 2, "Tier 3: Intern and Senior roles at the same company must NEVER be merged");
  console.log("  ✓ Verified Tier 3 fuzzy deduplication respects strict seniority boundaries (Intern != Senior)");

  // 9. Different Companies Distinction
  const candidateCo1: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/2001",
    applyUrl: "https://linkedin.com/jobs/view/2001",
    title: "Full Stack Engineer",
    companyName: "Company Alpha",
    discoveredAt: new Date(),
  };

  const candidateCo2: RawJobCandidate = {
    sourcePlatform: "LinkedIn",
    sourceUrl: "https://linkedin.com/jobs/view/2002",
    applyUrl: "https://linkedin.com/jobs/view/2002",
    title: "Full Stack Engineer",
    companyName: "Company Beta",
    discoveredAt: new Date(),
  };

  const dedupCompanies = deduplicateCandidates([candidateCo1, candidateCo2]);
  assert.strictEqual(dedupCompanies.length, 2, "Different companies must remain distinct opportunities");
  console.log("  ✓ Verified different companies remain distinct opportunities");

  console.log("✓ [UNIT] Normalization & 3-Tier Deduplication Tests Passed!\n");
}
