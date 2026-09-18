/**
 * DISCOVERY SEARCH ENGINE ORCHESTRATOR
 * 
 * Unified orchestrator for multi-tenant opportunity discovery:
 * 1. Intent Distillation: Strips user PII and personal notes before external dispatch.
 * 2. Subscription Capability Gating: Enforces Free vs Pro/Premium limits gracefully
 *    (e.g. company targeting, scan frequencies) with friendly upgrade notifications
 *    rather than raw 400/500 errors.
 * 3. Ephemeral Browser Isolation: Guarantees isolated browser contexts with zero
 *    cross-tenant session bleed.
 */

import { distillIntent, type DistilledSearchIntent } from "@/lib/scraper/intentDistiller";
import {
  checkDiscoveryRunEntitlements,
  type DiscoveryEntitlementCheckResult,
} from "@/lib/billing/entitlementService";
import { executeSearchPipeline, type PipelineResult } from "@/lib/scraper/searchPipeline";
import { type SearchIntent, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";

export interface DiscoveryEngineOptions {
  userId?: string;
  allowFallbackOnGated?: boolean;
  maxCandidates?: number;
  sources?: string[];
  signal?: AbortSignal;
  pipelineExecutor?: (criteria: any, options?: any) => Promise<PipelineResult>;
}

export interface DiscoveryEngineResult {
  success: boolean;
  status: "COMPLETED" | "CAPABILITY_GATED" | "EMPTY_RESULTS" | "ERROR";
  message?: string;
  distilledIntent: DistilledSearchIntent;
  entitlement: DiscoveryEntitlementCheckResult;
  upgradeNotification?: DiscoveryEntitlementCheckResult["upgradeNotification"];
  downgradedWithFallback?: boolean;
  opportunities: RawJobCandidate[];
  totalFound: number;
  telemetry: {
    durationMs: number;
    sourcesAttempted: string[];
    piiSanitizedCount: number;
  };
}

export class DiscoveryEngine {
  /**
   * Executes a discovery search with intent distillation, capability gating, and telemetry.
   */
  public async executeDiscovery(
    queryOrIntent: string | Partial<SearchIntent>,
    options: DiscoveryEngineOptions = {}
  ): Promise<DiscoveryEngineResult> {
    const startTime = Date.now();
    const userId = options.userId || "FREE";

    // 1. Distill Intent & Scrub PII
    const rawDistilled = distillIntent(queryOrIntent);

    // 2. Evaluate Subscription Capability Entitlements
    const entitlement = await checkDiscoveryRunEntitlements(userId, {
      companies: rawDistilled.companies,
      company: rawDistilled.company,
      requestedIntervalHours: rawDistilled.freshnessWindowHours,
    });

    let activeDistilled = rawDistilled;
    let downgradedWithFallback = false;

    // 3. Handle Gated Capabilities
    if (!entitlement.allowed) {
      if (options.allowFallbackOnGated) {
        // Run with company targeting stripped so the user still gets high-yield results across all employers
        downgradedWithFallback = true;
        activeDistilled = distillIntent(queryOrIntent, { allowCompanyTargeting: false });
      } else {
        // Return a clean, user-friendly capability-gated response (no 400 or 500 error)
        return {
          success: false,
          status: "CAPABILITY_GATED",
          message:
            entitlement.gatedFeatures[0]?.userFriendlyMessage ||
            "This discovery configuration requires an upgraded subscription.",
          distilledIntent: rawDistilled,
          entitlement,
          upgradeNotification: entitlement.upgradeNotification,
          downgradedWithFallback: false,
          opportunities: [],
          totalFound: 0,
          telemetry: {
            durationMs: Date.now() - startTime,
            sourcesAttempted: [],
            piiSanitizedCount: rawDistilled.strippedPiiCount,
          },
        };
      }
    }

    // 4. Dispatch Search Pipeline with Clean Distilled Criteria
    try {
      const executor = options.pipelineExecutor || executeSearchPipeline;
      const searchResult: PipelineResult = await executor(
        {
          role: activeDistilled.role,
          roles: activeDistilled.roles,
          skills: activeDistilled.skills,
          location: activeDistilled.location,
          locations: activeDistilled.locations,
          workMode: activeDistilled.workMode as any,
          workModes: activeDistilled.workModes as any,
          experienceLevel: activeDistilled.experienceLevel as any,
          experienceLevels: activeDistilled.experienceLevels as any,
          opportunityType: activeDistilled.opportunityType as any,
          opportunityTypes: activeDistilled.opportunityTypes as any,
          company: activeDistilled.company,
          companies: activeDistilled.companies,
          freshnessWindowHours: activeDistilled.freshnessWindowHours,
          postedWithinDays: activeDistilled.postedWithinDays,
          requestedCount: options.maxCandidates || activeDistilled.requestedCount || 30,
          sources: options.sources,
        },
        {
          signal: options.signal,
        }
      );

      const candidates = searchResult.discovery?.candidates || [];
      const sourcesAttempted = searchResult.discovery?.telemetry?.map((t: any) => t.source) || [];

      return {
        success: true,
        status: candidates.length > 0 ? "COMPLETED" : "EMPTY_RESULTS",
        distilledIntent: activeDistilled,
        entitlement,
        upgradeNotification: downgradedWithFallback ? entitlement.upgradeNotification : undefined,
        downgradedWithFallback,
        opportunities: candidates,
        totalFound: candidates.length,
        telemetry: {
          durationMs: Date.now() - startTime,
          sourcesAttempted,
          piiSanitizedCount: rawDistilled.strippedPiiCount,
        },
      };
    } catch (err: unknown) {
      console.error("[DiscoveryEngine] Execution error:", err);
      return {
        success: false,
        status: "ERROR",
        message: (err as Error).message || "Discovery search pipeline encountered an unexpected issue.",
        distilledIntent: activeDistilled,
        entitlement,
        opportunities: [],
        totalFound: 0,
        telemetry: {
          durationMs: Date.now() - startTime,
          sourcesAttempted: [],
          piiSanitizedCount: rawDistilled.strippedPiiCount,
        },
      };
    }
  }
}

export const discoveryEngine = new DiscoveryEngine();
