/**
 * §DISCOVERY INTELLIGENCE & SOURCE LEARNING STORE (TASK-040)
 * 
 * Manages anonymous platform-level learning signals, source quality profiling,
 * rolling reliability decay, and bounded feedback without storing private user data.
 */

import { prisma } from "@/lib/db/prisma";
import {
  type DiscoverySignalType,
  type LearningSignalRecord,
  type SourceQualityProfile,
} from "./discoveryIntelligenceTypes";

const SIGNAL_WEIGHTS: Record<DiscoverySignalType, number> = {
  DISCOVERY_SUCCESS: 1.0,
  OPPORTUNITY_SAVED: 2.0,
  APPLICATION_STARTED: 3.0,
  STALE_RESULT: -0.5,
  CRAWL_FAILED: -1.5,
  RATE_LIMITED: -2.0,
  CAPTCHA_DETECTED: -2.5,
};

export class DiscoveryIntelligenceStore {
  /**
   * Records an anonymized platform learning signal.
   */
  public async recordDiscoverySignal(input: {
    sourceName: string;
    companyName?: string | null;
    signalType: DiscoverySignalType;
    metadata?: Record<string, unknown>;
  }): Promise<LearningSignalRecord> {
    const scoreDelta = SIGNAL_WEIGHTS[input.signalType] ?? 0.0;
    const cleanSource = input.sourceName.trim();
    const cleanCompany = input.companyName ? input.companyName.trim() : null;

    const record = await prisma.discoveryLearningSignal.create({
      data: {
        sourceName: cleanSource,
        companyName: cleanCompany,
        signalType: input.signalType,
        scoreDelta,
        metadata: JSON.stringify(input.metadata || {}),
      },
    });

    return {
      id: record.id,
      sourceName: record.sourceName,
      companyName: record.companyName,
      signalType: record.signalType as DiscoverySignalType,
      scoreDelta: record.scoreDelta,
      metadata: JSON.parse(record.metadata || "{}"),
      createdAt: record.createdAt,
    };
  }

  /**
   * Computes the aggregated quality profile and reliability trend for a source.
   * Employs outlier clamping for poisoned-signal protection.
   */
  public async getSourceQualityProfile(sourceName: string): Promise<SourceQualityProfile> {
    const cleanSource = sourceName.trim();

    const signals = await prisma.discoveryLearningSignal.findMany({
      where: { sourceName: cleanSource },
      orderBy: { createdAt: "desc" },
      take: 100, // Lookback window
    });

    if (signals.length === 0) {
      return {
        sourceName: cleanSource,
        reliabilityTrend: 0.95,
        qualityScore: 90.0,
        successRate: 1.0,
        totalSignalsCount: 0,
        recentFailureCount: 0,
        recentSuccessCount: 0,
        statusRecommendation: "HEALTHY",
      };
    }

    let successCount = 0;
    let failureCount = 0;
    let totalScoreSum = 0;
    let lastSuccessAt: Date | null = null;

    for (const s of signals) {
      // Clamped delta for poisoned signal protection (-3.0 to +3.0 max)
      const clampedDelta = Math.max(-3.0, Math.min(3.0, s.scoreDelta));
      totalScoreSum += clampedDelta;

      if (s.signalType === "DISCOVERY_SUCCESS" || s.signalType === "OPPORTUNITY_SAVED" || s.signalType === "APPLICATION_STARTED") {
        successCount++;
        if (!lastSuccessAt || s.createdAt > lastSuccessAt) {
          lastSuccessAt = s.createdAt;
        }
      } else if (s.signalType === "CRAWL_FAILED" || s.signalType === "RATE_LIMITED" || s.signalType === "CAPTCHA_DETECTED") {
        failureCount++;
      }
    }

    const totalValid = successCount + failureCount;
    const successRate = totalValid > 0 ? successCount / totalValid : 1.0;

    // Moving reliability: base 0.5 + scaled delta
    const normalizedScore = Math.max(10, Math.min(100, 75 + (totalScoreSum / Math.max(1, signals.length)) * 15));
    const reliabilityTrend = Math.max(0.1, Math.min(1.0, successRate * 0.8 + 0.2));

    let statusRecommendation: "HEALTHY" | "DEGRADED" | "BLOCKED" = "HEALTHY";
    if (failureCount >= 5 && successRate < 0.4) {
      statusRecommendation = "BLOCKED";
    } else if (failureCount >= 3 || reliabilityTrend < 0.6) {
      statusRecommendation = "DEGRADED";
    }

    return {
      sourceName: cleanSource,
      reliabilityTrend: Math.round(reliabilityTrend * 100) / 100,
      qualityScore: Math.round(normalizedScore * 10) / 10,
      successRate: Math.round(successRate * 100) / 100,
      totalSignalsCount: signals.length,
      recentFailureCount: failureCount,
      recentSuccessCount: successCount,
      lastSuccessAt,
      statusRecommendation,
    };
  }

  /**
   * Computes the historical success affinity between a specific company and a source.
   */
  public async getCompanySourceAffinity(companyName: string, sourceName: string): Promise<number> {
    const cleanCompany = companyName.trim();
    const cleanSource = sourceName.trim();

    const signals = await prisma.discoveryLearningSignal.findMany({
      where: {
        companyName: cleanCompany,
        sourceName: cleanSource,
      },
      take: 20,
    });

    if (signals.length === 0) return 0.5; // Neutral baseline

    const successes = signals.filter(
      (s) => s.signalType === "DISCOVERY_SUCCESS" || s.signalType === "OPPORTUNITY_SAVED" || s.signalType === "APPLICATION_STARTED"
    ).length;

    return Math.round((successes / signals.length) * 100) / 100;
  }
}

export const discoveryIntelligenceStore = new DiscoveryIntelligenceStore();
