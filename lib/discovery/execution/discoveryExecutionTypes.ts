/**
 * §CANONICAL DISCOVERY EXECUTION TYPES (TASK-041)
 * 
 * Defines authoritative contracts for production multi-source discovery execution,
 * isolated browser workers, concurrency control semaphores, and error mapping.
 */

import { type SearchIntent, type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { type DiscoveryPlan } from "@/lib/scraper/discoveryPlanner";
import { type RankedOpportunity } from "@/lib/scraper/ranker";
import { type DeduplicatedOpportunity } from "@/lib/scraper/deduplicator";

export type ExecutionStatus =
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "NO_RESULTS"
  | "AUTH_REQUIRED"
  | "SESSION_EXPIRED"
  | "CAPTCHA_REQUIRED"
  | "SOURCE_BLOCKED"
  | "RATE_LIMITED"
  | "TEMPORARY_FAILURE"
  | "SYSTEM_FAILURE";

export type ExecutionMode = "ONE_TIME" | "SWARM" | "WATCH";

export interface SourceExecutionTelemetry {
  sourceName: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED_FRESH" | "DEGRADED";
  candidatesHarvested: number;
  durationMs: number;
  errorCategory?: string;
  userFacingMessage?: string;
  isAuthenticated?: boolean;
}

export interface DiscoveryExecutionOptions {
  forceScan?: boolean;
  freshnessWindowHours?: number;
  maxResultsPerSource?: number;
  concurrencyLimit?: number;
  perSourceTimeoutMs?: number;
  totalTimeoutMs?: number;
  customFetch?: typeof fetch;
  signal?: AbortSignal;
}

export interface DiscoveryExecutionRequest {
  userId?: string;
  rawQuery?: string;
  intent?: SearchIntent;
  plan?: DiscoveryPlan;
  executionMode: ExecutionMode;
  options?: DiscoveryExecutionOptions;
}

export interface DiscoveryExecutionResult {
  runId: string;
  userId?: string;
  status: ExecutionStatus;
  rawCandidates: RawJobCandidate[];
  deduplicatedOpportunities: DeduplicatedOpportunity[];
  rankedOpportunities: RankedOpportunity[];
  totalOpportunitiesCount: number;
  sourceTelemetry: SourceExecutionTelemetry[];
  userFacingMessage?: string;
  durationMs: number;
  usageRecorded: boolean;
  freshnessFilterApplied: boolean;
}

export interface ConcurrencyControlConfig {
  maxConcurrentContexts: number;
  perSourceConcurrency: number;
  perUserConcurrency: number;
  globalTimeoutMs: number;
}
