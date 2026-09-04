# TASK-063: Global Verification Sandbox, Open-Web Discovery & Truth Gate

**Status:** COMPLETE  
**Priority:** CRITICAL  
**Dependencies:** TASK-062 (Forensic Runtime Audit)  
**Security/Cloud Boundary:** AWS LOCKED (Local implementation only, 0 cloud mutations, 0 npm dependencies added)  
**Optimization Standard:** Ponytail Full Compliance (YAGNI -> stdlib -> native platform -> minimal code)  

---

## 1. Architecture Implemented

TASK-063 creates the **Global Verification Sandbox, Open-Web Discovery & Truth Gate** layer that sits authoritatively between search planning/execution and truth presentation:

```text
USER QUERY
    ↓
INTENT / REGEX PARSER (Updated with plural fresher/graduate support)
    ↓
USER MEMORY + PLATFORM CONTEXT (Synthesized by IntelligenceBrain)
    ↓
SEARCH OBJECTIVE & DOMAIN FORMULATION
    ↓
OPEN-WEB SOURCE DISCOVERY ENGINE (Domain-agnostic query generation & domain evaluation)
    ↓
DYNAMIC SOURCE / CAPABILITY CANDIDATES
    ↓
GLOBAL VERIFICATION SANDBOX (Pre-Execution Integrity, SSRF, & Domain Barriers)
    ↓
EXECUTION PLAN APPROVED?
       ├── NO → STRUCTURED CORRECTION FEEDBACK (Preserving hard constraints)
       └── YES
             ↓
        SEARCH PIPELINE EXECUTION (Cancellable via AbortSignal)
             ↓
        RAW CANDIDATES
             ↓
        URL LIVELINESS VERIFIER & TRUTH GATE (Real HTTP dereferencing, closure detection)
             ↓
        SYNTHETIC DATA FIREWALL (Deterministic rejection of mock patterns)
             ↓
        EVIDENCE ENGINE & AUTHORITATIVE QUALITY GATE
             ↓
        DEDUPLICATION & RANKING
             ↓
        FINAL TRUTHFUL RESPONSE
```

### Key Modules Created & Extended:
1. **Global Verification Sandbox** ([`lib/ai/verification/verificationSandbox.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/verificationSandbox.ts)):
   - Evaluates request integrity, plan integrity, capability existence, and domain suitability prior to execution.
   - Enforces immutable user anchors (`role`, `location`, `requestedCount`, `postedWithinDays`, `workMode`, `targetCompanies`).
   - Issues structured correction guidance if plans attempt unsolicited tech ATS platform crawls for non-tech roles.
   - Operates the **Synthetic Data Firewall** rejecting mock candidates (`Leading Organization`, `Leading Employer`, `job_5001`, `boards.ashby.io`, etc.).
2. **URL Liveliness Verifier & Truth Gate** ([`lib/ai/verification/urlLivelinessVerifier.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/urlLivelinessVerifier.ts)):
   - Bounded real network verification (HTTP HEAD/GET) preventing dead 404 links or closed ATS listings from becoming `VERIFIED`.
   - SSRF protection: rejects RFC1918 private IPs, loopback, cloud metadata (`169.254.169.254`), non-HTTP protocols, and embedded credentials.
   - Redirect loop and re-validation: follows up to 3 redirects, re-verifying SSRF safety at every hop.
   - Post-redirect reclassification: if an apparent job link redirects to `/careers` or `/jobs`, it is reclassified as `GENERIC_PORTAL` and rejected.
   - Deterministic in-page closure detection: identifies signatures such as *"The job you are looking for is no longer open"*, *"Position has been filled"*, *"Application closed"*, 404, 410.
   - Anti-bot / CAPTCHA detection: catches Cloudflare/bot challenges without trying to bypass security controls.
3. **Open-Web Discovery Engine** ([`lib/ai/discovery/openWebDiscoveryEngine.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/discovery/openWebDiscoveryEngine.ts)):
   - Domain-agnostic query generator formulating multi-vector discovery queries across engineering, healthcare/nursing, civil, finance, sales, etc.
   - Strict role expansion firewalls (`doctor` ≠ `medical representative`, `nurse` ≠ `nursing assistant`, `mechanical engineer` ≠ `mechanical technician`).
   - Dynamic domain evaluation: classifies sources as `PUBLIC`, `OPTIONAL_LOGIN`, `REQUIRED_LOGIN`, `USER_SESSION_REQUIRED`, or `BLOCKED`.
   - Truthful source reconciliation: distinguishes `SOURCE_SUCCESS_NO_MATCH` from `SOURCE_UNAVAILABLE`, `AUTH_REQUIRED`, `CAPTCHA_DETECTED`, and `RATE_LIMITED`.
4. **URL Classifier & Quality Gate Fixes**:
   - Resolved **BUG-002**: `https://jobs.ashbyhq.com/{slug}/application` classified as `APPLICATION_PORTAL` in [`lib/scraper/normalizer.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/normalizer.ts).
   - Removed hardcoded `allowedDomains` in [`lib/ai/harness/intelligenceHarness.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/harness/intelligenceHarness.ts) (BUG-011).
   - Wired `AbortSignal` cancellation handling through [`lib/scraper/searchPipeline.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/searchPipeline.ts).

---

## 2. Existing Infrastructure Reused

In strict adherence to the **Ponytail** optimization guidelines, zero redundant abstractions were introduced:
- **Capability Registry**: Reused [`lib/ai/tools/searchCapabilityRegistry.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/tools/searchCapabilityRegistry.ts) for validating plan actions and schemas.
- **Search Intent**: Extended and aligned with canonical `SearchIntent` from [`lib/scraper/providers/baseProvider.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/providers/baseProvider.ts).
- **Intelligence Brain**: Reused [`lib/ai/brain/intelligenceBrain.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/brain/intelligenceBrain.ts) for multi-source memory and context synthesis.
- **Deduplication & Ranking**: Reused [`deduplicateCandidates`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/deduplicator.ts) and [`rankOpportunities`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/ranker.ts).
- **Quality Gate Authority**: Reused and strengthened [`evaluateCandidateQualityGate`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/searchQualityGate.ts).

---

## 3. Sandbox Pre-Execution Flow

```text
Incoming Search Plan
        │
        ├── 1. Request Integrity Check
        │      • originalQuery exists & non-empty?
        │      • canonicalIntent present?
        │
        ├── 2. Hard Constraint Anchor Verification
        │      • requestedCount, postedWithinDays, role, location, workMode strictly preserved.
        │
        ├── 3. Capability & Plan Integrity
        │      • Action count within budget (<= 15)?
        │      • No circular or missing dependencies?
        │      • No blocked security terms (bypass_captcha, extract_cookies, etc.)?
        │      • No private IP / SSRF in input URLs?
        │
        ├── 4. Domain Relevance Barrier
        │      • If non-tech role, verify plan does NOT use unrequested tech ATS connectors.
        │
        └── 5. Synthetic Pattern Inspection
               • Reject any mock markers in action inputs or reasoning.
```

**Outcomes:**
- `ALLOW_EXECUTION`: Plan proceeds to search pipeline.
- `REQUIRES_CORRECTION`: Structured correction feedback generated, strictly preserving user constraints.
- `REJECT`: Halted immediately with security/safety violation rationale.

---

## 4. Open-Web / Source Discovery Behavior

BrowserPilot is not locked to a fixed 4-platform universe (`LinkedIn`, `Indeed`, `Greenhouse`, `Lever`).
Given a user query:
1. Detects domain category (`healthcare`, `mechanical`, `civil`, `finance`, `software`, `marketing`, etc.).
2. Generates canonical, vacancy, synonym, and company discovery formulations.
3. Dynamically classifies open-web domains into source types:
   - `HOSPITAL_PORTAL` (e.g., Apollo Hospitals, AIIMS, Fortis)
   - `GOVERNMENT_PORTAL` (e.g., UPSC, state public service portals)
   - `RECRUITMENT_AGENCY` (e.g., Kelly OCG, Korn Ferry, ABC Consultants)
   - `COMPANY_CAREERS` (Direct employer portals)
   - `ATS_PORTAL` (Company-specific ATS instances)
   - `SPECIALIST_BOARD` / `AGGREGATOR` (Unstop, 9AM.Careers, general portals)

---

## 5. Login & Access Classification Model

Distinguishes 6 access tiers:
- `PUBLIC`: Publicly accessible search and job detail browsing (e.g. Google Careers, Indeed, Unstop, public hospital boards).
- `OPTIONAL_LOGIN`: Browsing works anonymously; login provides optional saved jobs / alerts (e.g. LinkedIn guest search, Naukri).
- `REQUIRED_LOGIN`: The required content cannot be accessed without authentication.
- `USER_SESSION_REQUIRED`: Accessible only when user has connected an encrypted browser session.
- `BLOCKED`: Actively blocked by WAF, CAPTCHA, or 403.
- `UNKNOWN`: Unverified.

**Security Policy**: BrowserPilot never guesses credentials, bypasses MFA, or bypasses CAPTCHA. If login is required and no user session exists, `AUTH_REQUIRED` is returned truthfully.

---

## 6. URL Liveliness Verification & Truth Gate

Replaces purely syntactic regex verification with physical network dereferencing:
- **Methodology**: HTTP GET (with bounded 256KB read limit) and HTTP HEAD optimizations.
- **SSRF Firewall**: Prohibits localhost, RFC1918 private subnets, loopback, and AWS/GCP metadata (`169.254.169.254`).
- **Redirect Following**: Follows up to 3 redirects, re-verifying security and SSRF rules at every hop.
- **Post-Redirect Reclassification**: If `/job/123` redirects to `/careers` or `/jobs`, the final URL is reclassified as `GENERIC_PORTAL` and rejected.
- **Classification States**:
  `LIVE_OPEN_JOB`, `LIVE_CLOSED_JOB`, `DEAD_NOT_FOUND`, `UNREACHABLE`, `TIMEOUT`, `RATE_LIMITED`, `BLOCKED`, `CAPTCHA_DETECTED`, `GENERIC_PORTAL`, `SEARCH_RESULTS_PAGE`, `APPLICATION_PORTAL`, `AMBIGUOUS`.

---

## 7. Evidence & Content Verification

A `200 OK` response alone does NOT stamp a job as verified.
The verifier inspects:
- In-page closure text: *"The job you are looking for is no longer open"*, *"Position has been filled"*, *"Application closed"*, etc.
- In-page bot detection: Cloudflare challenges, Turnstile, CAPTCHA forms.
- Required evidence: Direct job detail page + identifiable employer + identifiable title.

---

## 8. Dynamic Source Behavior & Failure Truthfulness

The engine strictly distinguishes **Source Failure** from **Zero Results**:
- `SOURCE_SUCCESS_NO_MATCH`: Source searched successfully, but 0 matching jobs found (e.g., Mechanical Engineering in Tripura). Truthfully reported as `0 verified opportunities`.
- `SOURCE_UNAVAILABLE`: Network drop or 5xx server error.
- `AUTH_REQUIRED`: Login wall encountered.
- `CAPTCHA_DETECTED`: Bot challenge encountered (suspended without bypass).
- `RATE_LIMITED`: HTTP 429 backoff.
- `EXTRACTION_FAILURE`: Markup parse failure.

---

## 9. Security & Multi-Tenant Isolation

- **Zero Tenant Leakage**: The sandbox is platform-global, but does not store private user queries, resumes, or cookies in global state.
- **Anonymized Identifiers**: User identifiers are hashed with SHA-256 (`hashUserId(userId)`), isolating tenant operations.
- **Admin Observability**: Aggregated telemetry tracks only anonymized counters (`totalRequests`, `allowCount`, `correctionCount`, `rejectCount`, `deadUrlsCount`, `closedJobsCount`, `genericPortalsCount`, `avgLatencyMs`).

---

## 10. Cancellation Compatibility

- `urlLivelinessVerifier` accepts and checks `AbortSignal` at each fetch hop.
- `executeSearchPipeline` accepts `signal?: AbortSignal` in `PipelineExecutionOptions` and halts candidate processing immediately upon abort.

---

## 11. Physical Test Matrix Results (21/21 Scenarios Passed)

The physical test harness ([`scratch/task063VerificationSandboxValidation.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/scratch/task063VerificationSandboxValidation.ts)) verified all required runtime conditions:

| Code | Scenario | Expected Behavior | Result |
| :--- | :--- | :--- | :---: |
| **A** | Valid Public Job | `LIVE_OPEN_JOB` & `isVerified=true` | **PASS** |
| **B** | Dead Valid-Looking ATS URL | `DEAD_NOT_FOUND` & `isVerified=false` | **PASS** |
| **C** | Closed Job (In-Page Signature) | `LIVE_CLOSED_JOB` & `closureSignalDetected=true` | **PASS** |
| **D** | Generic Career Root (`/careers`) | `GENERIC_PORTAL` & `isVerified=false` | **PASS** |
| **E** | Search Results Page (`/jobs/search`) | `SEARCH_RESULTS_PAGE` & `isVerified=false` | **PASS** |
| **F** | Redirect to Career Root | `GENERIC_PORTAL` & rejected post-redirect | **PASS** |
| **G** | Ashby Application URL Fix | `/application` classified as `APPLICATION_PORTAL` | **PASS** |
| **H** | HTTP 403 Forbidden | `BLOCKED` & `isVerified=false` | **PASS** |
| **I** | HTTP 429 Too Many Requests | `RATE_LIMITED` & `isVerified=false` | **PASS** |
| **J** | CAPTCHA / Bot Challenge | `CAPTCHA_DETECTED` (No bypass) | **PASS** |
| **K** | Network Timeout | `TIMEOUT` & `isVerified=false` | **PASS** |
| **L** | SSRF / Cloud Metadata | Private IPs, 169.254, loopback, file: rejected | **PASS** |
| **M** | Synthetic Candidate Firewall | `"Leading Organization"`, `"job_5001"` rejected | **PASS** |
| **N** | Dynamic Source Discovery | Healthcare -> `HOSPITAL_PORTAL` & high relevance | **PASS** |
| **O** | Open-Web Query Generation | Preserves role/fresher/location without false synonyms | **PASS** |
| **P** | Login Classification | `PUBLIC`, `OPTIONAL_LOGIN`, `REQUIRED_LOGIN` distinguished | **PASS** |
| **Q** | Sandbox Pre-Execution Approval | Valid plan -> `ALLOW_EXECUTION` | **PASS** |
| **R** | Sandbox Plan Correction | Invalid tech ATS plan -> `REQUIRES_CORRECTION` | **PASS** |
| **S** | Hard Constraint Anchor | Count, role, location, freshness strictly preserved | **PASS** |
| **T** | Multi-Tenant Isolation | SHA-256 hashed IDs, zero raw PII in telemetry | **PASS** |
| **SEC-35**| Section 35 Acceptance Flow | Healthcare Hyderabad search end-to-end truth gate | **PASS** |

---

## 12. Regression Tests (TASK-062 Suite)

Executed `npx tsx scratch/task062ForensicRuntimeAudit.ts`:
- **Result:** **21 / 21 scenarios passed (100% green)**.
- Confirmed zero regressions across health readiness, authenticated/unauthenticated API paths, reproduction queries, zero results truthfulness, and notification lifecycles.

---

## 13. Typecheck & Build Validation

- `npm run typecheck`: **0 errors** (clean TypeScript compilation).
- `npm run build`: **Next.js 16.3.2 Turbopack compiled successfully** in 4.8s; all 70 static/dynamic routes generated cleanly.

---

## 14. Ponytail Findings & Dependency Audit

- **Dependencies Added:** **0** (Zero new npm packages installed).
- **Standard Library Utilization:**
  - `crypto` for SHA-256 tenant hashing.
  - Native `fetch` with `AbortController` and bounded body streaming for URL liveliness.
  - Standard `URL` API for origin/host parsing and redirect resolution.
  - Standard regex for SSRF private IP pattern matching.
- **YAGNI Compliance:** Avoided speculative multi-agent architectures or standalone microservice brokers; connected directly into the existing harness and pipeline.

---

## 15. Files Changed & Created

| File | Status | Description |
| :--- | :--- | :--- |
| [`lib/ai/verification/sandboxTypes.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/sandboxTypes.ts) | **NEW** | Typed contracts for requests, decisions, liveliness states, and aggregate telemetry |
| [`lib/ai/verification/urlLivelinessVerifier.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/urlLivelinessVerifier.ts) | **NEW** | Real HTTP liveliness verifier, redirect follower, closure detector, and SSRF guard |
| [`lib/ai/verification/verificationSandbox.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/verificationSandbox.ts) | **NEW** | Pre-execution sandbox gate, constraint anchor, synthetic firewall, and tenant isolation |
| [`lib/ai/verification/index.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/verification/index.ts) | **NEW** | Verification barrel export |
| [`lib/ai/discovery/sourceDiscoveryTypes.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/discovery/sourceDiscoveryTypes.ts) | **NEW** | Discovered sources, login access tiers, and truthful source status models |
| [`lib/ai/discovery/openWebDiscoveryEngine.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/discovery/openWebDiscoveryEngine.ts) | **NEW** | Domain-agnostic query generator, domain classifier, and source status evaluator |
| [`lib/ai/discovery/index.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/discovery/index.ts) | **NEW** | Discovery barrel export |
| [`lib/scraper/normalizer.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/normalizer.ts) | **MODIFIED** | Added `APPLICATION_PORTAL` and fixed Ashby `/application` classification (BUG-002) |
| [`lib/scraper/searchQualityGate.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/searchQualityGate.ts) | **MODIFIED** | Added synthetic data firewall patterns and mock ATS domain rejection |
| [`lib/ai/evidence/deterministicVerifier.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/evidence/deterministicVerifier.ts) | **MODIFIED** | Added synthetic data firewall patterns to deterministic verification |
| [`lib/ai/harness/intelligenceHarness.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/harness/intelligenceHarness.ts) | **MODIFIED** | Removed hardcoded domains (BUG-011) and routed plans through `globalVerificationSandbox` |
| [`lib/ai/harness/harnessTypes.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/ai/harness/harnessTypes.ts) | **MODIFIED** | Added `allowedDomains?: string[]` to `HarnessExecutionOptions` |
| [`lib/scraper/searchPipeline.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/searchPipeline.ts) | **MODIFIED** | Added `signal?: AbortSignal` cancellation check and candidate synthetic firewall |
| [`lib/scraper/intentParser.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/lib/scraper/intentParser.ts) | **MODIFIED** | Added support for plural `freshers`, `graduates`, and `grads` in entry-level regex |
| [`scratch/task063VerificationSandboxValidation.ts`](file:///c:/Users/sr2ma/Documents/github/browserAI/scratch/task063VerificationSandboxValidation.ts) | **NEW** | Physical validation suite testing Scenarios A through T and Section 35 flow |

---

## 16. Known Limitations

1. **Network Dereferencing Latency**: Performing real HTTP requests introduces network latency (bounded by the configurable 5000ms timeout per URL). In high-volume searches, candidate verification must be throttled or batched.
2. **Dynamic Bot Countermeasures**: Certain highly protected portals (e.g. Cloudflare Turnstile protected sites) return 403 or challenge pages. Under our strict policy, BrowserPilot classifies these as `CAPTCHA_DETECTED` and suspends crawling without attempting anti-bot circumvention.
3. **Mock Connectors Inactive**: While the Sandbox rejects any synthetic candidate before it can become `VERIFIED`, the underlying mock connectors still exist in the repository until purged in TASK-064.

---

## 17. Deferred Dependencies (TASK-064 / 065 / 066)

- **TASK-064 (Synthetic Data & Mock Connector Purge)**: Completely delete mock candidate generators (`"Leading Organization"`, `"Leading Employer"`, `job_5001`, `atsProvider` fake candidates) from connectors.
- **TASK-065 (Interactive Search Token Accounting & Full Signal Propagation)**: Wire `recordAIUsageEvent` directly into `/api/search` and propagate `AbortSignal` through all nested provider connectors.
- **TASK-066 (Notification Scoping & Alert Hardening)**: Eliminate `prisma.opportunity.findFirst()` in notification services to avoid attaching random jobs to global alerts.

---

## 18. Conclusion

TASK-063 establishes the authoritative truth boundary for BrowserPilot. Real network liveness dereferencing, deterministic closure signatures, SSRF protection, dynamic open-web discovery, and synthetic data firewalls now guarantee that no dead link, generic portal, or mock opportunity can ever be marked as `VERIFIED`.
