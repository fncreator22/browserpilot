/**
 * §AUTONOMOUS CORRECTION LOOP CONTROLLER (TASK-052)
 * 
 * Orchestrates the bounded iterative correction loop:
 * Execution -> Observe -> Diagnose -> Correct -> Validate -> Execute -> Verify -> Decide
 * 
 * Features:
 * - Deterministic diagnosis
 * - Bounded budget enforcement (rounds, actions, time)
 * - Infinite loop & plan fingerprint deduplication
 * - Progress tracking & search exhaustion detection
 * - Cross-round candidate deduplication and ranking
 * - Tenant isolation and secret safety
 */

import crypto from "crypto";
import {
  type CorrectionState,
  type CorrectionLoopResult,
  type CorrectionBudgets,
  DEFAULT_CORRECTION_BUDGETS,
} from "./correctionTypes";
import { diagnoseSearchState } from "./deterministicDiagnoser";
import { planCorrection } from "./correctionPlanner";
import { searchActionExecutor } from "@/lib/ai/tools/searchActionExecutor";
import { evidenceVerificationEngine } from "@/lib/ai/evidence/evidenceEngine";
import { type CompositeVerificationResult } from "@/lib/ai/evidence/evidenceTypes";
import { type RawJobCandidate, type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import { type DiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { deduplicateCandidates, type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";
import { rankOpportunities, type RankedOpportunity } from "@/lib/scraper/ranker";

export interface CorrectionLoopOptions {
  userId?: string | null;
  budgets?: Partial<CorrectionBudgets>;
  customProviders?: any[];
  referenceTime?: Date;
}

export class CorrectionLoopController {
  /**
   * Computes a deterministic fingerprint of an action plan to prevent repeating the same action.
   */
  private computePlanFingerprint(reason: string, actions: { capabilityId: string; input: any }[]): string {
    const serialized = JSON.stringify({
      reason,
      actions: actions.map((a) => ({ cap: a.capabilityId, input: a.input })),
    });
    return crypto.createHash("md5").update(serialized).digest("hex");
  }

  /**
   * Executes the autonomous correction loop until satisfaction, budget exhaustion, or no-progress halt.
   */
  async runLoop(
    initialCandidates: RawJobCandidate[],
    initialVerificationResults: CompositeVerificationResult[],
    query: string,
    canonicalIntent: SearchIntent,
    discoveryPlan: DiscoveryPlan,
    options: CorrectionLoopOptions = {}
  ): Promise<{
    loopResult: CorrectionLoopResult;
    eligibleCandidates: RawJobCandidate[];
    rankedOpportunities: RankedOpportunity[];
  }> {
    const t0 = Date.now();
    const budgets: CorrectionBudgets = { ...DEFAULT_CORRECTION_BUDGETS, ...options.budgets };
    const refTime = options.referenceTime || new Date();
    const requested = canonicalIntent.requestedCount || 10;

    // Track state across rounds
    const candidatePool: RawJobCandidate[] = [...initialCandidates];
    const allVerificationResults: CompositeVerificationResult[] = [...initialVerificationResults];

    let eligibleCandidates = initialCandidates.filter((_, idx) => initialVerificationResults[idx]?.isEligible);
    let verifiedCount = eligibleCandidates.length;

    const state: CorrectionState = {
      searchId: `search_corr_${Date.now()}`,
      userId: options.userId || null,
      originalQuery: query,
      canonicalIntent,
      currentRound: 1,
      verifiedCount,
      requestedCount: requested,
      rejectedCount: initialCandidates.length - verifiedCount,
      staleCount: initialVerificationResults.filter((r) => r.rejectionReasons.some((re) => re.includes("days old"))).length,
      unknownDateCount: initialVerificationResults.filter((r) => r.rejectionReasons.some((re) => re.includes("unverified under explicit"))).length,
      invalidUrlCount: initialVerificationResults.filter((r) => r.rejectionReasons.some((re) => re.includes("generic portal"))).length,
      duplicateCount: 0,
      sourceFailures: [],
      executedCapabilities: ["discovery.search_pipeline"],
      attemptedSources: ["Google", "LinkedIn"],
      attemptedPlanFingerprints: [],
      history: [],
      isExhausted: false,
      isSatisfied: verifiedCount >= requested,
    };

    let totalActionsCount = 1;
    let consecutiveZeroProgressRounds = 0;
    let stoppingReason = "INITIAL_EVALUATION";

    // -------------------------------------------------------------------------
    // ITERATIVE CORRECTION LOOP
    // -------------------------------------------------------------------------
    while (
      state.verifiedCount < requested &&
      state.currentRound < budgets.maxCorrectionRounds &&
      totalActionsCount < budgets.maxTotalActions &&
      Date.now() - t0 < budgets.maxExecutionTimeMs &&
      !state.isExhausted
    ) {
      state.currentRound += 1;
      const roundStart = Date.now();
      const verifiedBefore = state.verifiedCount;

      // 1. Deterministic Diagnosis
      const diagnosis = diagnoseSearchState(state, allVerificationResults, candidatePool.length);
      if (!diagnosis.needsCorrection) {
        stoppingReason = state.verifiedCount >= requested ? "TARGET_SATISFIED" : "EXHAUSTED";
        state.isSatisfied = state.verifiedCount >= requested;
        break;
      }

      // 2. Correction Planning
      const { proposal, plan } = await planCorrection(state, diagnosis);

      // 3. Infinite Loop & Plan Fingerprint Check
      const fingerprint = this.computePlanFingerprint(diagnosis.reason, plan.actions);
      if (state.attemptedPlanFingerprints.includes(fingerprint)) {
        stoppingReason = "REPEATED_PLAN_PREVENTED";
        state.isExhausted = true;
        break;
      }
      state.attemptedPlanFingerprints.push(fingerprint);

      // 4. Execute Correction Actions
      const execRes = await searchActionExecutor.executePlan(plan, {
        userId: state.userId,
        customProviders: options.customProviders,
      });

      totalActionsCount += plan.actions.length;
      for (const act of plan.actions) {
        state.executedCapabilities.push(act.capabilityId);
        if (act.input.sourceName) state.attemptedSources.push(act.input.sourceName as string);
        if (act.input.companyName) state.attemptedSources.push(act.input.companyName as string);
      }

      // Extract new raw candidates from execution
      const newRawCandidates: RawJobCandidate[] = [];
      for (const actRes of execRes.actionResults) {
        if (actRes.status === "SUCCESS" && (actRes.data as any)?.results) {
          const resArray = (actRes.data as any).results;
          if (Array.isArray(resArray)) {
            newRawCandidates.push(...resArray);
          }
        } else if (actRes.status === "FAILED") {
          state.sourceFailures.push(`${actRes.capabilityId}: ${actRes.error || actRes.failureCategory}`);
        }
      }

      // 5. Verify Newly Harvested Candidates
      let newVerifiedGained = 0;
      if (newRawCandidates.length > 0) {
        const batchVerification = await evidenceVerificationEngine.verifyCandidateBatch(
          newRawCandidates,
          discoveryPlan,
          {
            userId: state.userId,
            referenceTime: refTime,
          }
        );

        allVerificationResults.push(...batchVerification.verificationResults);

        // Deduplicate new eligible candidates against existing pool
        const combinedEligible = [...eligibleCandidates, ...batchVerification.eligibleCandidates];
        const deduplicated = deduplicateCandidates(combinedEligible);

        newVerifiedGained = Math.max(0, deduplicated.length - eligibleCandidates.length);
        eligibleCandidates = deduplicated.map((d) => ({
          externalJobId: d.canonicalHash,
          sourcePlatform: d.sourceListings[0]?.sourcePlatform || "UNKNOWN",
          sourceUrl: d.sourceListings[0]?.sourceUrl || "",
          applyUrl: d.primaryApplyUrl || d.sourceListings[0]?.applyUrl || "",
          title: d.title,
          companyName: d.companyName,
          location: d.location,
          workMode: d.workMode,
          discoveredAt: d.firstSeenAt,
          postedAt: d.sourceListings[0]?.postedAt,
        }));

        state.verifiedCount = eligibleCandidates.length;
        candidatePool.push(...newRawCandidates);
      }

      // 6. Progress Detection
      if (newVerifiedGained === 0) {
        consecutiveZeroProgressRounds += 1;
        if (consecutiveZeroProgressRounds >= 2) {
          stoppingReason = "NO_PROGRESS_EXHAUSTED";
          state.isExhausted = true;
        }
      } else {
        consecutiveZeroProgressRounds = 0;
      }

      // Record round in history
      state.history.push({
        roundNumber: state.currentRound,
        reason: diagnosis.reason,
        strategy: proposal.strategy,
        planId: plan.planId,
        actionsExecuted: plan.actions.map((a) => a.capabilityId),
        verifiedBefore,
        verifiedAfter: state.verifiedCount,
        newVerifiedGained,
        rawCandidatesHarvested: newRawCandidates.length,
        rejectedCount: newRawCandidates.length - newVerifiedGained,
        durationMs: Date.now() - roundStart,
        stoppingReason: state.isExhausted ? stoppingReason : undefined,
      });

      if (state.verifiedCount >= requested) {
        stoppingReason = "TARGET_SATISFIED";
        state.isSatisfied = true;
        break;
      }
    }

    if (!stoppingReason || stoppingReason === "INITIAL_EVALUATION" || (state.verifiedCount < requested && stoppingReason === "TARGET_SATISFIED")) {
      stoppingReason = state.verifiedCount >= requested ? "TARGET_SATISFIED" : "EXHAUSTED";
    }

    // 7. Final Canonical Deduplication & Ranking
    const finalDeduplicated: DeduplicatedOpportunity[] = deduplicateCandidates(eligibleCandidates);
    const rankedOpportunities: RankedOpportunity[] = rankOpportunities(finalDeduplicated, canonicalIntent);

    const loopResult: CorrectionLoopResult = {
      isSatisfied: state.verifiedCount >= requested,
      finalVerifiedCount: rankedOpportunities.length,
      requestedCount: requested,
      totalRounds: state.currentRound,
      totalActions: totalActionsCount,
      totalDurationMs: Date.now() - t0,
      stoppingReason,
      correctionHistory: state.history,
      allVerificationResults,
    };

    return {
      loopResult,
      eligibleCandidates,
      rankedOpportunities,
    };
  }
}

export const correctionLoopController = new CorrectionLoopController();
