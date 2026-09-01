/**
 * §DISCOVERY INTELLIGENCE & SOURCE LEARNING TYPES (TASK-040)
 * 
 * Canonical data structures for tracking anonymous discovery signals,
 * source quality profiling, company graph relationships, and learning telemetry.
 */

export type DiscoverySignalType =
  | "DISCOVERY_SUCCESS"
  | "CRAWL_FAILED"
  | "STALE_RESULT"
  | "OPPORTUNITY_SAVED"
  | "APPLICATION_STARTED"
  | "RATE_LIMITED"
  | "CAPTCHA_DETECTED";

export interface LearningSignalRecord {
  id: string;
  sourceName: string;
  companyName?: string | null;
  signalType: DiscoverySignalType;
  scoreDelta: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface SourceQualityProfile {
  sourceName: string;
  reliabilityTrend: number; // 0.0 to 1.0 (exponential moving average)
  qualityScore: number;     // 0.0 to 100.0 (overall learned quality)
  successRate: number;      // 0.0 to 1.0
  totalSignalsCount: number;
  recentFailureCount: number;
  recentSuccessCount: number;
  lastSuccessAt?: Date | null;
  statusRecommendation: "HEALTHY" | "DEGRADED" | "BLOCKED";
}

export interface CompanyGraphNode {
  companyName: string;
  normalizedName: string;
  officialCareerUrl?: string | null;
  atsProvider?: string | null;
  atsUrl?: string | null;
  externalSources: string[];
  sourceFreshness: Record<string, string>;
  lastVerifiedAt?: Date | null;
}

export interface DiscoveryLearningTelemetrySummary {
  totalSignalsRecorded: number;
  signalsByType: Record<string, number>;
  topPerformingSources: Array<{
    source: string;
    reliability: number;
    qualityScore: number;
  }>;
  totalCompaniesInGraph: number;
}
