/**
 * §CANONICAL AUTONOMOUS CORRECTION CONTRACTS & SCHEMAS (TASK-052)
 * 
 * Defines the correction state machine, typed correction reasons,
 * diagnosis outputs, correction proposals, and deterministic loop budgets.
 */

import { z } from "zod";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";
import { type SearchActionPlan, type PlannedSearchAction } from "@/lib/ai/searchPlanner/searchActionPlan";
import { type CompositeVerificationResult } from "@/lib/ai/evidence/evidenceTypes";

export type CorrectionReason =
  | "TARGET_SHORTFALL"
  | "ZERO_RESULTS"
  | "STALE_RESULTS"
  | "INVALID_URLS"
  | "ROLE_MISMATCH"
  | "LOCATION_MISMATCH"
  | "WORK_MODE_MISMATCH"
  | "SENIORITY_MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "SOURCE_FAILURE"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "CAPTCHA_DETECTED"
  | "TIMEOUT"
  | "DUPLICATE_HEAVY"
  | "COMPANY_DISCOVERY_REQUIRED"
  | "ATS_DISCOVERY_REQUIRED"
  | "SEARCH_EXHAUSTED"
  | "NO_PROGRESS";

export type CorrectionStrategy =
  | "EXPAND_SOURCES"
  | "EXPAND_COMPANY_ATS"
  | "REFORMULATE_QUERY"
  | "COLLECT_METADATA_EVIDENCE"
  | "FALLBACK_DISCOVERY"
  | "HALT_NO_PROGRESS"
  | "TERMINATE_EXHAUSTED";

export interface CorrectionProposal {
  reason: CorrectionReason;
  strategy: CorrectionStrategy;
  additionalCapabilities: string[];
  sourceTargets: string[];
  queryRefinements: string[];
  expectedEvidence: string[];
  confidence: number;
  summary: string;
}

export const CorrectionProposalSchema = z.object({
  reason: z.enum([
    "TARGET_SHORTFALL",
    "ZERO_RESULTS",
    "STALE_RESULTS",
    "INVALID_URLS",
    "ROLE_MISMATCH",
    "LOCATION_MISMATCH",
    "WORK_MODE_MISMATCH",
    "SENIORITY_MISMATCH",
    "INSUFFICIENT_EVIDENCE",
    "SOURCE_FAILURE",
    "AUTH_REQUIRED",
    "RATE_LIMITED",
    "CAPTCHA_DETECTED",
    "TIMEOUT",
    "DUPLICATE_HEAVY",
    "COMPANY_DISCOVERY_REQUIRED",
    "ATS_DISCOVERY_REQUIRED",
    "SEARCH_EXHAUSTED",
    "NO_PROGRESS",
  ]),
  strategy: z.enum([
    "EXPAND_SOURCES",
    "EXPAND_COMPANY_ATS",
    "REFORMULATE_QUERY",
    "COLLECT_METADATA_EVIDENCE",
    "FALLBACK_DISCOVERY",
    "HALT_NO_PROGRESS",
    "TERMINATE_EXHAUSTED",
  ]),
  additionalCapabilities: z.array(z.string()),
  sourceTargets: z.array(z.string()),
  queryRefinements: z.array(z.string()),
  expectedEvidence: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(300),
});

export interface CorrectionRoundRecord {
  roundNumber: number;
  reason: CorrectionReason;
  strategy: CorrectionStrategy;
  planId: string;
  actionsExecuted: string[];
  verifiedBefore: number;
  verifiedAfter: number;
  newVerifiedGained: number;
  rawCandidatesHarvested: number;
  rejectedCount: number;
  durationMs: number;
  stoppingReason?: string;
}

export interface CorrectionBudgets {
  maxCorrectionRounds: number; // default: 3
  maxTotalActions: number;     // default: 20
  maxActionsPerRound: number;  // default: 8
  maxModelCorrections: number; // default: 3
  maxExecutionTimeMs: number;  // default: 45000
}

export const DEFAULT_CORRECTION_BUDGETS: CorrectionBudgets = {
  maxCorrectionRounds: 3,
  maxTotalActions: 20,
  maxActionsPerRound: 8,
  maxModelCorrections: 3,
  maxExecutionTimeMs: 45000,
};

export interface CorrectionState {
  searchId: string;
  userId: string | null;
  originalQuery: string;
  canonicalIntent: SearchIntent;
  currentRound: number;
  verifiedCount: number;
  requestedCount: number;
  rejectedCount: number;
  staleCount: number;
  unknownDateCount: number;
  invalidUrlCount: number;
  duplicateCount: number;
  sourceFailures: string[];
  executedCapabilities: string[];
  attemptedSources: string[];
  attemptedPlanFingerprints: string[];
  history: CorrectionRoundRecord[];
  stoppingReason?: string;
  isExhausted: boolean;
  isSatisfied: boolean;
}

export interface CorrectionLoopResult {
  isSatisfied: boolean;
  finalVerifiedCount: number;
  requestedCount: number;
  totalRounds: number;
  totalActions: number;
  totalDurationMs: number;
  stoppingReason: string;
  correctionHistory: CorrectionRoundRecord[];
  allVerificationResults: CompositeVerificationResult[];
}
