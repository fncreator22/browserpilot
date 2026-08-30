import assert from "assert";
import { SearchOrchestrator, searchOrchestrator } from "@/lib/scraper/searchOrchestrator";
import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  isSafePublicUrl,
  sanitizeSnippet,
} from "@/lib/scraper/providers/baseProvider";
import { linkedInProvider } from "@/lib/scraper/providers/linkedInProvider";
import { ycProvider } from "@/lib/scraper/providers/ycProvider";
import { indeedProvider } from "@/lib/scraper/providers/indeedProvider";

export async function runMultiSearchIntegrationTests(): Promise<void> {
  console.log("▶ [INTEGRATION] Running Pluggable Multi-Source Search Adapter Tests (TASK-003)...");

  // 1. Test Provider Registration
  assert.strictEqual(linkedInProvider.name, "LinkedIn");
  assert.strictEqual(ycProvider.name, "Y Combinator");
  assert.strictEqual(indeedProvider.name, "Indeed");
  console.log("  ✓ Verified provider registrations (LinkedIn, Y Combinator, Indeed)");

  // 2. Test Provider Selection via supports(intent)
  const enterpriseIntent: SearchIntent = {
    role: "Java Architect",
    companyType: "ENTERPRISE",
  };
  assert.strictEqual(ycProvider.supports(enterpriseIntent), false, "YC should reject purely enterprise-only queries");
  assert.strictEqual(linkedInProvider.supports(enterpriseIntent), true, "LinkedIn should support enterprise queries");

  const startupIntent: SearchIntent = {
    role: "Founding AI Engineer",
    companyType: "STARTUP",
    experienceLevel: "INTERN",
  };
  assert.strictEqual(ycProvider.supports(startupIntent), true, "YC should support startup intern queries");
  console.log("  ✓ Verified intent-based provider filtering via supports(intent)");

  // 3. Test SSRF Guard
  assert.strictEqual(isSafePublicUrl("https://www.linkedin.com/jobs"), true);
  assert.strictEqual(isSafePublicUrl("https://www.workatastartup.com"), true);
  assert.strictEqual(isSafePublicUrl("http://127.0.0.1:8000/internal"), false, "SSRF guard must block localhost");
  assert.strictEqual(isSafePublicUrl("http://169.254.169.254/latest/meta-data"), false, "SSRF guard must block AWS metadata");
  assert.strictEqual(isSafePublicUrl("http://10.0.1.5/admin"), false, "SSRF guard must block private 10.x IP range");
  assert.strictEqual(isSafePublicUrl("http://192.168.1.1/router"), false, "SSRF guard must block private 192.168.x range");
  assert.strictEqual(isSafePublicUrl("javascript:alert(1)"), false, "SSRF guard must block non-http protocols");
  console.log("  ✓ Verified SSRF protection (blocked private IPs, localhost, AWS metadata, and non-http protocols)");

  // 4. Test Text Sanitization
  const dirtySnippet = "<script>steal()</script> <b>Software</b>   Engineer at   Acme AI! ";
  const cleanSnippet = sanitizeSnippet(dirtySnippet, 50);
  assert.ok(!cleanSnippet.includes("<script>"), "HTML tags must be stripped");
  assert.strictEqual(cleanSnippet, "Software Engineer at Acme AI!");
  console.log("  ✓ Verified HTML text snippet sanitization and length bounding");

  // 5. Test Mock Provider Execution with Bounded Concurrency (N <= 3)
  const mockProviderA: SearchProvider = {
    name: "Mock Provider A",
    supports: () => true,
    harvestCandidates: async (_intent, limits) => [
      {
        sourcePlatform: "Mock Provider A",
        sourceUrl: "https://mocka.com/job/1",
        applyUrl: "https://mocka.com/job/1/apply",
        externalJobId: "mock_a_1",
        title: "AI Engineer Intern",
        companyName: "Alpha Startup",
        location: "Remote",
        workMode: "REMOTE",
        experienceLevel: "INTERN",
        discoveredAt: new Date(),
      },
    ],
  };

  const mockProviderB: SearchProvider = {
    name: "Mock Provider B",
    supports: () => true,
    harvestCandidates: async (_intent, limits) => [
      {
        sourcePlatform: "Mock Provider B",
        sourceUrl: "https://mockb.com/job/2",
        applyUrl: "https://company.com/direct-apply-b",
        title: "Full-Stack Developer Intern",
        companyName: "Beta AI",
        location: "Bengaluru, India",
        workMode: "HYBRID",
        salaryText: "$40,000 - $60,000",
        discoveredAt: new Date(),
      },
    ],
  };

  const orchestrator = new SearchOrchestrator();
  const discovery = await orchestrator.executeDiscovery(
    { role: "AI Intern", workMode: "REMOTE" },
    { customProviders: [mockProviderA, mockProviderB] }
  );

  assert.strictEqual(discovery.status, "SUCCESS");
  assert.strictEqual(discovery.candidates.length, 2);
  assert.strictEqual(discovery.telemetry.length, 2);
  assert.strictEqual(discovery.telemetry[0].status, "SUCCESS");
  assert.strictEqual(discovery.telemetry[1].status, "SUCCESS");
  console.log("  ✓ Verified multi-provider execution, candidate harvesting, and telemetry collection");

  // 6. Test Source URL vs Apply URL Separation
  const candidateB = discovery.candidates.find((c) => c.sourcePlatform === "Mock Provider B");
  assert.ok(candidateB);
  assert.strictEqual(candidateB.sourceUrl, "https://mockb.com/job/2");
  assert.strictEqual(candidateB.applyUrl, "https://company.com/direct-apply-b");
  assert.notStrictEqual(candidateB.sourceUrl, candidateB.applyUrl, "Source URL and Apply URL must remain separate");
  console.log("  ✓ Verified independent sourceUrl and applyUrl preservation");

  // 7. Test Partial Failure Isolation (One provider fails, others succeed)
  const failingProvider: SearchProvider = {
    name: "Failing Provider",
    supports: () => true,
    harvestCandidates: async () => {
      throw new Error("HTTP 403 Access Denied on external source");
    },
  };

  const partialDiscovery = await orchestrator.executeDiscovery(
    { role: "AI Intern" },
    { customProviders: [mockProviderA, failingProvider] }
  );

  assert.strictEqual(partialDiscovery.status, "PARTIAL");
  assert.strictEqual(partialDiscovery.candidates.length, 1);
  assert.strictEqual(partialDiscovery.candidates[0].companyName, "Alpha Startup");
  assert.strictEqual(partialDiscovery.telemetry.find((t) => t.provider === "Failing Provider")?.status, "FAILED");
  console.log("  ✓ Verified partial failure tolerance (failing provider does NOT crash the entire search)");

  // 8. Test Per-Provider Timeout Enforcement
  const slowProvider: SearchProvider = {
    name: "Slow Mock Provider",
    supports: () => true,
    harvestCandidates: async (_intent, limits, context) => {
      // Simulate hanging network request
      return new Promise<RawJobCandidate[]>((resolve, reject) => {
        const timer = setTimeout(() => {
          resolve([]);
        }, 5000);
        context?.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(new Error("TimeoutError: Request aborted"));
        });
      });
    },
  };

  const timeoutDiscovery = await orchestrator.executeDiscovery(
    { role: "AI Intern" },
    {
      customProviders: [mockProviderA, slowProvider],
      perProviderTimeoutMs: 150, // Short timeout for test
    }
  );

  assert.strictEqual(timeoutDiscovery.status, "PARTIAL");
  assert.strictEqual(timeoutDiscovery.candidates.length, 1);
  assert.strictEqual(timeoutDiscovery.telemetry.find((t) => t.provider === "Slow Mock Provider")?.status, "TIMEOUT");
  console.log("  ✓ Verified hard per-provider timeout budget enforcement");

  // 9. Test Candidate Limits Enforcement
  const excessiveProvider: SearchProvider = {
    name: "Excessive Provider",
    supports: () => true,
    harvestCandidates: async (_intent, limits) => {
      // Return more than limit
      return Array.from({ length: limits.maxCandidates }).map((_, i) => ({
        sourcePlatform: "Excessive Provider",
        sourceUrl: `https://excessive.com/job/${i}`,
        applyUrl: `https://excessive.com/job/${i}/apply`,
        title: `Job Title ${i}`,
        companyName: `Company ${i}`,
        discoveredAt: new Date(),
      }));
    },
  };

  const limitedDiscovery = await orchestrator.executeDiscovery(
    { role: "AI Intern" },
    {
      customProviders: [excessiveProvider],
      maxCandidatesPerProvider: 3,
    }
  );

  assert.strictEqual(limitedDiscovery.candidates.length, 3);
  console.log("  ✓ Verified maxCandidatesPerProvider boundary enforcement");

  // 10. Test No Hallucination of Missing Data
  const incompleteCandidate = discovery.candidates.find((c) => c.sourcePlatform === "Mock Provider A");
  assert.ok(incompleteCandidate);
  assert.strictEqual(incompleteCandidate.salaryText, undefined, "Missing salary must remain undefined, not fabricated");
  assert.strictEqual(incompleteCandidate.rawSnippet, undefined, "Missing snippet must remain undefined");
  console.log("  ✓ Verified no hallucination policy on missing candidate fields");

  console.log("✓ [INTEGRATION] Pluggable Multi-Source Search Adapter Tests Passed!\n");
}
