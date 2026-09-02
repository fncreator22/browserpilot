/**
 * §CANONICAL EVIDENCE CONTRACTS & EVIDENCE AUTHORITY MODEL (TASK-051)
 * 
 * Defines structured evidence types, provenance tracking, authority tiers,
 * and deterministic/semantic verification schemas.
 */

import { z } from "zod";
import { type JobUrlType } from "@/lib/scraper/normalizer";
import { type MetadataConfidence } from "@/lib/scraper/freshnessExtractor";

export type EvidenceType =
  | "JOB_TITLE"
  | "COMPANY"
  | "LOCATION"
  | "WORK_MODE"
  | "POSTED_DATE"
  | "UPDATED_DATE"
  | "JOB_DESCRIPTION"
  | "SENIORITY"
  | "COMPENSATION"
  | "APPLY_URL"
  | "ATS_PROVIDER"
  | "COMPANY_CAREER_URL";

export type EvidenceAuthority =
  | "AUTHORITATIVE" // Official company career page, verified ATS job detail, authenticated direct posting
  | "STRONG"        // Established job platform direct posting (LinkedIn, Indeed)
  | "WEAK"          // Search snippets, third-party aggregators, cached metadata
  | "UNTRUSTED";     // Generated content, model-inferred fields

export const AUTHORITY_PRECEDENCE_WEIGHTS: Record<EvidenceAuthority, number> = {
  AUTHORITATIVE: 1.0,
  STRONG: 0.75,
  WEAK: 0.4,
  UNTRUSTED: 0.1,
};

export type ExtractionMethod =
  | "ATS_API"
  | "CAREER_PAGE_DOM"
  | "STRUCTURED_LD_JSON"
  | "HTML_FALLBACK"
  | "PLATFORM_FEED"
  | "SEARCH_SNIPPET"
  | "HEURISTIC_INFERENCE";

export interface EvidenceProvenance {
  sourceUrl: string;
  sourcePlatform: string;
  timestamp: Date;
  rawSnippet?: string;
  selectorUsed?: string;
  httpStatus?: number;
}

export interface EvidenceRecord {
  evidenceId: string;
  candidateId: string;
  source: string;
  sourceType: string;
  url: string;
  evidenceType: EvidenceType;
  extractedField: string;
  value: any;
  confidence: number; // 0.0 to 1.0
  authority: EvidenceAuthority;
  capturedAt: Date;
  extractionMethod: ExtractionMethod;
  provenance: EvidenceProvenance;
  userId?: string | null;
}

export interface EvidenceFieldResolution<T = any> {
  value: T;
  authority: EvidenceAuthority;
  confidence: number;
  provenance: EvidenceProvenance;
  isVerified: boolean;
  alternativeValues?: { value: T; authority: EvidenceAuthority; source: string }[];
}

export interface EvidenceConflict {
  field: string;
  sourceA: string;
  authorityA: EvidenceAuthority;
  valueA: any;
  sourceB: string;
  authorityB: EvidenceAuthority;
  valueB: any;
  resolution: "RESOLVED_BY_AUTHORITY" | "RESOLVED_BY_RECENCY" | "UNRESOLVED_NEEDS_MORE_EVIDENCE";
  rationale: string;
}

export interface NormalizedEvidenceSet {
  candidateId: string;
  records: EvidenceRecord[];
  title?: EvidenceFieldResolution<string>;
  company?: EvidenceFieldResolution<string>;
  location?: EvidenceFieldResolution<string>;
  workMode?: EvidenceFieldResolution<"REMOTE" | "HYBRID" | "ON_SITE" | "UNSPECIFIED">;
  postedDate?: EvidenceFieldResolution<Date | null>;
  updatedDate?: EvidenceFieldResolution<Date | null>;
  applyUrl?: EvidenceFieldResolution<string>;
  description?: EvidenceFieldResolution<string>;
  seniority?: EvidenceFieldResolution<string>;
  atsProvider?: EvidenceFieldResolution<string>;
  conflicts: EvidenceConflict[];
  authoritativeCount: number;
  totalRecordsCount: number;
  hasAuthoritativeDate: boolean;
  hasDirectApplyUrl: boolean;
}

export interface DeterministicVerificationResult {
  isEligible: boolean;
  isHardBlocked: boolean;
  failedConstraints: string[];
  passedConstraints: string[];
  rejectionReasons: string[];
  dateEligible: boolean;
  urlEligible: boolean;
  urlType: JobUrlType;
  roleEligible: boolean;
  locationEligible: boolean;
  workModeEligible: boolean;
  companyEligible: boolean;
  metadataConfidence: MetadataConfidence;
  calculatedAgeHours?: number;
}

export type SemanticJudgeDecision =
  | "VERIFIED"
  | "PARTIAL"
  | "REJECTED"
  | "NEEDS_MORE_EVIDENCE";

export interface SemanticVerificationResult {
  decision: SemanticJudgeDecision;
  confidence: number; // 0.0 to 1.0
  matchedConstraints: string[];
  failedConstraints: string[];
  uncertainConstraints: string[];
  evidenceRefs: string[];
  summary: string;
  evaluatedBy: "GEMINI_MODEL" | "DETERMINISTIC_FALLBACK";
  modelName?: string;
  durationMs: number;
}

export interface VerificationDiagnostics {
  evidenceCount: number;
  authoritativeEvidenceCount: number;
  deterministicChecks: {
    passedCount: number;
    failedCount: number;
    hardBlocked: boolean;
    reasons: string[];
  };
  semanticDecision?: SemanticJudgeDecision;
  semanticConfidence?: number;
  failedConstraints: string[];
  uncertainConstraints: string[];
  verificationDurationMs: number;
  finalDecision: SemanticJudgeDecision;
}

export interface CompositeVerificationResult {
  candidateId: string;
  isEligible: boolean;
  finalDecision: SemanticJudgeDecision;
  overallConfidence: number; // 0.0 to 1.0
  normalizedEvidence: NormalizedEvidenceSet;
  deterministicResult: DeterministicVerificationResult;
  semanticResult?: SemanticVerificationResult;
  rejectionReasons: string[];
  diagnostics: VerificationDiagnostics;
}

export const SemanticVerificationResultSchema = z.object({
  decision: z.enum(["VERIFIED", "PARTIAL", "REJECTED", "NEEDS_MORE_EVIDENCE"]),
  confidence: z.number().min(0).max(1),
  matchedConstraints: z.array(z.string()),
  failedConstraints: z.array(z.string()),
  uncertainConstraints: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  summary: z.string().min(1).max(300),
});
