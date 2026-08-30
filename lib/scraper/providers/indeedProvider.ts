/**
 * §INDEED PUBLIC JOB SEARCH PROVIDER
 * Harvests candidates from publicly accessible Indeed search listings.
 * Enforces strict SSRF validation and graceful failure on access limits. No bypasses.
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

export class IndeedProvider implements SearchProvider {
  public readonly name = "Indeed";

  public supports(intent: SearchIntent): boolean {
    if (intent.companyType === "STARTUP" && !intent.role) {
      return false; // Let YC handle pure stealth startup queries
    }
    return true;
  }

  public buildSearchUrl(intent: SearchIntent): string {
    const queryParts: string[] = [];
    if (intent.companies && intent.companies.length > 0) {
      queryParts.push(intent.companies.join(" "));
    } else if (intent.company) {
      queryParts.push(intent.company);
    }
    if (intent.role) queryParts.push(intent.role);
    if (intent.experienceLevel === "INTERN" || intent.opportunityType === "INTERNSHIP") {
      queryParts.push("Internship");
    }
    if (intent.skills && intent.skills.length > 0) {
      queryParts.push(intent.skills[0]);
    }

    const q = queryParts.join(" ").trim() || "Software Engineer Intern";
    const l = intent.location || (intent.workMode === "REMOTE" ? "Remote" : "");

    const params = new URLSearchParams({ q });
    if (l) params.set("l", l);
    if (intent.workMode === "REMOTE") {
      params.set("sc", "0kf:attr(DS3AG);"); // Indeed Remote filter attribute
    }

    return `https://www.indeed.com/jobs?${params.toString()}`;
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
      return []; // Return empty list gracefully on rate limit or non-200 status
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const candidates: RawJobCandidate[] = [];

    $(".job_seen_beacon, .jobsearch-ResultsList > li, div.cardOutline").each((_, el) => {
      if (candidates.length >= limits.maxCandidates) return false;

      const $el = $(el);
      const title = $el.find("h2.jobTitle, a.jcs-JobTitle, span[id^='jobTitle']").first().text().trim();
      const company = $el.find("[data-testid='company-name'], .companyName, span.companyName").first().text().trim();
      const location = $el.find("[data-testid='text-location'], .companyLocation").first().text().trim();
      const salary = $el.find(".salary-snippet-container, .metadataContainer").first().text().trim();
      const rawHref = $el.find("a.jcs-JobTitle, a[data-jk], a[id^='job_']").first().attr("href");
      const jobKey = $el.find("a[data-jk]").first().attr("data-jk") || $el.attr("data-jk");

      if (title && company) {
        let fullUrl = rawHref ? (rawHref.startsWith("/") ? `https://www.indeed.com${rawHref}` : rawHref) : "";
        if (!fullUrl && jobKey) {
          fullUrl = `https://www.indeed.com/viewjob?jk=${jobKey}`;
        }

        if (fullUrl) {
          candidates.push({
            sourcePlatform: this.name,
            sourceUrl: fullUrl.split("&")[0],
            applyUrl: fullUrl.split("&")[0],
            externalJobId: jobKey || undefined,
            title: sanitizeSnippet(title, 120),
            companyName: sanitizeSnippet(company, 100),
            location: location ? sanitizeSnippet(location, 80) : undefined,
            salaryText: salary ? sanitizeSnippet(salary, 60) : undefined,
            workMode: intent.workMode || (location.toLowerCase().includes("remote") ? "REMOTE" : undefined),
            experienceLevel: intent.experienceLevel || "ENTRY_LEVEL",
            opportunityType: intent.opportunityType || "FULL_TIME",
            rawSnippet: sanitizeSnippet($el.text(), 300),
            discoveredAt: new Date(),
          });
        }
      }
    });

    return candidates;
  }
}

export const indeedProvider = new IndeedProvider();
