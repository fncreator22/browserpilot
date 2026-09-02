/**
 * §DETERMINISTIC DIAGNOSER (TASK-052)
 * 
 * Performs deterministic root-cause diagnosis of search deficiencies
 * before invoking any LLM correction planning.
 * Reduces token consumption and provides 100% predictable diagnostic triggers.
 */

import {
  type CorrectionReason,
  type CorrectionState,
} from "./correctionTypes";
import { type CompositeVerificationResult } from "@/lib/ai/evidence/evidenceTypes";

export interface DiagnosisOutput {
  needsCorrection: boolean;
  reason: CorrectionReason;
  shortfall: number;
  diagnosticSummary: string;
  recommendedCapabilities: string[];
}

/**
 * Diagnoses the state of search results deterministically.
 */
export function diagnoseSearchState(
  state: CorrectionState,
  verificationResults: CompositeVerificationResult[],
  rawCandidatesCount: number
): DiagnosisOutput {
  const verified = state.verifiedCount;
  const requested = state.requestedCount;
  const shortfall = Math.max(0, requested - verified);

  // 1. Fully Satisfied
  if (verified >= requested) {
    return {
      needsCorrection: false,
      reason: "TARGET_SHORTFALL", // not needed
      shortfall: 0,
      diagnosticSummary: `Target requested count reached (${verified}/${requested} verified).`,
      recommendedCapabilities: [],
    };
  }

  // 2. Critical Security / Auth Failures in State
  if (state.sourceFailures.some((f) => f.includes("CAPTCHA"))) {
    return {
      needsCorrection: true,
      reason: "CAPTCHA_DETECTED",
      shortfall,
      diagnosticSummary: "Source presented anti-bot CAPTCHA protection. Halt source and switch to direct ATS.",
      recommendedCapabilities: ["company.ats", "company.lookup", "source.search"],
    };
  }

  if (state.sourceFailures.some((f) => f.includes("AUTH_REQUIRED"))) {
    return {
      needsCorrection: true,
      reason: "AUTH_REQUIRED",
      shortfall,
      diagnosticSummary: "Authenticated source required active session credentials. Fallback to public endpoints.",
      recommendedCapabilities: ["company.ats", "company.careers", "discovery.search_pipeline"],
    };
  }

  // 3. Zero Candidates Discovered
  if (rawCandidatesCount === 0) {
    const hasCompanyTarget = (state.canonicalIntent.companies?.length || 0) > 0;
    return {
      needsCorrection: true,
      reason: hasCompanyTarget ? "COMPANY_DISCOVERY_REQUIRED" : "ZERO_RESULTS",
      shortfall,
      diagnosticSummary: `Zero candidates harvested on initial execution. Requires source expansion or ATS query.`,
      recommendedCapabilities: hasCompanyTarget
        ? ["company.ats", "company.careers", "company.lookup"]
        : ["source.search", "company.ats", "discovery.search_pipeline"],
    };
  }

  // 4. Zero Verified Candidates (Analyze Rejection Reasons)
  if (verified === 0 && verificationResults.length > 0) {
    const allRejections = verificationResults.flatMap((r) => r.rejectionReasons);

    const isStaleDominated = allRejections.every((r) => r.includes("days old") || r.includes("exceeds requested"));
    if (isStaleDominated) {
      return {
        needsCorrection: true,
        reason: "STALE_RESULTS",
        shortfall,
        diagnosticSummary: "All harvested candidates failed explicit freshness window. Querying fresh ATS boards.",
        recommendedCapabilities: ["company.ats", "source.search"],
      };
    }

    const isInvalidUrlDominated = allRejections.every((r) => r.includes("generic portal") || r.includes("career root") || r.includes("URL"));
    if (isInvalidUrlDominated) {
      return {
        needsCorrection: true,
        reason: "INVALID_URLS",
        shortfall,
        diagnosticSummary: "Harvested URLs point to generic root portals instead of direct job postings.",
        recommendedCapabilities: ["company.ats", "evidence.verify_url", "source.search"],
      };
    }

    const isRoleMismatchDominated = allRejections.every((r) => r.includes("semantically disjoint") || r.includes("Role"));
    if (isRoleMismatchDominated) {
      return {
        needsCorrection: true,
        reason: "ROLE_MISMATCH",
        shortfall,
        diagnosticSummary: "Harvested roles do not match requested career scope. Requires bounded query reformulation.",
        recommendedCapabilities: ["discovery.search_pipeline", "source.search"],
      };
    }

    const isMissingDateDominated = allRejections.every((r) => r.includes("Posting date is unverified") || r.includes("Posting date could not be verified"));
    if (isMissingDateDominated) {
      return {
        needsCorrection: true,
        reason: "INSUFFICIENT_EVIDENCE",
        shortfall,
        diagnosticSummary: "Candidates lack verified posting dates under explicit freshness search. Need direct metadata.",
        recommendedCapabilities: ["evidence.verify_metadata", "company.ats"],
      };
    }
  }

  // 5. Target Shortfall (e.g. 6 verified out of 10 requested)
  return {
    needsCorrection: true,
    reason: "TARGET_SHORTFALL",
    shortfall,
    diagnosticSummary: `Discovered ${verified} verified opportunities, which is ${shortfall} short of requested ${requested}.`,
    recommendedCapabilities: ["company.ats", "source.search", "company.lookup"],
  };
}
