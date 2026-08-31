/**
 * §AUTONOMOUS OPPORTUNITY DISCOVERY & SEARCH PIPELINE (TASK-013 ENHANCED)
 * Connects Discovery Planning -> Personalized Swarm Orchestration ->
 * Canonical Extraction Validation -> 3-Tier Deduplication ->
 * Freshness & 100-Point Relevance Ranking -> Persistence ->
 * Bounded Playwright Evidence Verification.
 */

import { type SearchIntent } from "./providers/baseProvider";
import { type DiscoveryResult } from "./searchOrchestrator";
import { swarmDiscoveryEngine, type SwarmTelemetry } from "./swarmDiscovery";
import { buildDiscoveryPlan, type DiscoveryPlan, type UserProfilePreferences } from "./discoveryPlanner";
import { validateAndNormalizeExtractionBatch } from "./extractionContract";
import { deduplicateCandidates, type DeduplicatedOpportunity } from "./deduplicator";
import { rankOpportunities, type RankedOpportunity } from "./ranker";
import { isWithinFreshnessWindow } from "./freshnessExtractor";
import { verifyEvidenceForOpportunities, type VerificationTelemetry } from "./evidenceVerifier";
import {
  createSearch,
  upsertOpportunity,
  upsertSourceListing,
  attachOpportunityToSearch,
  hasUserSeenOpportunity,
  getOpportunityByCanonicalHash,
} from "@/lib/db/opportunities";

export interface PipelineExecutionOptions {
  userId?: string | null;
  rawQuery?: string;
  persistToDb?: boolean;
  maxResults?: number;
  verifyEvidence?: boolean;
  maxVerificationCandidates?: number;
  excludeKnown?: boolean;
  allowedDomains?: string[];
  profile?: UserProfilePreferences;
  plan?: DiscoveryPlan;
  customFetch?: typeof fetch;
  customProviders?: any[];
  concurrencyLimit?: number;
  perProviderTimeoutMs?: number;
  totalTimeoutMs?: number;
}

export interface PipelineResult {
  rankedOpportunities: RankedOpportunity[];
  discovery: DiscoveryResult;
  searchId?: string;
  totalUniqueOpportunities: number;
  durationMs: number;
  verificationTelemetry?: VerificationTelemetry;
  swarmTelemetry?: SwarmTelemetry;
  plan?: DiscoveryPlan;
}

export async function executeSearchPipeline(
  intentOrQuery: SearchIntent | string,
  options: PipelineExecutionOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  // 1. Build Deterministic Discovery Plan
  const rawQuery = typeof intentOrQuery === "string"
    ? intentOrQuery
    : (options.rawQuery || intentOrQuery.queryHint || intentOrQuery.role || "");

  const intentFilters: Partial<SearchIntent> = typeof intentOrQuery === "object" ? intentOrQuery : {};
  const plan = options.plan || buildDiscoveryPlan(rawQuery, intentFilters, options.profile);
  const intent = swarmDiscoveryEngine.planToIntent(plan);

  // 2. Execute Parallel Source Swarm (LinkedIn, YC, Indeed)
  const swarmResult = await swarmDiscoveryEngine.executeSwarm(plan, {
    customProviders: options.customProviders,
    customFetch: options.customFetch,
    concurrencyLimit: options.concurrencyLimit,
    perProviderTimeoutMs: options.perProviderTimeoutMs,
    totalTimeoutMs: options.totalTimeoutMs,
  });

  // 3. Upstream Canonical Extraction Validation (TASK-012)
  const batchVal = validateAndNormalizeExtractionBatch(swarmResult.candidates, { allowLocalForTests: true });
  const validExtractions = [...batchVal.valid, ...batchVal.partial];

  // Map validated extractions back to RawJobCandidate format with preserved posting timestamps
  const cleanCandidates = validExtractions.map((ext) => ({
    sourcePlatform: ext.sourcePlatform || "Web",
    sourceUrl: ext.sourceUrl,
    applyUrl: ext.applyUrl || ext.sourceUrl,
    externalJobId: ext.externalJobId || undefined,
    title: ext.title,
    companyName: ext.companyName || ext.company,
    location: ext.location,
    workMode: ext.workMode,
    experienceLevel: ext.experienceLevel,
    opportunityType: ext.opportunityType,
    salaryText: ext.salaryMin && ext.salaryMax ? `$${ext.salaryMin} - $${ext.salaryMax}` : undefined,
    description: ext.description,
    rawSnippet: ext.rawSnippet || undefined,
    discoveredAt: new Date(ext.extractedAt || Date.now()),
    postedAt: (ext as any).postedAt || null,
  }));

  // Enforce explicit freshness filtering before deduplication
  const filteredCandidates = plan.isExplicitFreshness
    ? cleanCandidates.filter((c) =>
        isWithinFreshnessWindow(c.postedAt, plan.freshnessWindowHours, true, new Date(startTime))
      )
    : cleanCandidates;

  // 4. 3-Tier Multi-Source Deduplication (TASK-004)
  const deduplicatedOpps = deduplicateCandidates(filteredCandidates as any);

  // 5. Freshness-Aware 100-Point Relevance Ranking (TASK-004 & TASK-013)
  let allRanked = rankOpportunities(deduplicatedOpps, intent, {
    sortMode: plan.sortMode,
  });

  // Filter by minimumMatchScore if specified
  const minScore = plan.minimumMatchScore;
  if (typeof minScore === "number" && minScore > 0) {
    allRanked = allRanked.filter((item) => item.totalScore >= minScore);
  }

  // Filter out known/seen opportunities if requested
  let candidatePool = allRanked;
  if ((plan.excludeKnown || options.excludeKnown) && options.userId) {
    const novelRanked: RankedOpportunity[] = [];
    for (const item of allRanked) {
      const dbOpp = await getOpportunityByCanonicalHash(item.opportunity.canonicalHash);
      if (dbOpp) {
        const seen = await hasUserSeenOpportunity(options.userId, dbOpp.id);
        if (!seen) {
          novelRanked.push(item);
        }
      } else {
        novelRanked.push(item);
      }
    }
    candidatePool = novelRanked;
  }

  // Respect maxResults limit
  let ranked = typeof options.maxResults === "number" && options.maxResults > 0
    ? candidatePool.slice(0, options.maxResults)
    : candidatePool;

  let searchId: string | undefined;

  // 6. Persistence via Opportunity DAL (TASK-002 & TASK-008)
  if (options.persistToDb) {
    const searchRecord = await createSearch({
      userId: options.userId || null,
      rawQuery: plan.rawQuery || intent.queryHint || intent.role || "Job Search",
      intentType: plan.opportunityTypes.includes("INTERNSHIP") ? "JOB_SEARCH_INTERNSHIP" : "JOB_SEARCH_GENERAL",
      parsedRole: plan.roles[0] || intent.role || null,
      parsedSkills: plan.skills.length > 0 ? plan.skills : (intent.skills || []),
      parsedLocation: plan.locations[0] || intent.location || null,
      parsedWorkMode: plan.workModes[0] || intent.workMode || "ANY",
      targetGradYear: plan.targetGradYear || intent.targetGradYear || null,
      status: swarmResult.status === "FAILED" ? "FAILED" : "COMPLETED",
      totalFound: ranked.length,
    });
    searchId = searchRecord.id;

    for (const rankedItem of ranked) {
      const opp = rankedItem.opportunity;

      // Upsert canonical opportunity
      const persistedOpp = await upsertOpportunity({
        canonicalHash: opp.canonicalHash,
        title: opp.title,
        companyName: opp.companyName,
        location: opp.location,
        workMode: opp.workMode,
        experienceLevel: opp.experienceLevel,
        opportunityType: opp.opportunityType,
        salaryMin: opp.salaryMin,
        salaryMax: opp.salaryMax,
        salaryCurrency: opp.salaryCurrency,
        description: opp.description,
        requirements: opp.requirements,
        skills: opp.skills,
        primaryApplyUrl: opp.primaryApplyUrl,
        status: opp.status,
      });

      // Upsert attached source listings
      for (const listing of opp.sourceListings) {
        await upsertSourceListing({
          opportunityId: persistedOpp.id,
          sourcePlatform: listing.sourcePlatform,
          externalJobId: listing.externalJobId,
          sourceUrl: listing.sourceUrl,
          applyUrl: listing.applyUrl,
          rawSnippet: listing.rawSnippet,
          verificationStatus: listing.verificationStatus,
          screenshotPath: listing.screenshotPath,
        });
      }

      // Idempotently attach to search results
      await attachOpportunityToSearch({
        searchId: searchRecord.id,
        opportunityId: persistedOpp.id,
        matchScore: rankedItem.totalScore,
        rankPosition: rankedItem.rankPosition,
      });
    }
  }

  // 7. Bounded Evidence Verification (TASK-006)
  let verificationTelemetry: VerificationTelemetry | undefined;
  if (options.verifyEvidence && ranked.length > 0) {
    const verificationResult = await verifyEvidenceForOpportunities(ranked, {
      maxCandidates: options.maxVerificationCandidates || 10,
      searchId: searchId || `search_${Date.now()}`,
      allowedDomains: options.allowedDomains,
    });
    ranked = verificationResult.verifiedOpportunities;
    verificationTelemetry = verificationResult.telemetry;
  }

  const durationMs = Date.now() - startTime;

  const discoveryResult: DiscoveryResult = {
    candidates: cleanCandidates as any,
    telemetry: swarmResult.providerTelemetry,
    totalCandidates: cleanCandidates.length,
    durationMs,
    status: swarmResult.status === "PARTIAL_SUCCESS" ? "PARTIAL" : swarmResult.status as any,
  };

  const finalTelemetry: SwarmTelemetry = {
    ...swarmResult.swarmTelemetry,
    validatedCandidates: cleanCandidates.length,
    rejectedCandidates: batchVal.rejected.length,
    duplicatesRemoved: cleanCandidates.length - deduplicatedOpps.length,
    opportunitiesCreated: deduplicatedOpps.length,
    durationMs,
  };

  return {
    rankedOpportunities: ranked,
    discovery: discoveryResult,
    searchId,
    totalUniqueOpportunities: allRanked.length,
    durationMs,
    verificationTelemetry,
    swarmTelemetry: finalTelemetry,
    plan,
  };
}
