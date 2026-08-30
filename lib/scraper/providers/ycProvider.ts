/**
 * §Y COMBINATOR WORKATASTARTUP PROVIDER
 * Harvests early-stage startup opportunities and founding internships
 * from publicly accessible Y Combinator directory pages.
 */

import * as cheerio from "cheerio";
import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
  isSafePublicUrl,
  sanitizeSnippet,
} from "./baseProvider";

export class YCProvider implements SearchProvider {
  public readonly name = "Y Combinator";

  public supports(intent: SearchIntent): boolean {
    if (intent.companyType === "ENTERPRISE") return false; // YC is startup-only
    return true; // Supports startups, early-career, AI/ML, full-stack, and internship queries
  }

  public buildSearchUrl(intent: SearchIntent): string {
    const queryTerms: string[] = [];
    if (intent.role) queryTerms.push(intent.role);
    if (intent.skills && intent.skills.length > 0) {
      queryTerms.push(intent.skills[0]);
    }
    const query = queryTerms.join(" ").trim() || "Software Engineer";
    return `https://www.workatastartup.com/companies?query=${encodeURIComponent(query)}`;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    const fetcher = context?.customFetch || fetch;
    const searchUrl = this.buildSearchUrl(intent);

    if (!isSafePublicUrl(searchUrl)) {
      return [];
    }

    const response = await fetcher(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: context?.signal || AbortSignal.timeout(limits.timeoutMs),
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const candidates: RawJobCandidate[] = [];

    // Parse YC company cards and job rows
    $(".company-card, .job-card, div[data-company-name], .w-full").each((_, el) => {
      if (candidates.length >= limits.maxCandidates) return false;

      const $el = $(el);
      const companyName =
        $el.find(".company-name, .font-bold, h3, a[href*='/companies/']").first().text().trim() ||
        $el.attr("data-company-name");
      const title =
        $el.find(".job-name, .job-title, h4, .text-lg").first().text().trim() ||
        (intent.role ? `${intent.role} at ${companyName}` : undefined);
      const location = $el.find(".company-location, .location, .text-sm").first().text().trim();
      const rawHref = $el.find("a[href*='/companies/'], a[href*='/jobs/'], a").first().attr("href");

      if (companyName && title && rawHref) {
        let cleanUrl = rawHref.trim();
        if (cleanUrl.startsWith("/")) {
          cleanUrl = `https://www.workatastartup.com${cleanUrl}`;
        }

        const externalJobId = cleanUrl.split("/").filter(Boolean).pop();

        candidates.push({
          sourcePlatform: this.name,
          sourceUrl: cleanUrl,
          applyUrl: cleanUrl,
          externalJobId,
          title: sanitizeSnippet(title, 120),
          companyName: sanitizeSnippet(companyName, 100),
          location: location ? sanitizeSnippet(location, 80) : "Remote / Various",
          workMode: intent.workMode || (location.toLowerCase().includes("remote") ? "REMOTE" : "ANY"),
          experienceLevel: intent.experienceLevel || "ENTRY_LEVEL",
          opportunityType: intent.opportunityType || "FULL_TIME",
          rawSnippet: sanitizeSnippet($el.text(), 300),
          discoveredAt: new Date(),
        });
      }
    });

    return candidates;
  }
}

export const ycProvider = new YCProvider();
