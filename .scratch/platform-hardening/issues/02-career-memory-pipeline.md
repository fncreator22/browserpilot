# Issue 02: Career Memory Application in Live Search

Type: diagnosing-bugs
Status: resolved
Blocked by: none
Labels: backend-fix, discovery-engine

## Scope
Confirm: when a user updates their career preferences/memory (target roles, skills, comp floor, locations) in Settings, is that data actually read anywhere in the real search request path (intent parsing, ranking, personalization injection)?
1. Trace one real search for a user with saved memory and show whether their memory data appears anywhere in the actual query sent to the search pipeline.
2. If it's write-only (saved to DB but never read in the standard search path), find exactly where the read should happen and was never wired in.
3. Check both natural language search (`/api/search`) and autonomous discovery runs (`/api/discovery/watch`).

## Comments

## Answer
### Root Causes Identified
1. **Conditional Gating on Exact Keywords**:
   In `intentParser.ts` (lines 1008 & 1261), profile memory was previously only injected if the user explicitly typed keywords like `"memory"` or `"saved location"` in their natural language prompt. Plain searches (e.g. `"software engineer"`) bypassed saved locations, target skills, and work modes.
2. **Missing Profile Hydration in Search Execution**:
   In `searchPipeline.ts` (line 116), `executeSearchPipeline` called `buildDiscoveryPlan` without hydrating the user's DB profile when `options.profile` was omitted.
3. **Overly Restrictive Location Backfill**:
   In `discoveryPlanner.ts` (line 166), `profile.preferredLocations` was gated on `!hasExplicitQuery`, preventing saved locations from applying whenever any query string was provided.

### Implemented Fixes
1. **Additive Memory Merge in `lib/scraper/intentParser.ts`**:
   Both deterministic and Puter parsing pathways now additively merge target skills (up to 6), fallback to preferred locations when query location is absent, apply preferred work mode when query mode is `"ANY"`, and apply target experience level.
2. **Profile Hydration in `lib/scraper/searchPipeline.ts`**:
   When `options.userId` is present, `executeSearchPipeline` dynamically imports and invokes `getUserProfile(userId)`, merging career preferences into `intent` and passing them to `buildDiscoveryPlan`.
3. **Unblocked Location Fallback in `lib/scraper/discoveryPlanner.ts`**:
   Removed `!hasExplicitQuery` gating so saved locations automatically guide search whenever the user doesn't specify an explicit city/country override.
