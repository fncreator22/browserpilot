/**
 * §SOURCE & DISCOVERY INTELLIGENCE TYPES (TASK-038)
 * 
 * Canonical data structures, health states, and error categorization
 * for multi-source adaptive crawling across aggregators, ATS portals, and communities.
 */

export type SourceType =
  | "AGGREGATOR"
  | "ATS_PORTAL"
  | "COMPANY_CAREERS"
  | "TECH_COMMUNITY"
  | "PUBLIC_BOARD"
  | "USER_CONNECTED";

export type SourceStatus = "HEALTHY" | "DEGRADED" | "BLOCKED" | "MAINTENANCE";

export type SourceErrorCategory =
  | "USER_ACTION_REQUIRED"
  | "RETRYABLE"
  | "TEMPORARY"
  | "PERMANENT"
  | "SECURITY_BLOCKED"
  | "SOURCE_BLOCKED"
  | "SYSTEM_FAILURE";

export interface SourceDefinition {
  id?: string;
  name: string;
  type: SourceType;
  baseUrl: string;
  supportedCategories: string[];
  supportedLocations: string[];
  reliabilityScore: number;
  lastSuccessfulCrawlAt?: Date | null;
  lastFailedCrawlAt?: Date | null;
  totalCrawls: number;
  successfulCrawls: number;
  failedCrawls: number;
  status: SourceStatus;
  isPublic: boolean;
  requiresAuth: boolean;
}

export interface CrawlExecutionResult {
  sourceName: string;
  status: "SUCCESS" | "PARTIAL" | "FAILED" | "SKIPPED";
  candidatesFound: number;
  durationMs: number;
  errorCategory?: SourceErrorCategory;
  errorMessage?: string;
  userFacingMessage?: string;
}

export interface SourceHealthUpdate {
  sourceName: string;
  success: boolean;
  errorCategory?: SourceErrorCategory;
  errorMessage?: string;
  durationMs: number;
  candidatesCount: number;
}
