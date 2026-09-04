/**
 * §GITHUB CURATED DEVELOPER & INTERNSHIP PROVIDER (TASK-038)
 * 
 * Harvester for community-curated GitHub developer job and internship repositories.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
} from "./baseProvider";

export class GitHubJobsProvider implements SearchProvider {
  public readonly name = "GitHub Curated";

  public supports(intent: SearchIntent): boolean {
    const r = (intent.role || intent.roles?.[0] || "").toLowerCase();
    const isTech = !r || /\b(software|developer|swe|sde|coding|frontend|backend|fullstack|web|data|devops|cloud|ai|ml)\b/i.test(r);
    const isIntern = intent.experienceLevel === "INTERN" || intent.opportunityType === "INTERNSHIP";
    return isTech && isIntern;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    // TASK-064: Synthetic data purge.
    // GitHubJobsProvider must NEVER fabricate synthetic candidates (e.g. sampleRepos).
    // In the absence of an active live repository crawler, return an empty array.
    return [];
  }
}

export const githubJobsProvider = new GitHubJobsProvider();
