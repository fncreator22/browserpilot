/**
 * §DIRECT ATS SEARCH PROVIDER (TASK-038)
 * 
 * Directly queries ATS career endpoints (Ashby, Greenhouse, Lever)
 * to uncover unlisted and first-party employer openings.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
} from "./baseProvider";
export class AtsProvider implements SearchProvider {
  public readonly name = "ATS Direct";

  public supports(intent: SearchIntent): boolean {
    const hasCompany = !!((intent.companies && intent.companies.length > 0) || intent.company);
    if (hasCompany) return true;
    const r = (intent.role || intent.roles?.[0] || "").toLowerCase();
    if (!r) return false;
    const isNonTech = /\b(mechanical|civil|chemical|nurse|doctor|medical|accountant|accounting|finance|sales|hr|human resources)\b/i.test(r);
    return !isNonTech;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    // TASK-064: Synthetic data purge.
    // AtsProvider must NEVER fabricate synthetic candidates (e.g., mock Stripe, Linear, Vercel openings).
    // In the absence of an active, direct live ATS API client, return an empty array.
    return [];
  }
}

export const atsProvider = new AtsProvider();
