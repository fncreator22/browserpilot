# TASK-064 — Synthetic Data & Mock Connector Purge Architecture Document

## Status

- **Task:** TASK-064
- **Name:** Synthetic Data & Mock Connector Purge
- **Status:** COMPLETED & VERIFIED
- **Depends on:** TASK-063
- **AWS Infrastructure:** STRICTLY LOCKED — Zero AWS provisioning, deployment, mutation, or scaling.
- **Ponytail Optimization:** MANDATORY — Zero new npm dependencies, pure stdlib/TypeScript implementation.

---

## 1. Executive Summary

TASK-062 and TASK-063 revealed that multiple discovery providers and connectors across BrowserPilot contained legacy fallback loops that synthesized mock job openings (such as `"Leading Organization"`, `"Leading Employer"`, `job_5001`, `defaultCompanies = ["Stripe", "Linear", "Vercel"]`, `sampleRepos`, and `sampleStartups`). While TASK-063 erected a verification sandbox and URL liveliness firewall to stop synthetic candidates from achieving `VERIFIED` status, candidate fabrication in the production execution path remained an active architectural hazard.

TASK-064 permanently purges every candidate fabrication path across BrowserPilot. It enforces the fundamental invariant:

> **No candidate may be constructed as a substitute for missing external data. When BrowserPilot cannot find a real opportunity, it must return fewer results—not invented results.**

When any provider, connector, or scraper lacks an active network connection or receives 0 genuine opportunities from its target, it must return `return []`.

---

## 2. Inventory of Purged Locations

Seven production-path locations identified during forensic audit were completely cleansed of mock candidate fabrication loops, plus the core fallback generator in the discovery execution service:

| # | Location | Component | Legacy Fabricated Pattern | Purge Remediation |
|---|---|---|---|---|
| 1 | `lib/scraper/providers/atsProvider.ts:40-78` | Search Provider | `defaultCompanies = ["Stripe", "Linear", "Vercel"]`, synthetic Greenhouse/Ashby/Lever candidate records | Purged loop; returns `[]` when no direct live ATS client is configured |
| 2 | `lib/discovery/browser/connectors/linkedInConnector.ts:59-105` | Browser Connector | `"Leading Organization"` and fake `li_${comp}_${Date.now()}` URLs | Purged loop; returns `[]` without live browser session DOM |
| 3 | `lib/discovery/browser/connectors/indeedConnector.ts:58-105` | Browser Connector | `"Leading Employer"` and fake `ind_${comp}_${Date.now()}` URLs | Purged loop; returns `[]` without live browser session DOM |
| 4 | `lib/discovery/browser/connectors/atsBrowserConnector.ts:47-75` | Browser Connector | `defaultCompanies = ["Stripe", "Linear", "Supabase", "Retool"]`, `job_5001` | Purged loop; returns `[]` without live browser session DOM |
| 5 | `lib/discovery/browser/connectors/careerPortalConnector.ts:41-70` | Browser Connector | `defaultCompanies = ["Vercel", "Resend", "Neon", "Dub.co"]`, `/careers/${jobId}` | Purged loop; returns `[]` without live career portal DOM |
| 6 | `lib/scraper/providers/githubJobsProvider.ts:35-60` | Search Provider | `sampleRepos = [Cloudflare, Datadog, Figma]` | Purged loop; returns `[]` without active repository scraper |
| 7 | `lib/scraper/providers/hackerNewsProvider.ts:32-58` | Search Provider | `sampleStartups = [Resend, Neon, Dub.co]`, mock HN post IDs | Purged loop; returns `[]` without active HN scraper |
| 8 | `lib/discovery/execution/discoveryExecutionService.ts:214-230` | Execution Service | Unsupported connector fallback generating mock `TechCorp` candidate | Purged fallback generator; sets `candidates = []` |

---

## 3. Database Persistence Firewall

To guarantee that synthetic data can never breach persistent storage—even if introduced by unexpected upstream mutations or test harness bleed—a hard persistence firewall was embedded directly inside `lib/db/opportunities.ts` in `upsertOpportunity`:

```typescript
export const SYNTHETIC_OPPORTUNITY_PATTERNS = [
  /leading organization/i,
  /leading employer/i,
  /job_5001/i,
  /boards\.ashby\.io/i,
  /placeholder company/i,
  /mock company/i,
  /example company/i,
  /synthetic candidate/i,
  /test candidate/i,
  /sample employer/i,
  /fake company/i,
];

export function detectSyntheticOpportunity(data: {
  title?: string | null;
  companyName?: string | null;
  primaryApplyUrl?: string | null;
  description?: string | null;
  requirements?: string | string[] | null;
}): { isSynthetic: boolean; reason?: string } {
  const fields = [
    { name: "title", val: data.title },
    { name: "companyName", val: data.companyName },
    { name: "primaryApplyUrl", val: data.primaryApplyUrl },
    { name: "description", val: data.description },
  ];

  for (const { name, val } of fields) {
    if (!val) continue;
    const str = String(val).toLowerCase();
    for (const pattern of SYNTHETIC_OPPORTUNITY_PATTERNS) {
      if (pattern.test(str)) {
        return {
          isSynthetic: true,
          reason: `Opportunity ${name} matched synthetic pattern "${pattern.source}"`,
        };
      }
    }
  }

  return { isSynthetic: false };
}
```

When `upsertOpportunity` receives any record containing synthetic data patterns, it rejects it immediately:
```typescript
const syntheticCheck = detectSyntheticOpportunity(data);
if (syntheticCheck.isSynthetic) {
  throw new Error(`Cannot upsert synthetic opportunity: ${syntheticCheck.reason}`);
}
```

---

## 4. Learning System Safeguards

In `lib/discovery/execution/discoveryExecutionService.ts`, the success learning signal (`DISCOVERY_SUCCESS`) recorded in `discoveryIntelligenceStore` was guarded so that it is only emitted when genuine candidates were harvested:

```typescript
if (candidates.length > 0) {
  await discoveryIntelligenceStore.recordDiscoverySignal({
    sourceName: srcName,
    companyName: targetCompany || null,
    signalType: "DISCOVERY_SUCCESS",
    metadata: { count: candidates.length },
  }).catch(() => {});
}
```

This prevents zero-candidate crawls or missing connectors from inflating the learning profiles or quality scores of sources.

---

## 5. Physical Verification & Test Results

A dedicated physical validation harness was constructed in `scratch/task064SyntheticDataPurgeValidation.ts` covering 10 rigorous test scenarios:

```text
=================================================================
   TASK-064: SYNTHETIC DATA & MOCK CONNECTOR PURGE VALIDATION    
=================================================================

▶ [SCENARIO 1] Verifying AtsProvider does not fabricate mock candidates...
  ✓ AtsProvider returned [] (zero synthetic candidates)
▶ [SCENARIO 2] Verifying AtsProvider with company intent returns []...
  ✓ AtsProvider with company intent returned [] without fabrication
▶ [SCENARIO 3] Verifying LinkedInBrowserConnector returns []...
  ✓ LinkedInBrowserConnector returned [] (no 'Leading Organization' or fake job IDs)
▶ [SCENARIO 4] Verifying IndeedBrowserConnector returns []...
  ✓ IndeedBrowserConnector returned [] (no 'Leading Employer' or fake job IDs)
▶ [SCENARIO 5] Verifying AtsBrowserConnector returns [] across all ATS types...
  ✓ AtsBrowserConnector (Greenhouse, Ashby, Lever) returned [] (no 'job_5001' or fake companies)
▶ [SCENARIO 6] Verifying CareerPortalBrowserConnector returns []...
  ✓ CareerPortalBrowserConnector returned [] (no mock career portal links)
▶ [SCENARIO 7] Verifying GitHubJobsProvider returns []...
  ✓ GitHubJobsProvider returned [] (no mock repo internships)
▶ [SCENARIO 8] Verifying HackerNewsProvider returns []...
  ✓ HackerNewsProvider returned [] (no mock HN hiring thread posts)
▶ [SCENARIO 9] Verifying Database Persistence Firewall rejects synthetic data...
  ✓ Database Persistence Firewall successfully blocked synthetic records and allowed genuine records
▶ [SCENARIO 10] Verifying DiscoveryExecutionService does not synthesize candidates...
  ✓ DiscoveryExecutionService returned clean results without TechCorp mock fallback

=================================================================
  TASK-064 VALIDATION COMPLETE: 10/10 SCENARIOS PASSED! ✅ 
=================================================================
```

### Full Regression Test Suite Results

1. **TASK-062 Forensic Audit Suite (`task062ForensicRuntimeAudit.ts`):**
   - Result: **21/21 PASSED (0 FAILED)**
2. **TASK-063 Verification Sandbox Suite (`task063VerificationSandboxValidation.ts`):**
   - Result: **21/21 PASSED (0 FAILED)**
3. **TASK-038 Multi-Source Discovery Intelligence Suite (`multiSourceDiscoveryIntelligence.test.ts`):**
   - Result: **10/10 SECTIONS PASSED ✅**
4. **TASK-039 Authenticated Browser Discovery Suite (`authenticatedBrowserDiscovery.test.ts`):**
   - Result: **10/10 SECTIONS PASSED ✅**
5. **TypeScript Compilation (`npm run typecheck`):**
   - Result: **0 errors**
6. **Next.js Production Build (`npm run build`):**
   - Result: **Clean build, 32/32 static routes optimized, Turbopack verified**

---

## 6. Architecture Invariants Enforced

1. **Truthful Yields:** When external platforms do not have matching opportunities, BrowserPilot returns 0 results. Zero fillers are ever injected.
2. **No Mock Connectors in Production:** Browser connectors and scraper providers only extract real data from real DOM elements and HTTP responses.
3. **Defense-in-Depth:**
   - Layer 1 (Provider/Connector): Pure `[]` on missing external data.
   - Layer 2 (Execution Service): No fallback mock candidates for unconfigured connectors.
   - Layer 3 (Verification Sandbox): Pre- and post-harvest synthetic firewall.
   - Layer 4 (Database Persistence): Hard throw on any synthetic pattern in `upsertOpportunity`.
