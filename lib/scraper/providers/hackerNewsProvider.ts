/**
 * §HACKER NEWS "WHO IS HIRING" TECH COMMUNITY PROVIDER (TASK-038)
 * 
 * Discovers startup and founder-direct hiring threads on Hacker News.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
} from "./baseProvider";

export class HackerNewsProvider implements SearchProvider {
  public readonly name = "Hacker News";

  public supports(intent: SearchIntent): boolean {
    return true;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    // TASK-064: Synthetic data purge.
    // HackerNewsProvider must NEVER fabricate synthetic candidates (e.g. sampleStartups, who-is-hiring mock posts).
    // In the absence of an active live Hacker News thread scraper, return an empty array.
    return [];
  }
}

export const hackerNewsProvider = new HackerNewsProvider();
