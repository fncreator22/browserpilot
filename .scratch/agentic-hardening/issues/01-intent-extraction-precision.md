# Issue 01: Intent Extraction Precision & Output Contamination Prevention

Status: resolved
Role: backend-fix, discovery-engine
Blocked-by: none

## Resolution
1. Added Y Combinator to KNOWN_COMPANY_DEFINITIONS.
2. Dynamic location regex stops at company/accelerator boundaries.
3. Puter and Gemini fallback logic reject blacklisted non-geographic locations.
4. Search refinement chips suppress Senior/Lead for entry-level queries.
