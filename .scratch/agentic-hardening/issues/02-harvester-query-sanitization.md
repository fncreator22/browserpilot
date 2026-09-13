# Issue 02: Harvester Query Sanitization & Multi-Source Harvest Guarantee

Status: resolved
Role: backend-fix, discovery-engine
Blocked-by: 01

## Resolution
1. Multi-source harvesting preserved when accelerators/groups are mentioned.
2. ycProvider buildSearchUrl sanitizes geographic parameters and adds resilient top YC startups ATS fallback.
3. atsProvider maps accelerator queries to known YC portfolio companies.
4. swarmDiscovery doesn't reject startup company names when searching accelerators.
5. Search pipeline yields 32 verified candidates across all providers.
