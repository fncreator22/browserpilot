/**
 * §AUTONOMOUS OPPORTUNITY DISCOVERY & SEARCH PIPELINE (TASK-013 ENHANCED)
 * Connects Discovery Planning -> Personalized Swarm Orchestration ->
 * Canonical Extraction Validation -> 3-Tier Deduplication ->
 * Freshness & 100-Point Relevance Ranking -> Persistence ->
 * Bounded Playwright Evidence Verification.
 */

import { type SearchIntent, type RawJobCandidate, type ProviderTelemetry } from "./providers/baseProvider";
import { SwarmDiscoveryEngine, swarmDiscoveryEngine, type SwarmTelemetry, type SourceStatusSummary } from "./swarmDiscovery";
import { buildDiscoveryPlan, type DiscoveryPlan, type UserProfilePreferences } from "./discoveryPlanner";
import { parseSearchIntent } from "./intentParser";
import { validateAndNormalizeExtractionBatch } from "./extractionContract";
import { deduplicateCandidates, type DeduplicatedOpportunity } from "./deduplicator";
import { rankOpportunities, type RankedOpportunity } from "./ranker";
import { isWithinFreshnessWindow, parsePostingDate } from "./freshnessExtractor";
import { verifyEvidenceForOpportunities, type VerificationTelemetry } from "./evidenceVerifier";
import { evaluateCandidateQualityGate, type QualityGateEvaluation } from "./searchQualityGate";
import { globalVerificationSandbox } from "@/lib/ai/verification";
import { careerBrainService } from "@/lib/discovery/taxonomy/careerBrainService";
import {
  createSearch,
  upsertOpportunity,
  upsertSourceListing,
  attachOpportunityToSearch,
  hasUserSeenOpportunity,
  getOpportunityByCanonicalHash,
} from "@/lib/db/opportunities";

export interface SearchDiagnostics {
  requestedCount: number;
  validResultCount: number;
  rejectedResultCount: number;
  staleResultCount: number;
  unknownDateCount: number;
  invalidUrlCount: number;
  duplicateCount: number;
  sourceCount: number;
  sourceFailures: number;
  searchDurationMs: number;
}

export interface DiscoveryResult {
  candidates: RawJobCandidate[];
  telemetry: ProviderTelemetry[];
  totalCandidates: number;
  durationMs: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "EMPTY";
}

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
  signal?: AbortSignal;
}

export interface PipelineResult {
  rankedOpportunities: RankedOpportunity[];
  discovery: DiscoveryResult;
  searchId?: string;
  totalUniqueOpportunities: number;
  durationMs: number;
  verificationTelemetry?: VerificationTelemetry;
  swarmTelemetry?: SwarmTelemetry;
  sourceStatusSummary?: SourceStatusSummary;
  plan?: DiscoveryPlan;
  searchExplanation?: string;
  searchDiagnostics?: SearchDiagnostics;
}

/**
 * §AUTONOMOUS SEARCH PIPELINE EXECUTOR
 * Executes the complete discovery, validation, deduplication, ranking, evidence verification, and persistence pipeline.
 */
export async function executeSearchPipeline(
  queryOrIntent: string | SearchIntent,
  options: PipelineExecutionOptions = {}
): Promise<PipelineResult> {
  const startTime = Date.now();

  if (options.signal?.aborted) {
    return {
      rankedOpportunities: [],
      discovery: {
        candidates: [],
        telemetry: [],
        totalCandidates: 0,
        durationMs: 0,
        status: "EMPTY",
      },
      totalUniqueOpportunities: 0,
      durationMs: Date.now() - startTime,
      searchExplanation: "Search execution was cancelled before start.",
    };
  }

  // 1. Resolve User Profile & DiscoveryPlan from Query or Intent
  let resolvedProfile = options.profile;
  if (!resolvedProfile && options.userId) {
    try {
      const { getUserProfile } = await import("@/lib/db/onboarding");
      const dbProfile = await getUserProfile(options.userId);
      if (dbProfile) {
        resolvedProfile = {
          skills: dbProfile.targetSkills,
          preferredLocations: dbProfile.preferredLocations,
          preferredWorkMode: dbProfile.preferredWorkModes?.[0] || "ANY",
          targetRoles: dbProfile.preferredRoles,
          experienceLevel: (dbProfile.experienceLevel as any) || undefined,
        };
      }
    } catch (err) {
      console.warn("[SearchPipeline] Could not hydrate user profile preferences:", err);
    }
  }

  let plan: DiscoveryPlan;
  let intent: SearchIntent;

  if (typeof queryOrIntent === "string") {
    intent = parseSearchIntent(queryOrIntent);
    // Merge user profile preferences additively when query omits specific criteria
    if (resolvedProfile) {
      if (!intent.location && resolvedProfile.preferredLocations?.length) {
        intent.location = resolvedProfile.preferredLocations[0];
        intent.locations = [...resolvedProfile.preferredLocations];
      }
      if ((!intent.workMode || intent.workMode === "ANY") && resolvedProfile.preferredWorkMode && resolvedProfile.preferredWorkMode !== "ANY") {
        intent.workMode = resolvedProfile.preferredWorkMode;
        intent.workModes = [resolvedProfile.preferredWorkMode];
      }
      if ((!intent.role || intent.role === "Job Search") && resolvedProfile.targetRoles?.length) {
        intent.role = resolvedProfile.targetRoles[0];
        intent.roles = [...resolvedProfile.targetRoles];
      }
      if (resolvedProfile.skills?.length) {
        const currentSkills = new Set(intent.skills || []);
        for (const s of resolvedProfile.skills) {
          if (currentSkills.size >= 6) break;
          currentSkills.add(s);
        }
        intent.skills = Array.from(currentSkills);
      }
    }
    plan = options.plan || buildDiscoveryPlan(queryOrIntent, {}, resolvedProfile);
  } else {
    intent = { ...queryOrIntent };
    if (resolvedProfile) {
      if (!intent.location && resolvedProfile.preferredLocations?.length) {
        intent.location = resolvedProfile.preferredLocations[0];
        intent.locations = [...resolvedProfile.preferredLocations];
      }
      if ((!intent.workMode || intent.workMode === "ANY") && resolvedProfile.preferredWorkMode && resolvedProfile.preferredWorkMode !== "ANY") {
        intent.workMode = resolvedProfile.preferredWorkMode;
        intent.workModes = [resolvedProfile.preferredWorkMode];
      }
      if ((!intent.role || intent.role === "Job Search") && resolvedProfile.targetRoles?.length) {
        intent.role = resolvedProfile.targetRoles[0];
        intent.roles = [...resolvedProfile.targetRoles];
      }
      if (resolvedProfile.skills?.length) {
        const currentSkills = new Set(intent.skills || []);
        for (const s of resolvedProfile.skills) {
          if (currentSkills.size >= 6) break;
          currentSkills.add(s);
        }
        intent.skills = Array.from(currentSkills);
      }
    }
    const effectiveRaw = options.rawQuery || queryOrIntent.queryHint || queryOrIntent.role || "Job Search";
    plan =
      options.plan ||
      buildDiscoveryPlan(effectiveRaw, intent, resolvedProfile);
  }

  // 2. Swarm Discovery Harvesting across Pluggable Providers (TASK-003 & TASK-013)
  const engine = options.customProviders
    ? new SwarmDiscoveryEngine(options.customProviders)
    : swarmDiscoveryEngine;

  const swarmResult = await engine.executeSwarm(plan, {
    customFetch: options.customFetch,
    customProviders: options.customProviders,
    concurrencyLimit: options.concurrencyLimit,
    perProviderTimeoutMs: options.perProviderTimeoutMs,
    totalTimeoutMs: options.totalTimeoutMs,
    signal: options.signal,
  });

  // 3. Upstream Canonical Extraction Validation (TASK-012)
  const batchVal = validateAndNormalizeExtractionBatch(swarmResult.candidates, { allowLocalForTests: true });
  const validExtractions = [...batchVal.valid, ...batchVal.partial];

  // Map validated extractions back to RawJobCandidate format with preserved posting timestamps
  const cleanCandidates = validExtractions.map((ext) => {
    let postedAt = (ext as any).postedAt ? new Date((ext as any).postedAt) : null;
    let postedAgoText = (ext as any).postedAgoText || null;
    if (!postedAt && (ext.rawSnippet || ext.description)) {
      const freshness = parsePostingDate(ext.rawSnippet || ext.description);
      if (freshness.postedAt) {
        postedAt = freshness.postedAt;
        postedAgoText = freshness.postedAgoText || null;
      }
    }

    return {
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
      postedAt,
      postedAgoText,
    };
  });

  // Authoritative Search Result Quality Gate Evaluation (TASK-044 & TASK-063 Truth Gate)
  let staleCount = 0;
  let unknownDateCount = 0;
  let invalidUrlCount = 0;
  let rejectedRoleCount = 0;
  const eligibleCandidates: typeof cleanCandidates = [];

  for (const candidate of cleanCandidates) {
    if (options.signal?.aborted) {
      break;
    }

    // TASK-063 Synthetic Data Firewall
    const synthCheck = globalVerificationSandbox.evaluateSyntheticCandidateFirewall(candidate as any);
    if (synthCheck.isSynthetic) {
      continue;
    }

    const gateEval = evaluateCandidateQualityGate(candidate as any, plan, new Date(startTime));
    if (gateEval.isEligible) {
      eligibleCandidates.push({
        ...candidate,
        postedAt: gateEval.parsedPostingDate,
        postedAgoText: gateEval.postedAgoText || candidate.postedAgoText,
      });
    } else {
      if (gateEval.rejectionReasons.some((r) => r.includes("older than") || r.includes("exceeds"))) {
        staleCount++;
      }
      if (gateEval.rejectionReasons.some((r) => r.includes("Posting date could not be verified"))) {
        unknownDateCount++;
      }
      if (gateEval.rejectionReasons.some((r) => r.includes("generic portal"))) {
        invalidUrlCount++;
      }
      if (!gateEval.roleMatch) {
        rejectedRoleCount++;
      }
    }
  }

  // 4. 3-Tier Multi-Source Deduplication (TASK-004)
  const deduplicatedOpps = deduplicateCandidates(eligibleCandidates as any);

  // Self-Expanding Career Brain: Learn novel roles, co-occurring skills, and portal frequencies
  if (deduplicatedOpps.length > 0) {
    careerBrainService.learnFromDiscoveredJobs(
      deduplicatedOpps.map((o) => ({
        title: o.title,
        skills: o.skills,
        sourcePlatform: o.sourceListings?.[0]?.sourcePlatform || "Web",
      })),
      "SearchPipeline"
    ).catch((err) => {
      console.warn("[SearchPipeline] Career brain learning non-fatal warning:", err);
    });
  }

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

  // Respect target requestedCount / maxResults limit
  const requestedCount = plan.requestedCount || options.maxResults || 10;
  let ranked = typeof requestedCount === "number" && requestedCount > 0
    ? candidatePool.slice(0, requestedCount)
    : candidatePool;;

  let searchId: string | undefined;

  // 6. Persistence via Opportunity DAL (TASK-002 & TASK-008)
  if (options.persistToDb) {
    const searchRecord = await createSearch({
      userId: options.userId || null,
      rawQuery: options.rawQuery || plan.rawQuery || intent.queryHint || intent.role || "Job Search",
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

  // Construct Search Explanation and Diagnostics (TASK-044/TASK-046)
  const daysWindow = plan.postedWithinDays || Math.round(plan.freshnessWindowHours / 24);
  const successfulSources = swarmResult.providerTelemetry.filter((t) => t.status === "SUCCESS" || t.status === "PARTIAL").length;
  const failedSources = swarmResult.providerTelemetry.filter((t) => t.status === "FAILED" || t.status === "TIMEOUT").length;
  const totalSources = swarmResult.providerTelemetry.length;
  let searchExplanation: string;

  if (ranked.length >= requestedCount) {
    searchExplanation = `Found ${ranked.length} verified ${plan.roles[0] || "job"} opportunities posted within the last ${daysWindow} days across ${successfulSources} sources.`;
  } else if (ranked.length > 0) {
    const shortfall = requestedCount - ranked.length;
    searchExplanation = `Found ${ranked.length} verified ${plan.roles[0] || "job"} opportunities matching your criteria. ${shortfall} additional opportunities could not be verified within the requested ${daysWindow}-day window.`;
  } else if (totalSources > 0 && failedSources === totalSources) {
    searchExplanation = `All discovery sources were temporarily unreachable. Please retry your search shortly.`;
  } else if (failedSources > 0) {
    searchExplanation = `No verified ${plan.roles[0] || "job"} opportunities found posted within the last ${daysWindow} days (${failedSources} source${failedSources > 1 ? "s" : ""} were unavailable).`;
  } else {
    searchExplanation = `No verified ${plan.roles[0] || "job"} opportunities found posted within the last ${daysWindow} days across searched sources.`;
  }

  const searchDiagnostics: SearchDiagnostics = {
    requestedCount,
    validResultCount: ranked.length,
    rejectedResultCount: (cleanCandidates.length - eligibleCandidates.length) + (swarmResult.swarmTelemetry?.rejectedByFreshness || 0),
    staleResultCount: staleCount + (swarmResult.swarmTelemetry?.rejectedByFreshness || 0),
    unknownDateCount,
    invalidUrlCount,
    duplicateCount: eligibleCandidates.length - deduplicatedOpps.length,
    sourceCount: totalSources,
    sourceFailures: failedSources,
    searchDurationMs: durationMs,
  };

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
    sourceStatusSummary: swarmResult.sourceStatusSummary,
    plan,
    searchExplanation,
    searchDiagnostics,
  };
}
