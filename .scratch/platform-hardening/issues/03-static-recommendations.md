# Issue 03: Static/Hardcoded Recommendations Audit

Type: diagnosing-bugs
Status: resolved
Blocked by: none
Labels: ui-ux, discovery-engine

## Scope
Audit "Sample discovery queries," "Quick refinements," and any other suggestion chips shown to users across the application:
1. Are these a fixed hardcoded array, or dynamically generated from the user's real search history, career memory, or actual result gaps?
2. Inspect frontend components (`task-input.tsx`, `search-status-banner.tsx`, `prompt-enhancer.tsx`, etc.).
3. Identify where recommendation APIs exist vs where static fallback arrays are rendered.
4. Report the exact source and data provenance of this content.

## Comments

## Answer
### Findings & Provenance
1. **Source Provenance**:
   `components/agent/task-input.tsx` previously used a fixed static array `PRESET_TEMPLATES` (4 hardcoded templates for AI internships, YC, Data Analyst in Bengaluru, Frontend). No dynamic recommendation endpoint existed.
2. **Missing Personalization**:
   User career memory (saved in `user_profiles`) and previous search history were never leveraged to surface relevant queries on the discovery canvas.

### Implemented Fixes
1. **Created Dynamic Recommendations Endpoint (`GET /api/account/recommendations`)**:
   - Inspects authenticated user's career memory (`user_profiles`) and recent searches.
   - If user has Puter connected, prompts Puter LLM to generate 4 targeted, creative opportunity discovery queries.
   - If Puter is offline or user is on cold-start, synthesizes personalized queries via heuristic rule engine based on target roles, skills, and locations.
   - Falls back safely to default templates if unauthenticated or profile is empty.
2. **Dynamic Client Integration in `components/agent/task-input.tsx`**:
   - Added asynchronous recommendation fetching in `useEffect`.
   - Rendered subtle personalized visual feedback (`Sparkles` icon with "Recommended for you:") when recommendations are derived from user profile memory or Puter intelligence.
