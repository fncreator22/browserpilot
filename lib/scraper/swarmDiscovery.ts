/**
 * §PERSONALIZED SWARM DISCOVERY ENGINE
 * Coordinates bounded parallel execution across multi-source opportunity providers,
 * normalizes candidates, extracts posting freshness, tolerates partial provider failures,
 * and collects comprehensive swarm telemetry.
 * 
 * 100% deterministic coordination — 0 LLM token overhead.
 */

import {
  type SearchProvider,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderTelemetry,
  type SearchIntent,
} from "./providers/baseProvider";
import { linkedInProvider } from "./providers/linkedInProvider";
import { ycProvider } from "./providers/ycProvider";
import { indeedProvider } from "./providers/indeedProvider";
import { atsProvider } from "./providers/atsProvider";
import { hackerNewsProvider } from "./providers/hackerNewsProvider";
import { githubJobsProvider } from "./providers/githubJobsProvider";
import { type DiscoveryPlan } from "./discoveryPlanner";
import { parsePostingDate, isWithinFreshnessWindow } from "./freshnessExtractor";
import { normalizeCompany } from "./normalizer";
import {
  classifySourceError,
  sourceReliabilityManager,
} from "../discovery/execution/sourceReliabilityManager";

export interface SwarmTelemetry {
  sourcesRequested: number;
  sourcesCompleted: number;
  sourcesFailed: number;
  rawCandidates: number;
  validatedCandidates: number;
  rejectedCandidates: number;
  rejectedByFreshness: number;
  duplicatesRemoved: number;
  freshCandidates: number;
  staleCandidates: number;
  unknownFreshnessCandidates: number;
  opportunitiesCreated: number;
  opportunitiesUpdated: number;
  durationMs: number;
}

export interface SourceStatusSummary {
  requestedSources: string[];
  eligibleSources: string[];
  attemptedSources: string[];
  successfulSources: string[];
  failedSources: string[];
  skippedSources: string[];
  sourcesWithNoMatches: string[];
}

export interface SwarmDiscoveryResult {
  candidates: RawJobCandidate[];
  providerTelemetry: ProviderTelemetry[];
  swarmTelemetry: SwarmTelemetry;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "EMPTY" | "FAILED";
  sourceStatusSummary?: SourceStatusSummary;
}

export interface SwarmOptions {
  customProviders?: SearchProvider[];
  concurrencyLimit?: number;
  perProviderTimeoutMs?: number;
  totalTimeoutMs?: number;
  customFetch?: typeof fetch;
}

export class SwarmDiscoveryEngine {
  private providers: SearchProvider[] = [
    linkedInProvider,
    ycProvider,
    indeedProvider,
    atsProvider,
    hackerNewsProvider,
    githubJobsProvider,
  ];
  private isCustomEngine = false;

  constructor(customProviders?: SearchProvider[]) {
    if (customProviders && customProviders.length > 0) {
      this.providers = customProviders;
      this.isCustomEngine = true;
    }
  }

  /**
   * Converts a DiscoveryPlan into a SearchIntent for provider querying
   */
  public planToIntent(plan: DiscoveryPlan): SearchIntent {
    return {
      role: plan.roles[0] || undefined,
      roles: plan.roles,
      skills: plan.skills.length > 0 ? plan.skills : undefined,
      location: plan.locations[0] || undefined,
      locations: plan.locations,
      company: plan.targetCompanies[0] || undefined,
      companies: plan.targetCompanies.length > 0 ? plan.targetCompanies : undefined,
      workMode: plan.workModes[0] || "ANY",
      workModes: plan.workModes,
      opportunityType: plan.opportunityTypes[0] || "FULL_TIME",
      opportunityTypes: plan.opportunityTypes,
      experienceLevel: plan.experienceLevels[0] || "ENTRY_LEVEL",
      experienceLevels: plan.experienceLevels,
      targetGradYear: plan.targetGradYear || undefined,
      queryHint: plan.rawQuery,
      sortMode: plan.sortMode,
      freshnessWindowHours: plan.freshnessWindowHours,
      minimumMatchScore: plan.minimumMatchScore,
      sources: plan.sources,
      excludeKnown: plan.excludeKnown,
      watchIntent: plan.watchIntent,
    };
  }

  /**
   * Executes multi-source swarm discovery concurrently
   */
  public async executeSwarm(
    plan: DiscoveryPlan,
    options: SwarmOptions = {}
  ): Promise<SwarmDiscoveryResult> {
    const startTime = Date.now();
    const intent = this.planToIntent(plan);

    const hasExplicitSources = Boolean(plan.sources && plan.sources.length > 0);
    const providersToUse =
      options.customProviders && options.customProviders.length > 0
        ? options.customProviders
        : this.isCustomEngine
        ? this.providers
        : hasExplicitSources
        ? this.providers.filter((p) =>
            plan.sources.some(
              (s) =>
                p.name.toLowerCase().includes(s.toLowerCase()) ||
                s.toLowerCase().includes(p.name.toLowerCase()) ||
                (p.name.toLowerCase().includes("ats") && ["ashby", "greenhouse", "lever", "workable", "ats direct"].includes(s.toLowerCase()))
            )
          )
        : this.providers;

    const activeProviders = providersToUse.filter((p) => p.supports(intent));
    const concurrencyLimit = Math.min(options.concurrencyLimit || 3, 3);
    const perProviderTimeoutMs = options.perProviderTimeoutMs || 7000;
    const totalTimeoutMs = options.totalTimeoutMs || 14000;

    if (activeProviders.length === 0) {
      return {
        candidates: [],
        providerTelemetry: [],
        swarmTelemetry: {
          sourcesRequested: 0,
          sourcesCompleted: 0,
          sourcesFailed: 0,
          rawCandidates: 0,
          validatedCandidates: 0,
          rejectedCandidates: 0,
          rejectedByFreshness: 0,
          duplicatesRemoved: 0,
          freshCandidates: 0,
          staleCandidates: 0,
          unknownFreshnessCandidates: 0,
          opportunitiesCreated: 0,
          opportunitiesUpdated: 0,
          durationMs: Date.now() - startTime,
        },
        status: "EMPTY",
      };
    }

    const limits: ProviderLimits = {
      maxCandidates: plan.maxResultsPerSource,
      timeoutMs: perProviderTimeoutMs,
    };

    const providerTelemetryList: ProviderTelemetry[] = [];
    const allHarvestedCandidates: RawJobCandidate[] = [];
    const startTimeDate = new Date(startTime);
    let totalRejectedFreshness = 0;

    // Global timeout controller
    const globalAbort = new AbortController();
    const globalTimer = setTimeout(() => globalAbort.abort(), totalTimeoutMs);

    try {
      // Execute in bounded chunks according to concurrencyLimit
      for (let i = 0; i < activeProviders.length; i += concurrencyLimit) {
        const chunk = activeProviders.slice(i, i + concurrencyLimit);

        const chunkPromises = chunk.map(async (provider) => {
          const pStart = Date.now();

          // 1. Circuit Breaker / Health Cooldown Check
          const skipCheck = sourceReliabilityManager.shouldSkipSource(provider.name, startTimeDate);
          if (skipCheck.skip) {
            providerTelemetryList.push({
              provider: provider.name,
              status: "SKIPPED",
              candidatesFound: 0,
              durationMs: 0,
              error: skipCheck.reason || "Source skipped due to circuit breaker cooldown.",
              userFacingMessage: skipCheck.reason,
            });
            return;
          }

          const pAbort = new AbortController();
          const handleGlobal = () => pAbort.abort();
          globalAbort.signal.addEventListener("abort", handleGlobal);
          const pTimer = setTimeout(() => pAbort.abort(), perProviderTimeoutMs);

          let candidates: RawJobCandidate[] = [];
          let retryCount = 0;
          let lastErr: unknown = null;
          const maxTransientRetries = 1;

          try {
            for (let attempt = 0; attempt <= maxTransientRetries; attempt++) {
              try {
                candidates = await provider.harvestCandidates(intent, limits, {
                  customFetch: options.customFetch,
                  signal: pAbort.signal,
                });
                lastErr = null;
                break;
              } catch (err: unknown) {
                lastErr = err;
                const errClass = classifySourceError(err);
                if (attempt < maxTransientRetries && errClass.isTransient && !pAbort.signal.aborted) {
                  retryCount++;
                  continue; // retry transient error once
                }
                break;
              }
            }

            clearTimeout(pTimer);
            globalAbort.signal.removeEventListener("abort", handleGlobal);

            if (lastErr) {
              const isTimeout = (lastErr as Error).name === "AbortError" || pAbort.signal.aborted;
              const errClass = classifySourceError(lastErr);
              sourceReliabilityManager.recordOutcome(provider.name, "FAILURE", errClass.category, startTimeDate);

              providerTelemetryList.push({
                provider: provider.name,
                status: isTimeout ? "TIMEOUT" : "FAILED",
                candidatesFound: 0,
                durationMs: Date.now() - pStart,
                error: (lastErr as Error).message || "Provider execution failed",
                failureCategory: isTimeout ? "TEMPORARY_FAILURE" : errClass.category,
                retryCount,
                userFacingMessage: errClass.userFacingMessage,
              });
              return;
            }

            // Record successful harvest in reliability manager
            sourceReliabilityManager.recordOutcome(provider.name, "SUCCESS", undefined, startTimeDate);

            // Filter candidates by target company if specified in discovery plan
            let filteredCandidates = candidates;
            if (plan.targetCompanies && plan.targetCompanies.length > 0) {
              const normalizedTargets = plan.targetCompanies.map((t) => normalizeCompany(t));
              filteredCandidates = candidates.filter((c) => {
                const normComp = normalizeCompany(c.companyName);
                return normalizedTargets.some((target) => {
                  return normComp === target || normComp.includes(target) || target.includes(normComp);
                });
              });
            }

            // Extract posting dates on raw candidates where available
            let rejectedFreshnessInBatch = 0;
            const processed: RawJobCandidate[] = [];

            for (const c of filteredCandidates) {
              if (!c.discoveredAt) c.discoveredAt = new Date();
              if (!(c as any).postedAt) {
                const dateText = c.rawSnippet || c.salaryText || "";
                const freshness = parsePostingDate(dateText, c.discoveredAt);
                if (freshness.postedAt) {
                  (c as any).postedAt = freshness.postedAt;
                  (c as any).postedAgoText = freshness.postedAgoText;
                }
              }

              // Apply explicit freshness filter if requested
              if (plan.isExplicitFreshness) {
                const satisfiesFreshness = isWithinFreshnessWindow(
                  (c as any).postedAt,
                  plan.freshnessWindowHours,
                  true,
                  startTimeDate
                );
                if (!satisfiesFreshness) {
                  rejectedFreshnessInBatch++;
                  continue; // Reject candidate outside explicit freshness boundary
                }
              }

              processed.push(c);
            }

            allHarvestedCandidates.push(...processed);
            totalRejectedFreshness += rejectedFreshnessInBatch;

            providerTelemetryList.push({
              provider: provider.name,
              status: candidates.length > 0 ? "SUCCESS" : "PARTIAL",
              candidatesFound: candidates.length,
              durationMs: Date.now() - pStart,
              retryCount,
            });
          } catch (err: unknown) {
            clearTimeout(pTimer);
            globalAbort.signal.removeEventListener("abort", handleGlobal);

            const isTimeout = (err as Error).name === "AbortError" || pAbort.signal.aborted;
            const errClass = classifySourceError(err);
            sourceReliabilityManager.recordOutcome(provider.name, "FAILURE", errClass.category, startTimeDate);

            providerTelemetryList.push({
              provider: provider.name,
              status: isTimeout ? "TIMEOUT" : "FAILED",
              candidatesFound: 0,
              durationMs: Date.now() - pStart,
              error: (err as Error).message || "Provider execution failed",
              failureCategory: isTimeout ? "TEMPORARY_FAILURE" : errClass.category,
              retryCount,
              userFacingMessage: errClass.userFacingMessage,
            });
          }
        });

        await Promise.all(chunkPromises);
      }
    } finally {
      clearTimeout(globalTimer);
    }

    const durationMs = Date.now() - startTime;
    const completedCount = providerTelemetryList.filter((t) => t.status === "SUCCESS" || t.status === "PARTIAL").length;
    const failedCount = providerTelemetryList.filter((t) => t.status === "FAILED" || t.status === "TIMEOUT").length;

    let overallStatus: SwarmDiscoveryResult["status"] = "SUCCESS";
    if (allHarvestedCandidates.length === 0) {
      overallStatus = failedCount > 0 ? "FAILED" : "EMPTY";
    } else if (failedCount > 0) {
      overallStatus = "PARTIAL_SUCCESS";
    }

    let freshCount = 0;
    let staleCount = 0;
    let unknownCount = 0;

    for (const c of allHarvestedCandidates) {
      const pAt = (c as any).postedAt;
      if (pAt) {
        const ageDays = (Date.now() - new Date(pAt).getTime()) / (24 * 3600 * 1000);
        if (ageDays <= 3) freshCount++;
        else staleCount++;
      } else {
        unknownCount++;
      }
    }

    const swarmTelemetry: SwarmTelemetry = {
      sourcesRequested: activeProviders.length,
      sourcesCompleted: completedCount,
      sourcesFailed: failedCount,
      rawCandidates: allHarvestedCandidates.length + totalRejectedFreshness,
      validatedCandidates: allHarvestedCandidates.length,
      rejectedCandidates: totalRejectedFreshness,
      rejectedByFreshness: totalRejectedFreshness,
      duplicatesRemoved: 0,
      freshCandidates: freshCount,
      staleCandidates: staleCount,
      unknownFreshnessCandidates: unknownCount,
      opportunitiesCreated: 0,
      opportunitiesUpdated: 0,
      durationMs,
    };

    const requestedSources = plan.sources && plan.sources.length > 0 ? plan.sources : ["LinkedIn", "Y Combinator", "Indeed"];
    const eligibleSources = providersToUse.map((p) => p.name);
    const attemptedSources = activeProviders.map((p) => p.name);
    const skippedSources = providersToUse.filter((p) => !p.supports(intent)).map((p) => p.name);
    const successfulSources = providerTelemetryList.filter((t) => (t.status === "SUCCESS" || t.status === "PARTIAL") && t.candidatesFound > 0).map((t) => t.provider);
    const failedSources = providerTelemetryList.filter((t) => t.status === "FAILED" || t.status === "TIMEOUT").map((t) => t.provider);
    const sourcesWithNoMatches = providerTelemetryList.filter((t) => (t.status === "SUCCESS" || t.status === "PARTIAL") && t.candidatesFound === 0).map((t) => t.provider);

    const sourceStatusSummary: SourceStatusSummary = {
      requestedSources,
      eligibleSources,
      attemptedSources,
      successfulSources,
      failedSources,
      skippedSources,
      sourcesWithNoMatches,
    };

    return {
      candidates: allHarvestedCandidates,
      providerTelemetry: providerTelemetryList,
      swarmTelemetry,
      status: overallStatus,
      sourceStatusSummary,
    };
  }
}

export const swarmDiscoveryEngine = new SwarmDiscoveryEngine();
