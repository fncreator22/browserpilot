/**
 * §OPPORTUNITY LIFECYCLE TYPES & STATE DEFINITIONS (TASK-042)
 * 
 * Canonical state definitions, change event payloads, and transition models
 * governing the opportunity lifecycle across all multi-source discovery channels.
 */

export type OpportunityLifecycleStatus =
  | "DISCOVERED"
  | "VERIFIED"
  | "ACTIVE"
  | "UPDATED"
  | "STALE"
  | "EXPIRED"
  | "REMOVED";

export type OpportunityChangeType =
  | "TITLE_CHANGED"
  | "COMPANY_CHANGED"
  | "LOCATION_CHANGED"
  | "WORK_MODE_CHANGED"
  | "COMPENSATION_CHANGED"
  | "DESCRIPTION_UPDATED"
  | "APPLY_URL_CHANGED"
  | "NEW_SOURCE_LISTING"
  | "STATUS_CHANGED";

export interface OpportunityChangeEvent {
  opportunityId: string;
  canonicalHash: string;
  changeType: OpportunityChangeType;
  fieldName: string;
  previousValue: unknown;
  newValue: unknown;
  detectedAt: Date;
  sourcePlatform?: string;
}

export interface OpportunityLifecycleRecord {
  id: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  experienceLevel: string;
  opportunityType: string;
  status: OpportunityLifecycleStatus;
  primaryApplyUrl: string;
  firstSeenAt: Date;
  lastVerifiedAt: Date;
  nextEligibleRefreshAt: Date;
  sourceCount: number;
  sources: string[];
  isFresh: boolean;
}

export interface LifecycleTransitionResult {
  previousStatus: OpportunityLifecycleStatus;
  currentStatus: OpportunityLifecycleStatus;
  isStatusChanged: boolean;
  changesDetected: OpportunityChangeEvent[];
  opportunity: OpportunityLifecycleRecord;
}
