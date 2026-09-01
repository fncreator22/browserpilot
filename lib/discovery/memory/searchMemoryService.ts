/**
 * §SEARCH MEMORY & PLATFORM INTELLIGENCE SERVICE (TASK-042)
 * 
 * Aggregates anonymized, cross-tenant search memory:
 * - Company -> Career URLs -> ATS Providers -> Source channels
 * - Category / Role -> High-yielding sources
 * - Source freshness tracking and discovery frequencies
 * Helps BrowserPilot answer "Where should we search first?" without redundant crawling.
 */

import { prisma } from "@/lib/db/prisma";
import { getCompanyIntelligence } from "@/lib/discovery/company/companyIntelligence";
import { sourceRegistry } from "@/lib/discovery/sources/sourceRegistry";
import { discoveryIntelligenceStore } from "@/lib/discovery/intelligence/discoveryIntelligenceStore";

export interface SearchMemoryRecommendation {
  companyName?: string;
  recommendedSources: Array<{
    sourceName: string;
    affinityScore: number;
    reason: string;
    isFresh: boolean;
    lastCrawlAt?: Date | null;
  }>;
  knownAtsProvider?: string | null;
  careerPortalUrl?: string | null;
}

export class SearchMemoryService {
  /**
   * Retrieves aggregated search memory recommendations for a company and/or role category.
   */
  public async getSearchRecommendations(input: {
    companyName?: string;
    roleCategory?: string;
    freshnessWindowHours?: number;
  }): Promise<SearchMemoryRecommendation> {
    const freshnessHours = input.freshnessWindowHours || 48;
    const cutoff = new Date(Date.now() - freshnessHours * 3600 * 1000);
    const recommendations: SearchMemoryRecommendation["recommendedSources"] = [];

    let knownAtsProvider: string | null = null;
    let careerPortalUrl: string | null = null;

    // 1. Company-Specific Search Memory
    if (input.companyName) {
      const compInfo = await getCompanyIntelligence(input.companyName);
      if (compInfo) {
        knownAtsProvider = compInfo.atsProvider || null;
        careerPortalUrl = compInfo.officialCareerUrl || null;

        // Check each known source in company graph
        for (const srcName of compInfo.knownSources) {
          const freshnessIso = compInfo.sourceFreshness[srcName.toLowerCase()];
          const lastCrawl = freshnessIso ? new Date(freshnessIso) : compInfo.lastCrawlAt;
          const isFresh = lastCrawl ? lastCrawl > cutoff : false;

          const affinity = await discoveryIntelligenceStore.getCompanySourceAffinity(
            input.companyName,
            srcName
          );

          recommendations.push({
            sourceName: srcName,
            affinityScore: Math.round(affinity * 100) / 100,
            reason: `Historical employer relationship (${compInfo.atsProvider || "Verified Source"})`,
            isFresh,
            lastCrawlAt: lastCrawl || null,
          });
        }
      }
    }

    // 2. Global High-Reliability Fallback Sources
    const allSources = sourceRegistry.getAllSources();
    for (const src of allSources) {
      if (recommendations.some((r) => r.sourceName.toLowerCase() === src.name.toLowerCase())) {
        continue;
      }

      const isFresh = src.lastSuccessfulCrawlAt ? src.lastSuccessfulCrawlAt > cutoff : false;
      const baseAffinity = src.reliabilityScore * 0.7;

      recommendations.push({
        sourceName: src.name,
        affinityScore: Math.round(baseAffinity * 100) / 100,
        reason: "General high-reliability source coverage",
        isFresh,
        lastCrawlAt: src.lastSuccessfulCrawlAt || null,
      });
    }

    // Sort by affinity descending
    recommendations.sort((a, b) => b.affinityScore - a.affinityScore);

    return {
      companyName: input.companyName,
      recommendedSources: recommendations,
      knownAtsProvider,
      careerPortalUrl,
    };
  }

  /**
   * Retrieves aggregated opportunity volume counts by source for admin and discovery memory.
   */
  public async getSourceYieldSummary(): Promise<Record<string, { totalListings: number; verifiedCount: number }>> {
    const listings = await prisma.sourceListing.groupBy({
      by: ["sourcePlatform", "verificationStatus"],
      _count: { id: true },
    });

    const summary: Record<string, { totalListings: number; verifiedCount: number }> = {};

    for (const item of listings) {
      const src = item.sourcePlatform;
      if (!summary[src]) {
        summary[src] = { totalListings: 0, verifiedCount: 0 };
      }
      summary[src].totalListings += item._count.id;
      if (item.verificationStatus === "VERIFIED") {
        summary[src].verifiedCount += item._count.id;
      }
    }

    return summary;
  }
}

export const searchMemoryService = new SearchMemoryService();
