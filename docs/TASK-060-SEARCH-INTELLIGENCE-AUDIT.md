# TASK-060 — Search Intelligence Audit & Architecture Analysis

## 1. Executive Summary

This audit investigates legacy assumptions, disconnected intelligence, and truthfulness failures in BrowserPilot's search pipeline discovered during physical product validation.

---

## 2. Component-by-Component Architecture Audit

| Component | File Path | Architectural Status | Findings & Audit Observations |
|---|---|---|---|
| **Intent Parser** | `lib/scraper/intentParser.ts` | **PARTIALLY CONNECTED / FLAWED** | • Temporal expressions (`2 months`, `15 days`) collided with count and role extraction.<br>• Location dictionary lacked Indian states (e.g. Tripura) and regional geographies.<br>• Contextual noise (`in mechanical engineering`, `in last 2 months`) polluted fallback regex. |
| **Discovery Planner** | `lib/scraper/discoveryPlanner.ts` | **CONNECTED** | • Defaulted `sources` to `["LinkedIn", "Y Combinator", "Indeed", "ATS Direct", "Hacker News", "GitHub Curated"]` even when role was non-tech. |
| **Swarm Engine** | `lib/scraper/swarmDiscovery.ts` | **FLAWED OVERRIDE** | • `plan.sources.every((s) => defaultSourceSet.has(s))` evaluated to `true` on user-specified subsets like `LinkedIn + Indeed`, triggering ALL default sources and overriding user constraints. |
| **Source Prioritizer** | `lib/discovery/sources/sourcePrioritizer.ts` | **CONNECTED** | • Lacked a formal `SourceEligibilityModel` checking role and location domain relevance before attempting sources. |
| **Search Planner** | `lib/ai/searchPlanner/searchPlanner.ts` | **LEGACY ATS BIAS** | • Automatically generated `company.ats` actions targeting Greenhouse/Ashby for software companies even on generic queries. |
| **Correction Planner** | `lib/ai/harness/correction/correctionPlanner.ts` | **UNSAFE DEFAULTS** | • Injected hardcoded `["Stripe", "Anthropic"]` and `["Ashby", "Greenhouse", "Lever"]` during shortfall correction. |
| **ATS Provider** | `lib/scraper/providers/atsProvider.ts` | **LEGACY DEFAULTS** | • Treated ATS as a default search target instead of an employer infrastructure capability. |
| **Browser Connectors** | `lib/discovery/browser/connectors/` | **UNSAFE FALLBACKS** | • Generated placeholder companies (`Leading Organization`) and search result URLs (`/jobs/search?keywords=...`) rather than direct job detail links. |
| **Quality Gate** | `lib/scraper/searchQualityGate.ts` | **CONNECTED** | • Filtered basic generic portal URLs but did not inspect live page status for closed/dead jobs. |
| **Evidence Verifier** | `lib/scraper/evidenceVerifier.ts` | **PARTIAL PATTERNS** | • `validateJobPageContent` lacked patterns for Greenhouse (*"The job you are looking for is no longer open"*) and Ashby (*"Job not found. The job you requested was not found."*). |
| **Prompt Enhancer** | `components/prompt/prompt-enhancer.tsx` | **DECEPTIVE LABEL** | • Labeled raw prompt enhancer templates from `lib/ai/promptEnhancer.ts` as `"Verified Autonomous Blueprint"`. |
| **Search API Route** | `app/api/search/route.ts` | **CONNECTED** | • Did not report transparent source status breakdown (`requested`, `eligible`, `attempted`, `successful`, `failed`, `skipped`). |

---

## 3. Actual Production Runtime Path

```
USER QUERY
   ↓
/api/search
   ↓
parseSearchIntent (lib/scraper/intentParser.ts)
   ↓ (Resolves canonical intent: role, location, count, dateConstraint, sources)
intelligenceBrain.synthesizeBrainContext (lib/ai/brain/intelligenceBrain.ts)
   ↓ (Synthesizes tenant-isolated user memory & platform knowledge)
searchPlanner.planSearch (lib/ai/searchPlanner/searchPlanner.ts)
   ↓ (Generates capability-aware SearchActionPlan)
validateSearchActionPlan (lib/ai/searchPlanner/searchPlanValidator.ts)
   ↓ (Enforces constraints, domain boundaries, and step budgets)
searchActionExecutor.executePlan (lib/ai/tools/searchActionExecutor.ts)
   ↓ (Executes actions with dependency resolution)
swarmDiscoveryEngine.executeSwarm (lib/scraper/swarmDiscovery.ts)
   ↓ (Harvests candidates strictly across eligible, requested sources)
evidenceVerificationEngine.verifyCandidateBatch (lib/ai/evidence/evidenceEngine.ts)
   ↓ (Deterministic firewall + semantic judge + quality gate)
correctionLoopController.runLoop (lib/ai/harness/correction/correctionLoopController.ts)
   ↓ (Executes bounded shortfall corrections without inventing sources)
deduplicateCandidates (lib/scraper/deduplicator.ts)
   ↓ (3-tier canonical deduplication)
rankOpportunities (lib/scraper/ranker.ts)
   ↓ (100-point relevance & freshness ranking)
database persistence (lib/db/opportunities.ts)
   ↓
Authoritative Response Contract (Status, Verified Count, Explanation, Source Telemetry)
```

---

## 4. Legacy and Unsafe Defaults Discovered

1. **`lib/scraper/swarmDiscovery.ts` line 126**:
   `plan.sources.every((s) => defaultSourceSet.has(s))` reset `providersToUse` to `this.providers` (all 6 providers).
2. **`lib/ai/harness/correction/correctionPlanner.ts` line 73**:
   `targetComps = intent.companies ? intent.companies : ["Stripe", "Anthropic"]`.
3. **`lib/ai/harness/correction/correctionPlanner.ts` line 142 & 171**:
   `unattemptedSources = ["Ashby", "Greenhouse", "Lever", "Indeed"]` and `companyName: "Stripe"`.
4. **`components/prompt/prompt-enhancer.tsx` line 108**:
   `"Verified Autonomous Blueprint"` applied to unvalidated prompt suggestions.
5. **`lib/discovery/browser/connectors/linkedInConnector.ts` & `indeedConnector.ts`**:
   Search results URL and placeholder company `"Leading Organization"` generated when no company was specified.

---

## 5. Remediation Strategy

1. **Protect Temporal Expressions**: Extract relative dates and hours *before* role and count parsing. Forbid numbers attached to temporal units from becoming `requestedCount`.
2. **Support Arbitrary Roles**: Clean contextual noise from queries while preserving user's exact phrase (e.g. Mechanical Engineering -> Mechanical Engineer).
3. **Expand Geographies**: Add all Indian states (including Tripura) and dynamic geographic recognition.
4. **Strict Requested Source Fidelity**: If user asks for LinkedIn, YC, and Indeed, ONLY those sources are queried.
5. **Eliminate ATS Injection**: Treat ATS as an infrastructure connector only usable when a specific employer edge is discovered.
6. **Detect Dead Job URLs**: Add explicit detection in `validateJobPageContent` for Greenhouse and Ashby closure notices.
7. **Transparent Source Status**: Return `requestedSources`, `eligibleSources`, `attemptedSources`, `successfulSources`, `failedSources`, and `skippedSources`.
8. **Accurate Blueprint Labeling**: Label prompt optimization as `"Suggested Search Goal (Prompt Optimization)"`.
