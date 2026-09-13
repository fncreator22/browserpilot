# Issue 01: Source Imbalance Investigation

Type: diagnosing-bugs
Status: resolved
Blocked by: none
Labels: discovery-engine, backend-fix

## Scope
Real multi-source harvesting was proven working earlier (Greenhouse, Lever, Ashby, Apna, Workday all returned real results in isolated tests). Investigate why real user searches still skew toward LinkedIn:
1. Trace one real search end-to-end and log which sources were actually queried vs. which sources contributed to final ranked results.
2. Check the ranking/scoring engine (`ranker.ts`, `rankingEngine.ts`, 100-point relevance ranker) for any bias toward LinkedIn results (e.g. scoring weight, tie-breaker order, result-count cap favoring faster providers).
3. Check whether the candidate discovery engine's company-generation step disproportionately generates LinkedIn aggregator URLs vs direct company/ATS targets.

## Comments

## Answer
### Root Causes Identified
1. **Source Filtering Starvation in `intentParser.ts`**:
   `intentParser.ts` (line 845) had `defaultSources = ["LinkedIn", "Y Combinator", "Indeed"]`.
   Because `atsProvider` was named `"ATS Direct"` (matching Ashby, Greenhouse, Lever), and `defaultSources` omitted it, `swarmDiscovery.ts` filtered out `atsProvider` on all generic searches unless the user explicitly named an ATS in their query.
2. **Monopolization of Top 10 Ranks in `ranker.ts`**:
   `rankOpportunities` previously lacked source diversity constraints. When LinkedIn returned 20 candidates and ATS returned 3, LinkedIn candidates occupied the entire top 10 positions even with minor score differentials.

### Implemented Fixes
1. **Updated `defaultSources` in `lib/scraper/intentParser.ts`**:
   Now includes `["LinkedIn", "ATS Direct", "Greenhouse", "Lever", "Ashby", "Y Combinator", "Hacker News", "GitHub Curated"]`. Added regex recognition for `ats|direct|company careers`.
2. **Implemented 40% Per-Source Diversity Cap in `lib/scraper/ranker.ts`**:
   Added `applySourceDiversityCap`: within each window of 10 results, no single platform may occupy more than 40% of slots when alternative platform candidates exist, while falling back cleanly if a platform's candidates are exhausted.
3. **Unit Tests**:
   Added automated regression in `tests/unit/ranker.test.ts` verifying top 10 diversity (5 LinkedIn, 3 Greenhouse, 2 YC). Verified passing (100%).
