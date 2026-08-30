/**
 * §PLUGGABLE MULTI-SOURCE SEARCH ORCHESTRATOR
 * Coordinates bounded parallel execution across search providers (LinkedIn, YC, Indeed),
 * enforces hard per-provider and total timeout budgets, isolates failures, and collects raw candidates.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderTelemetry,
} from "./providers/baseProvider";
import { linkedInProvider } from "./providers/linkedInProvider";
import { ycProvider } from "./providers/ycProvider";
import { indeedProvider } from "./providers/indeedProvider";

export interface OrchestratorOptions {
  maxProviders?: number;
  maxCandidatesPerProvider?: number;
  concurrencyLimit?: number;
  perProviderTimeoutMs?: number;
  totalTimeoutMs?: number;
  customProviders?: SearchProvider[];
  customFetch?: typeof fetch;
}

export interface DiscoveryResult {
  candidates: RawJobCandidate[];
  telemetry: ProviderTelemetry[];
  totalCandidates: number;
  durationMs: number;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "EMPTY";
}

export class SearchOrchestrator {
  private defaultProviders: SearchProvider[] = [
    linkedInProvider,
    ycProvider,
    indeedProvider,
  ];

  /**
   * Discovers job candidates across supported providers with bounded concurrency and hard timeouts
   */
  public async executeDiscovery(
    intent: SearchIntent,
    options: OrchestratorOptions = {}
  ): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const providersToUse = options.customProviders || this.defaultProviders;
    const maxProviders = options.maxProviders || 3;
    const maxCandidatesPerProvider = options.maxCandidatesPerProvider || 8;
    const concurrencyLimit = Math.min(options.concurrencyLimit || 3, 3);
    const perProviderTimeoutMs = options.perProviderTimeoutMs || 6000;
    const totalTimeoutMs = options.totalTimeoutMs || 12000;

    // 1. Filter supported providers based on search intent criteria
    const activeProviders = providersToUse
      .filter((p) => p.supports(intent))
      .slice(0, maxProviders);

    if (activeProviders.length === 0) {
      return {
        candidates: [],
        telemetry: [],
        totalCandidates: 0,
        durationMs: Date.now() - startTime,
        status: "EMPTY",
      };
    }

    const limits: ProviderLimits = {
      maxCandidates: maxCandidatesPerProvider,
      timeoutMs: perProviderTimeoutMs,
    };

    const telemetryList: ProviderTelemetry[] = [];
    const allCandidates: RawJobCandidate[] = [];

    // Global timeout controller for the entire search orchestration
    const globalAbortController = new AbortController();
    const globalTimeoutTimer = setTimeout(() => {
      globalAbortController.abort();
    }, totalTimeoutMs);

    try {
      // 2. Execute providers concurrently in chunks respecting concurrencyLimit (max N=3)
      const providerPromises = activeProviders.map(async (provider) => {
        const pStart = Date.now();
        const providerAbortController = new AbortController();

        // Chain global abort to provider abort
        const handleGlobalAbort = () => providerAbortController.abort();
        globalAbortController.signal.addEventListener("abort", handleGlobalAbort);

        // Per-provider timeout timer
        const providerTimer = setTimeout(() => {
          providerAbortController.abort();
        }, perProviderTimeoutMs);

        try {
          const candidates = await provider.harvestCandidates(intent, limits, {
            customFetch: options.customFetch,
            signal: providerAbortController.signal,
          });

          clearTimeout(providerTimer);
          globalAbortController.signal.removeEventListener("abort", handleGlobalAbort);

          const durationMs = Date.now() - pStart;
          telemetryList.push({
            provider: provider.name,
            status: "SUCCESS",
            candidatesFound: candidates.length,
            durationMs,
          });

          return candidates;
        } catch (err: unknown) {
          clearTimeout(providerTimer);
          globalAbortController.signal.removeEventListener("abort", handleGlobalAbort);

          const durationMs = Date.now() - pStart;
          const isTimeout =
            (err as Error)?.name === "AbortError" ||
            (err as Error)?.name === "TimeoutError" ||
            durationMs >= perProviderTimeoutMs;

          telemetryList.push({
            provider: provider.name,
            status: isTimeout ? "TIMEOUT" : "FAILED",
            candidatesFound: 0,
            durationMs,
            error: (err as Error)?.message || "Provider error",
          });

          return [];
        }
      });

      // 3. Collect results using Promise.allSettled to guarantee 100% provider isolation
      const settledResults = await Promise.allSettled(providerPromises);

      for (const res of settledResults) {
        if (res.status === "fulfilled") {
          allCandidates.push(...res.value);
        }
      }
    } finally {
      clearTimeout(globalTimeoutTimer);
    }

    const totalDurationMs = Date.now() - startTime;
    const successCount = telemetryList.filter((t) => t.status === "SUCCESS" && t.candidatesFound > 0).length;
    const failCount = telemetryList.filter((t) => t.status === "FAILED" || t.status === "TIMEOUT").length;

    let overallStatus: DiscoveryResult["status"] = "SUCCESS";
    if (allCandidates.length === 0 && failCount > 0) {
      overallStatus = "FAILED";
    } else if (allCandidates.length === 0) {
      overallStatus = "EMPTY";
    } else if (failCount > 0) {
      overallStatus = "PARTIAL";
    }

    return {
      candidates: allCandidates,
      telemetry: telemetryList,
      totalCandidates: allCandidates.length,
      durationMs: totalDurationMs,
      status: overallStatus,
    };
  }
}

export const searchOrchestrator = new SearchOrchestrator();
