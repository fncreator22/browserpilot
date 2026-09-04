/**
 * §GLOBAL VERIFICATION SANDBOX TYPES (TASK-063)
 * 
 * Typed contracts for the Global Verification, Policy & Execution Gate.
 * Enforces pre-execution plan integrity, hard constraint preservation,
 * URL liveness truth gates, and aggregate tenant-safe observability.
 */

import { type SearchActionPlan, type PlanConstraints } from "@/lib/ai/searchPlanner/searchActionPlan";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

export type SandboxDecisionType = "ALLOW_EXECUTION" | "REQUIRES_CORRECTION" | "REJECT";

export interface SandboxCheckResult {
  checkName: string;
  passed: boolean;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
}

export interface StructuredCorrection {
  reason: string;
  invalidElements: string[];
  requiredAdjustments: string[];
  preservedConstraints: PlanConstraints;
}

export interface VerificationRequest {
  requestId: string;
  userIdHash: string; // SHA-256 hashed or tenant-safe ID (never raw sensitive user PII in global state)
  correlationId: string;
  originalQuery: string;
  canonicalIntent: SearchIntent;
  proposedPlan: SearchActionPlan;
  requestedCapabilities: string[];
  requestedSources: string[];
  constraints: PlanConstraints;
  expectedEvidence: string[];
  securityChecks: string[];
  createdAt: Date;
}

export interface VerificationDecision {
  requestId: string;
  decision: SandboxDecisionType;
  checks: SandboxCheckResult[];
  failures: string[];
  warnings: string[];
  validatedCapabilities: string[];
  validatedSources: string[];
  validatedConstraints: PlanConstraints;
  structuredCorrection?: StructuredCorrection;
  reason: string;
  createdAt: Date;
}

export type LivelinessClassification =
  | "LIVE_OPEN_JOB"
  | "LIVE_CLOSED_JOB"
  | "DEAD_NOT_FOUND"
  | "UNREACHABLE"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "BLOCKED"
  | "CAPTCHA_DETECTED"
  | "GENERIC_PORTAL"
  | "SEARCH_RESULTS_PAGE"
  | "APPLICATION_PORTAL"
  | "AMBIGUOUS";

export interface UrlLivelinessResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  classification: LivelinessClassification;
  isVerified: boolean;
  redirectCount: number;
  closureSignalDetected: boolean;
  closureReason?: string;
  captchaDetected: boolean;
  latencyMs: number;
  extractedEvidence?: {
    title?: string;
    company?: string;
    location?: string;
    isSpecificJob: boolean;
  };
}

export interface SandboxTelemetrySummary {
  totalRequests: number;
  allowCount: number;
  correctionCount: number;
  rejectCount: number;
  urlFailures: number;
  deadUrlsCount: number;
  closedJobsCount: number;
  genericPortalsCount: number;
  blockedSourcesCount: number;
  authRequiredCount: number;
  captchaEventsCount: number;
  discoverySuccessCount: number;
  discoveryFailureCount: number;
  avgLatencyMs: number;
  lastUpdated: Date;
}
