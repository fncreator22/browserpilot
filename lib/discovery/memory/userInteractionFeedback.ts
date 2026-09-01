/**
 * §USER INTERACTION FEEDBACK & PERSONAL LEARNING (TASK-042)
 * 
 * Ingests explicit and implicit user actions (viewed, saved, applied, dismissed, reported invalid)
 * and translates them into bounded platform learning signals and personalized ranking boosts.
 */

import { prisma } from "@/lib/db/prisma";
import { discoveryIntelligenceStore } from "@/lib/discovery/intelligence/discoveryIntelligenceStore";
import { type DiscoverySignalType } from "@/lib/discovery/intelligence/discoveryIntelligenceTypes";

export type UserActionType =
  | "VIEWED"
  | "SAVED"
  | "APPLICATION_STARTED"
  | "DISMISSED"
  | "IGNORED"
  | "INVALID_REPORTED";

export class UserInteractionFeedbackService {
  /**
   * Records a user interaction event, maintaining tenant isolation while contributing
   * bounded anonymous signals to platform discovery intelligence.
   */
  public async recordUserInteraction(input: {
    userId: string;
    opportunityId: string;
    actionType: UserActionType;
    sourcePlatform?: string;
  }): Promise<{ signalRecorded: boolean; feedbackScoreDelta: number }> {
    const opp = await prisma.opportunity.findUnique({
      where: { id: input.opportunityId },
      include: { sourceListings: true },
    });

    if (!opp) {
      return { signalRecorded: false, feedbackScoreDelta: 0 };
    }

    const primarySource = input.sourcePlatform || opp.sourceListings[0]?.sourcePlatform || "Unknown";

    let signalType: DiscoverySignalType | null = null;
    let feedbackDelta = 0;

    switch (input.actionType) {
      case "SAVED":
        signalType = "OPPORTUNITY_SAVED";
        feedbackDelta = 2.0;
        break;
      case "APPLICATION_STARTED":
        signalType = "APPLICATION_STARTED";
        feedbackDelta = 3.0;
        break;
      case "VIEWED":
        signalType = "DISCOVERY_SUCCESS";
        feedbackDelta = 0.5;
        break;
      case "INVALID_REPORTED":
        signalType = "STALE_RESULT";
        feedbackDelta = -2.5;
        break;
      case "DISMISSED":
      case "IGNORED":
        feedbackDelta = -0.5;
        break;
    }

    if (signalType) {
      await discoveryIntelligenceStore.recordDiscoverySignal({
        sourceName: primarySource,
        companyName: opp.companyName,
        signalType,
        metadata: {
          action: input.actionType,
          opportunityHash: opp.canonicalHash,
        },
      }).catch(() => null);
    }

    return {
      signalRecorded: !!signalType,
      feedbackScoreDelta: feedbackDelta,
    };
  }

  /**
   * Computes personalized bounded relevance adjustment for a user based on saved history and preferences.
   * Bounds result strictly to [-10, +10] pts to avoid skewing the 100-pt formula.
   */
  public async getPersonalizedRankingAdjustment(
    userId: string | null,
    companyName: string,
    roleTitle: string
  ): Promise<number> {
    if (!userId) return 0;

    const savedCount = await prisma.savedOpportunity.count({
      where: {
        userId,
        opportunity: {
          companyName: {
            equals: companyName,
          },
        },
      },
    });

    // Up to +6 pts for previously favorited companies
    const companyBoost = Math.min(6, savedCount * 2);

    return Math.max(-10, Math.min(10, companyBoost));
  }
}

export const userInteractionFeedbackService = new UserInteractionFeedbackService();
