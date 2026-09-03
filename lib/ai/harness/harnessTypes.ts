/**
 * §CANONICAL INTELLIGENCE HARNESS TYPES (TASK-048)
 * 
 * Defines the structured execution lifecycle, harness context, observation,
 * verification, decision, and telemetry contracts.
 */

import { type SearchIntent, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { type ActionPlan, type IntentClassification } from "@/schemas/jobs";
import { type PlanValidationResult } from "@/lib/verification/planValidator";
import { type CapabilityGuardResult } from "@/lib/capabilities/guard";
import { type UserMemoryItem, type PlatformMemoryItem } from "@/lib/ai/memory/memoryTypes";
import { type RankedOpportunity } from "@/lib/scraper/ranker";
import { type QualityGateEvaluation } from "@/lib/scraper/searchQualityGate";
import { type BrainContext } from "@/lib/ai/brain/brainTypes";
import { type SearchActionPlan } from "@/lib/ai/searchPlanner/searchActionPlan";
import { type CompositeVerificationResult } from "@/lib/ai/evidence/evidenceTypes";
import { type CorrectionLoopResult } from "./correction/correctionTypes";

export type HarnessLifecycleStage =
  | "QUERY"
  | "INTENT"
  | "CONTEXT"
  | "PLAN"
  | "VALIDATE_PLAN"
  | "EXECUTE"
  | "OBSERVE"
  | "VERIFY"
  | "DECIDE"
  | "COMPLETE"
  | "FAILED";

export type HarnessDecisionOutcome =
  | "COMPLETE"
  | "PARTIAL"
  | "CONTINUE"
  | "REJECT"
  | "NEEDS_MORE_EVIDENCE";

export interface HarnessExplicitConstraints {
  roles?: string[];
  locations?: string[];
  workModes?: string[];
  freshnessWindowHours?: number;
  postedWithinDays?: number;
  requestedCount?: number;
  isExplicitFreshness?: boolean;
  targetCompanies?: string[];
}

export interface HarnessToolExecutionResult {
  toolName: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "TIMEOUT" | "BLOCKED";
  durationMs: number;
  inputPayload: Record<string, unknown>;
  outputSummary?: string;
  candidatesHarvested?: number;
  rawCandidates?: RawJobCandidate[];
  error?: string;
  userFacingMessage?: string;
}

export interface HarnessObservation {
  stepIndex: number;
  toolName: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  summary: string;
  candidateCount: number;
  evidencePaths?: string[];
  rawCandidates?: RawJobCandidate[];
  durationMs: number;
  timestamp: Date;
}

export interface HarnessVerificationResult {
  status: "VERIFIED" | "PARTIALLY_VERIFIED" | "FAILED" | "REJECTED";
  candidatesEvaluated: number;
  candidatesAccepted: number;
  candidatesRejected: number;
  qualityGateEvaluations: QualityGateEvaluation[];
  verifiedOpportunities: RankedOpportunity[];
  rejectionReasons: string[];
}

export interface HarnessDecision {
  outcome: HarnessDecisionOutcome;
  rationale: string;
  verifiedCount: number;
  requestedCount: number;
  canContinue: boolean;
  userExplanation: string;
}

export interface HarnessTelemetry {
  harnessId: string;
  userIdHash?: string;
  currentStage: HarnessLifecycleStage;
  totalDurationMs: number;
  stageTimings: Partial<Record<HarnessLifecycleStage, number>>;
  toolsExecuted: string[];
  memoriesRetrievedCount: number;
  platformKnowledgeCount: number;
  observationsCount: number;
  verifiedCount: number;
  status: "SUCCESS" | "FAILED" | "PARTIAL";
  errorCategory?: string;
}

export interface HarnessContext {
  harnessId: string;
  userId: string | null;
  rawQuery: string;
  currentStage: HarnessLifecycleStage;
  
  // Intent & Explicit Constraints
  searchIntent?: SearchIntent;
  intentClassification?: IntentClassification;
  explicitConstraints: HarnessExplicitConstraints;
  
  // Memory & Knowledge Context
  userMemories: UserMemoryItem[];
  platformKnowledge: PlatformMemoryItem[];
  searchIntelligence?: Record<string, unknown>;
  brainContext?: BrainContext;
  
  // Capabilities & Guard
  availableCapabilities: string[];
  capabilityGuard?: CapabilityGuardResult;
  
  // Plan & Validation
  plan?: ActionPlan;
  planValidation?: PlanValidationResult;
  searchActionPlan?: SearchActionPlan;
  
  // Execution & Observations
  toolExecutions: HarnessToolExecutionResult[];
  observations: HarnessObservation[];
  
  // Verification & Decision
  verification?: HarnessVerificationResult;
  compositeVerificationResults?: CompositeVerificationResult[];
  correctionLoopResult?: CorrectionLoopResult;
  decision?: HarnessDecision;
  
  // Telemetry
  telemetry: HarnessTelemetry;
}

export interface HarnessExecutionOptions {
  userId?: string | null;
  explicitFilters?: Partial<SearchIntent>;
  maxResultsBudget?: number;
  verifyEvidence?: boolean;
  dryRunPlanOnly?: boolean;
  customProviders?: any[];
  apiKey?: string;
}

export interface HarnessResult {
  harnessId: string;
  success: boolean;
  decision: HarnessDecision;
  rankedOpportunities: RankedOpportunity[];
  context: HarnessContext;
  telemetry: HarnessTelemetry;
}
