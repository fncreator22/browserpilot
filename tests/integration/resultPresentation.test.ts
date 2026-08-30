import assert from "assert";
import { 
  parseTextToDossierItems, 
  cleanCitationMarkers 
} from "@/lib/scraper/textDossierParser";
import { 
  normalizeCompany, 
  normalizeJobTitle, 
  normalizeLocation, 
  canonicalizeUrl,
  generateCanonicalHash 
} from "@/lib/scraper/normalizer";

export async function runResultPresentationIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Result Presentation & Structured Opportunity Rendering Tests (TASK-011)...");

  // 1. Test Direct Structured Array Normalization
  const rawStructuredArray = [
    {
      title: "Senior Product Manager - AWS Cloud",
      company: "Amazon Web Services",
      location: "Seattle, WA",
      salaryMin: 160000,
      salaryMax: 220000,
      workMode: "HYBRID",
      applyUrl: "https://amazon.jobs/en/jobs/1001?utm_source=linkedin",
      requirements: ["5+ years product management", "Experience with AWS"],
    },
    {
      title: "Customer Support Specialist",
      company: "Acme Corp",
      location: "Remote",
      workMode: "REMOTE",
      applyUrl: "https://acme.example.com/careers/support",
      requirements: ["Excellent communication", "Zendesk experience"],
    }
  ];

  const structuredResult = parseTextToDossierItems(rawStructuredArray);
  assert.strictEqual(structuredResult.items.length, 2, "Must normalize both structured array items");
  assert.strictEqual(structuredResult.items[0].title, "Senior Product Manager - AWS Cloud");
  assert.strictEqual(structuredResult.items[0].company, "Amazon Web Services");
  assert.strictEqual(structuredResult.items[0].location, "Seattle, WA");
  assert.strictEqual(structuredResult.items[0].workMode, "HYBRID");
  assert.strictEqual(structuredResult.items[0].salaryMin, 160000);
  assert.strictEqual(structuredResult.items[0].salaryMax, 220000);
  assert.ok(structuredResult.items[0].canonicalHash, "Must generate canonical hash");
  assert.strictEqual(structuredResult.items[0].applyUrl, "https://amazon.jobs/en/jobs/1001", "Must strip tracking parameters from applyUrl");
  console.log("  ✓ Verified direct structured opportunity array normalization & tracking URL cleanup");

  // 2. Test Deterministic Text-to-Dossier Fallback Parser with Markdown Links
  const markdownTextDump = `
Amazon is currently hiring for several non-technical roles in the United States:

### [Senior Account Executive - AWS Enterprise](https://amazon.jobs/en/jobs/aws-ae-123?utm_campaign=hiring)
Company: Amazon Web Services
Location: New York, NY
Work Mode: Hybrid
Salary: $140,000 - $190,000 / year
- 5+ years of B2B enterprise sales experience
- Proven track record in cloud infrastructure quotas
- Bachelor's degree or equivalent

### [Human Resources Business Partner](https://amazon.jobs/en/jobs/hrbp-456)
Company: Amazon
Location: Seattle, WA
Work Mode: On-site
Salary: $110,000 - $145,000
- 3+ years HR experience in tech operations
- Strong employee relations background

### [Global Communications Manager](https://amazon.jobs/en/jobs/pr-789)
Company: Amazon
Location: Remote
Work Mode: Remote
Salary: $130,000 - $175,000
- 6+ years in public relations or corporate communications

[1] https://amazon.jobs/en/jobs/aws-ae-123
[2] https://amazon.jobs/en/jobs/hrbp-456
[3] https://amazon.jobs/en/jobs/pr-789
  `;

  const parsedFromText = parseTextToDossierItems(markdownTextDump);

  assert.strictEqual(parsedFromText.items.length, 3, "Must extract all 3 job postings from unstructured markdown");
  assert.strictEqual(parsedFromText.items[0].title, "Senior Account Executive - AWS Enterprise");
  assert.strictEqual(parsedFromText.items[0].company, "Amazon Web Services");
  assert.strictEqual(parsedFromText.items[0].location, "New York, NY");
  assert.strictEqual(parsedFromText.items[0].workMode, "HYBRID");
  assert.strictEqual(parsedFromText.items[0].salaryMin, 140000);
  assert.strictEqual(parsedFromText.items[0].salaryMax, 190000);
  assert.strictEqual(parsedFromText.items[0].applyUrl, "https://amazon.jobs/en/jobs/aws-ae-123");
  const reqs0 = parsedFromText.items[0].requirements;
  assert.strictEqual(Array.isArray(reqs0) ? reqs0.length : 0, 3);
  assert.strictEqual(parsedFromText.items[2].workMode, "REMOTE");
  assert.strictEqual(parsedFromText.items[2].location, "Remote");

  // Verify Sources separation
  assert.ok(parsedFromText.sources.length >= 3, "Must extract sources into dedicated list");
  assert.strictEqual(parsedFromText.sources[0].applyUrl, "https://amazon.jobs/en/jobs/aws-ae-123");
  console.log("  ✓ Verified deterministic markdown text-to-dossier parsing with roles, locations, salaries & apply URLs");

  // 3. Test Citation Fragment Stripping and Prose Cleanliness
  const dirtyProse = "Amazon is currently hiring [1] for non-technical roles [2] with competitive packages [3].";
  const cleanedProse = cleanCitationMarkers(dirtyProse);
  assert.strictEqual(cleanedProse, "Amazon is currently hiring for non-technical roles with competitive packages.");
  console.log("  ✓ Verified citation marker [1], [2] stripping from primary text");

  // 4. Test Zero Fabrication on Unrecognized / Generic Text
  const genericNonJobText = "The quick brown fox jumps over the lazy dog. Weather in Seattle is 65 degrees and sunny.";
  const emptyDossier = parseTextToDossierItems(genericNonJobText);
  assert.strictEqual(emptyDossier.items.length, 0, "Must NOT fabricate fake job listings from generic prose");
  console.log("  ✓ Verified zero-hallucination / zero-fabrication on non-job textual payloads");

  // 5. Test JSON String Array Fallback
  const serializedJsonString = JSON.stringify(rawStructuredArray);
  const fromSerialized = parseTextToDossierItems(serializedJsonString);
  assert.strictEqual(fromSerialized.items.length, 2, "Must parse serialized JSON string into dossier deck items");
  console.log("  ✓ Verified serialized JSON string parsing");

  console.log("✓ [INTEGRATION] Result Presentation & Structured Opportunity Rendering Tests Passed!\n");
}
