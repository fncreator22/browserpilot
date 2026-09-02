/**
 * §CANONICAL SEARCH CAPABILITY TYPES & CONTRACTS (TASK-050)
 * 
 * Defines the capability interfaces, schema contracts, execution constraints,
 * and security boundaries for all intelligent search tools.
 */

import { z } from "zod";

export const SearchCapabilityIdSchema = z.enum([
  // 1. Search Pipeline Capabilities
  "discovery.search_pipeline",
  "source.search",
  "browser.search",

  // 2. Company Discovery Capabilities
  "company.lookup",
  "company.careers",
  "company.ats",

  // 3. Browser Capabilities
  "browser.authenticated_search",
  "browser.navigate",
  "browser.extract",

  // 4. Evidence Verification Capabilities
  "evidence.verify_url",
  "evidence.verify_metadata",

  // 5. Context Capabilities
  "memory.retrieve",
  "intelligence.lookup",
  "source.reliability",
]);

export type SearchCapabilityId = z.infer<typeof SearchCapabilityIdSchema>;

export type SearchCapabilityCategory =
  | "SEARCH"
  | "COMPANY_DISCOVERY"
  | "BROWSER"
  | "EVIDENCE"
  | "CONTEXT";

export type CapabilityEvidenceLevel =
  | "DIRECT_JOB"        // Verified direct job posting URL
  | "COMPANY_PORTAL"     // Official company career/ATS portal
  | "METADATA_SIGNAL";   // Planning signal or non-authoritative hint

export type CapabilityRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type CapabilityAvailabilityStatus =
  | "AVAILABLE"
  | "DEGRADED"
  | "REQUIRES_AUTH"
  | "DISABLED";

export interface SearchCapabilityDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  capabilityId: SearchCapabilityId;
  name: string;
  description: string;
  category: SearchCapabilityCategory;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  requiresAuth: boolean;
  evidenceLevel: CapabilityEvidenceLevel;
  riskLevel: CapabilityRiskLevel;
  timeoutMs: number;
  availabilityStatus: CapabilityAvailabilityStatus;
}

export interface CapabilityExecutionContext {
  userId?: string | null;
  planId: string;
  actionId: string;
  timeoutMs?: number;
  signal?: AbortSignal;
  customProviders?: any[];
}

export interface CapabilityExecutionResult<TData = unknown> {
  actionId: string;
  capabilityId: SearchCapabilityId;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED" | "TIMEOUT";
  durationMs: number;
  data?: TData;
  candidateCount?: number;
  evidenceCount?: number;
  error?: string;
  failureCategory?: string;
  userFacingMessage?: string;
}
