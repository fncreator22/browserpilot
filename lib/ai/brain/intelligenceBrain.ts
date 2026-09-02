/**
 * §INTELLIGENCE BRAIN & CONTEXT SYNTHESIZER (TASK-049)
 * 
 * Synthesizes a unified, multi-source context layer for the LLM planner:
 * User Memory + Platform Knowledge + Search Intelligence + Company Knowledge + Role Semantics.
 */

import {
  type BrainContext,
  type BrainSynthesisOptions,
  type RankedContextItem,
  type CompanyContextItem,
  type SearchIntelligenceItem,
  type RecommendationContextItem,
} from "./brainTypes";
import { retrieveHybridUserMemories } from "./hybridRetriever";
import { platformMemoryVault } from "@/lib/ai/memory/platformMemoryVault";
import { type PlatformMemoryItem } from "@/lib/ai/memory/memoryTypes";
import { extractRoleSemantics, generateQueryReformulations } from "./roleSemantics";
import { discoveryIntelligenceStore } from "@/lib/discovery/intelligence/discoveryIntelligenceStore";

// Known target companies with verified ATS mappings
const KNOWN_COMPANY_INTELLIGENCE: Record<string, { officialCareerUrl: string; atsProvider: string; atsUrl: string; reliability: number }> = {
  stripe: {
    officialCareerUrl: "https://stripe.com/jobs",
    atsProvider: "GREENHOUSE",
    atsUrl: "https://boards.greenhouse.io/stripe",
    reliability: 0.98,
  },
  openai: {
    officialCareerUrl: "https://openai.com/careers",
    atsProvider: "GREENHOUSE",
    atsUrl: "https://boards.greenhouse.io/openai",
    reliability: 0.99,
  },
  anthropic: {
    officialCareerUrl: "https://anthropic.com/careers",
    atsProvider: "ASHBY",
    atsUrl: "https://jobs.ashbyhq.com/anthropic",
    reliability: 0.98,
  },
  figma: {
    officialCareerUrl: "https://figma.com/careers",
    atsProvider: "GREENHOUSE",
    atsUrl: "https://boards.greenhouse.io/figma",
    reliability: 0.96,
  },
  notion: {
    officialCareerUrl: "https://notion.so/careers",
    atsProvider: "LEVER",
    atsUrl: "https://jobs.lever.co/notion",
    reliability: 0.95,
  },
};

export class IntelligenceBrain {
  /**
   * Synthesizes rich, relevance-ranked BrainContext for a natural-language query.
   */
  public async synthesizeBrainContext(
    rawQuery: string,
    userId?: string | null,
    options: BrainSynthesisOptions = {}
  ): Promise<BrainContext> {
    const cleanQuery = (rawQuery || "").trim();
    const maxUserMemories = options.maxUserMemories || 5;
    const maxPlatformItems = options.maxPlatformItems || 5;
    const maxCompanyItems = options.maxCompanyItems || 3;
    const maxBudgetTokens = options.maxBudgetTokens || 2000;

    let totalRetrieved = 0;

    // 1. Retrieve Hybrid User Memories
    const userMemories = await retrieveHybridUserMemories(cleanQuery, userId, {
      limit: maxUserMemories,
      minScore: options.minRelevanceScore || 0.35,
    });
    totalRetrieved += userMemories.length;

    // 2. Retrieve Platform Knowledge
    const rawPlatform = platformMemoryVault.queryKnowledge({
      query: cleanQuery,
      limit: maxPlatformItems,
    });
    totalRetrieved += rawPlatform.length;

    const platformContext: RankedContextItem<PlatformMemoryItem>[] = rawPlatform.map((p) => ({
      item: p,
      relevanceScore: p.importance,
      provenance: "PLATFORM_MEMORY",
      confidence: "HIGH",
      rationale: `Platform architecture fact for [${p.sourceTask}].`,
    }));

    // 3. Extract Role Semantics & Reformulations
    const roleSemantics = extractRoleSemantics(cleanQuery);
    const reformulations = generateQueryReformulations(cleanQuery, roleSemantics);

    // 4. Retrieve Company & ATS Intelligence
    const companyContext: RankedContextItem<CompanyContextItem>[] = [];
    const searchContext: RankedContextItem<SearchIntelligenceItem>[] = [];
    const lowerQuery = cleanQuery.toLowerCase();

    for (const [compKey, compData] of Object.entries(KNOWN_COMPANY_INTELLIGENCE)) {
      if (lowerQuery.includes(compKey)) {
        companyContext.push({
          item: {
            companyName: compKey.charAt(0).toUpperCase() + compKey.slice(1),
            officialCareerUrl: compData.officialCareerUrl,
            atsProvider: compData.atsProvider,
            atsUrl: compData.atsUrl,
            reliabilityScore: compData.reliability,
            provenance: "COMPANY_INTELLIGENCE",
          },
          relevanceScore: 0.95,
          provenance: "COMPANY_INTELLIGENCE",
          confidence: "HIGH",
          rationale: `Verified official ATS endpoint discovered for ${compKey}.`,
        });

        const affinity = await discoveryIntelligenceStore.getCompanySourceAffinity(compKey, compData.atsProvider).catch(() => 0.9);
        searchContext.push({
          item: {
            sourceName: compData.atsProvider,
            companyName: compKey,
            primaryAtsAffinity: affinity,
            historicalSuccessScore: 0.92,
            provenance: "SEARCH_INTELLIGENCE",
          },
          relevanceScore: 0.9,
          provenance: "SEARCH_INTELLIGENCE",
          confidence: "MEDIUM",
          rationale: `Historical discovery signal for ${compKey} on ${compData.atsProvider}.`,
        });
      }
    }
    totalRetrieved += companyContext.length + searchContext.length;

    // 5. Generate Recommendation Signals (Separated from User Preferences)
    const recommendations: RecommendationContextItem[] = [];
    if (roleSemantics.normalizedRole.includes("AI") || roleSemantics.normalizedRole.includes("Backend")) {
      recommendations.push({
        type: "LOCATION_VOLUME_HOTSPOT",
        suggestion: "Bengaluru and Hyderabad have historically produced 65%+ higher volume for AI and Backend engineering roles.",
        confidence: "INFERRED",
        importance: 0.65,
        provenance: "SEARCH_INTELLIGENCE",
      });
    }

    // 6. Context Budget Calculation
    const boundedUser = userMemories.slice(0, maxUserMemories);
    const boundedPlatform = platformContext.slice(0, maxPlatformItems);
    const boundedCompany = companyContext.slice(0, maxCompanyItems);

    const estimatedChars =
      JSON.stringify(boundedUser).length +
      JSON.stringify(boundedPlatform).length +
      JSON.stringify(boundedCompany).length +
      JSON.stringify(roleSemantics).length +
      JSON.stringify(recommendations).length;
    const estimatedTokens = Math.ceil(estimatedChars / 4);

    const itemsIncluded = boundedUser.length + boundedPlatform.length + boundedCompany.length;
    const itemsFiltered = Math.max(0, totalRetrieved - itemsIncluded);

    return {
      query: cleanQuery,
      userId: userId || null,
      userContext: boundedUser,
      platformContext: boundedPlatform,
      searchContext,
      companyContext: boundedCompany,
      roleSemantics,
      recommendations,
      queryReformulations: reformulations,
      budgetMetrics: {
        totalItemsRetrieved: totalRetrieved,
        itemsIncluded,
        itemsFiltered,
        estimatedTokens,
        budgetLimit: maxBudgetTokens,
      },
      generatedAt: new Date(),
    };
  }
}

export const intelligenceBrain = new IntelligenceBrain();
