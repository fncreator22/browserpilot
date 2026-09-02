/**
 * §UNIFIED EVIDENCE VERIFICATION ENGINE (TASK-051)
 * 
 * Coordinates:
 * 1. Evidence Extraction & Normalization
 * 2. Deterministic Verification & Hard Constraint Firewall
 * 3. Semantic Evidence Judge with Prompt Injection Protection
 * 4. Authoritative Search Quality Gate Integration
 * 5. Composite Confidence Scoring & Diagnostics
 */

import {
  type CompositeVerificationResult,
  type SemanticJudgeDecision,
  type VerificationDiagnostics,
} from "./evidenceTypes";
import { extractEvidenceFromCandidate, normalizeCandidateEvidence } from "./evidenceNormalizer";
import { verifyDeterministicEvidence } from "./deterministicVerifier";
import { evaluateSemanticEvidence, type SemanticJudgeOptions } from "./semanticJudge";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { type DiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { evaluateCandidateQualityGate } from "@/lib/scraper/searchQualityGate";

export interface EvidenceEngineOptions extends SemanticJudgeOptions {
  userId?: string | null;
  referenceTime?: Date;
  strictQualityGate?: boolean;
}

export class EvidenceVerificationEngine {
  /**
   * Verifies a single raw candidate through the complete evidence hierarchy.
   */
  async verifyCandidate(
    candidate: RawJobCandidate,
    plan: DiscoveryPlan,
    options: EvidenceEngineOptions = {}
  ): Promise<CompositeVerificationResult> {
    const t0 = Date.now();
    const refTime = options.referenceTime || new Date();
    const candId = (candidate as any).id || candidate.externalJobId || candidate.sourceUrl || `cand_${Date.now()}`;

    // 1. Evidence Extraction & Normalization
    const rawRecords = extractEvidenceFromCandidate(candidate, options.userId);
    const normalizedEvidence = normalizeCandidateEvidence(candId, rawRecords);

    // 2. Deterministic Verification (Hard Constraint Firewall)
    const deterministicResult = verifyDeterministicEvidence(normalizedEvidence, plan, refTime);

    // 3. Authoritative Quality Gate Evaluation (Preserve TASK-044/045/046 authority)
    const qualityGateResult = evaluateCandidateQualityGate(candidate, plan, refTime);

    // 4. Semantic Judge Evaluation
    let semanticResult = undefined;
    if (!deterministicResult.isHardBlocked && qualityGateResult.isEligible) {
      semanticResult = await evaluateSemanticEvidence(normalizedEvidence, plan, deterministicResult, options);
    }

    // 5. Final Decision & Eligibility Resolution
    let finalDecision: SemanticJudgeDecision = "REJECTED";
    let isEligible = false;
    let overallConfidence = 0.0;
    const allRejectionReasons: string[] = [
      ...deterministicResult.rejectionReasons,
      ...qualityGateResult.rejectionReasons,
    ];

    if (deterministicResult.isHardBlocked || !qualityGateResult.isEligible) {
      finalDecision = "REJECTED";
      isEligible = false;
      overallConfidence = 0.0;
    } else if (semanticResult?.decision === "REJECTED") {
      finalDecision = "REJECTED";
      isEligible = false;
      overallConfidence = Math.min(0.3, semanticResult.confidence);
      allRejectionReasons.push(`Semantic judge rejected: ${semanticResult.summary}`);
    } else if (normalizedEvidence.conflicts.some((c) => c.resolution === "UNRESOLVED_NEEDS_MORE_EVIDENCE")) {
      finalDecision = "NEEDS_MORE_EVIDENCE";
      isEligible = false;
      overallConfidence = 0.5;
      allRejectionReasons.push("Unresolved conflicting evidence between authoritative sources");
    } else if (semanticResult?.decision === "VERIFIED" || (!semanticResult && deterministicResult.isEligible)) {
      finalDecision = "VERIFIED";
      isEligible = true;
      const baseConf = normalizedEvidence.authoritativeCount > 0 ? 0.95 : 0.85;
      overallConfidence = semanticResult ? Math.max(baseConf, semanticResult.confidence) : baseConf;
    } else if (semanticResult?.decision === "PARTIAL") {
      finalDecision = "PARTIAL";
      isEligible = true; // Partial evidence is eligible under soft search
      overallConfidence = Math.max(0.65, semanticResult.confidence);
    } else {
      finalDecision = "NEEDS_MORE_EVIDENCE";
      isEligible = false;
      overallConfidence = 0.4;
    }

    // Diagnostics
    const diagnostics: VerificationDiagnostics = {
      evidenceCount: normalizedEvidence.totalRecordsCount,
      authoritativeEvidenceCount: normalizedEvidence.authoritativeCount,
      deterministicChecks: {
        passedCount: deterministicResult.passedConstraints.length,
        failedCount: deterministicResult.failedConstraints.length,
        hardBlocked: deterministicResult.isHardBlocked,
        reasons: deterministicResult.rejectionReasons,
      },
      semanticDecision: semanticResult?.decision,
      semanticConfidence: semanticResult?.confidence,
      failedConstraints: [
        ...deterministicResult.failedConstraints,
        ...(semanticResult?.failedConstraints || []),
      ],
      uncertainConstraints: semanticResult?.uncertainConstraints || [],
      verificationDurationMs: Date.now() - t0,
      finalDecision,
    };

    return {
      candidateId: candId,
      isEligible,
      finalDecision,
      overallConfidence,
      normalizedEvidence,
      deterministicResult,
      semanticResult,
      rejectionReasons: Array.from(new Set(allRejectionReasons)),
      diagnostics,
    };
  }

  /**
   * Verifies a batch of raw candidates, returning only verified and eligible candidates.
   */
  async verifyCandidateBatch(
    candidates: RawJobCandidate[],
    plan: DiscoveryPlan,
    options: EvidenceEngineOptions = {}
  ): Promise<{
    eligibleCandidates: RawJobCandidate[];
    rejectedCandidates: RawJobCandidate[];
    verificationResults: CompositeVerificationResult[];
    telemetry: {
      totalEvaluated: number;
      eligibleCount: number;
      rejectedCount: number;
      authoritativeEvidenceTotal: number;
      durationMs: number;
    };
  }> {
    const t0 = Date.now();
    const results: CompositeVerificationResult[] = [];
    const eligibleCandidates: RawJobCandidate[] = [];
    const rejectedCandidates: RawJobCandidate[] = [];

    let authoritativeTotal = 0;

    for (const cand of candidates) {
      const verRes = await this.verifyCandidate(cand, plan, options);
      results.push(verRes);
      authoritativeTotal += verRes.diagnostics.authoritativeEvidenceCount;

      if (verRes.isEligible) {
        eligibleCandidates.push(cand);
      } else {
        rejectedCandidates.push(cand);
      }
    }

    return {
      eligibleCandidates,
      rejectedCandidates,
      verificationResults: results,
      telemetry: {
        totalEvaluated: candidates.length,
        eligibleCount: eligibleCandidates.length,
        rejectedCount: rejectedCandidates.length,
        authoritativeEvidenceTotal: authoritativeTotal,
        durationMs: Date.now() - t0,
      },
    };
  }
}

export const evidenceVerificationEngine = new EvidenceVerificationEngine();
