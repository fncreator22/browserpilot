/**
 * §SOURCE DISCOVERY & OPEN-WEB CAPABILITY TYPES (TASK-063)
 * 
 * Typed abstractions for dynamically discovered sources, access classifications,
 * query formulations, and truthful source execution status.
 */

import { type SourceType } from "@/lib/discovery/sources/sourceTypes";

export type ExtendedSourceType =
  | SourceType
  | "SPECIALIST_BOARD"
  | "GOVERNMENT_PORTAL"
  | "RECRUITMENT_AGENCY"
  | "HOSPITAL_PORTAL"
  | "EDUCATIONAL_INSTITUTION";

export type LoginAccessClassification =
  | "PUBLIC"                 // Search/details can be accessed without authentication
  | "OPTIONAL_LOGIN"        // Browsing works without login, but login enables extras (saving/alerts)
  | "REQUIRED_LOGIN"        // Cannot be accessed without credentials
  | "USER_SESSION_REQUIRED" // BrowserPilot can access only when user has connected encrypted session
  | "BLOCKED"               // Source actively blocks requests (CAPTCHA/WAF/403)
  | "UNKNOWN";              // Access status has not yet been verified

export type SourceDiscoveryMethod =
  | "SEARCH_ENGINE"
  | "DOMAIN_EXPANSION"
  | "COMPANY_TARGETING"
  | "INDUSTRY_DISCOVERY"
  | "KNOWN_REGISTRY";

export interface DiscoveredSource {
  sourceCandidate: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: ExtendedSourceType;
  discoveryMethod: SourceDiscoveryMethod;
  relevance: number;
  publicAccess: boolean;
  loginRequired: LoginAccessClassification;
  authenticationMode: string;
  robotsStatus: "ALLOWED" | "DISALLOWED" | "UNKNOWN";
  crawlability: "DIRECT_HTTP" | "BROWSER_RENDER" | "API" | "UNSUPPORTED";
  jobSearchCapability: boolean;
  detailPageCapability: boolean;
  supportsFiltering: boolean;
  supportsDateInformation: boolean;
  supportsDirectApplication: boolean;
  observedAt: Date;
  verificationStatus: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  rejectionReason?: string;
}

export type SourceExecutionOutcome =
  | "SOURCE_SUCCESS_MATCHES"
  | "SOURCE_SUCCESS_NO_MATCH"
  | "SOURCE_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "CAPTCHA_DETECTED"
  | "RATE_LIMITED"
  | "EXTRACTION_FAILURE";

export interface SourceTruthfulStatus {
  sourceName: string;
  outcome: SourceExecutionOutcome;
  candidatesFound: number;
  explanation: string;
  isFatal: boolean;
}

export interface SearchDiscoveryQuery {
  query: string;
  domainCategory: string;
  role: string;
  location: string;
  focus:
    | "DIRECT_ROLE"
    | "SYNONYM"
    | "VACANCY"
    | "FRESHER"
    | "SENIORITY"
    | "COMPANY_ATS"
    | "INDUSTRY_PORTAL";
}
