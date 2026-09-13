/**
 * §LINKEDIN PUBLIC JOB SEARCH PROVIDER
 * Harvests candidates from publicly accessible LinkedIn Guest Search listings
 * using lightweight HTTP requests and Cheerio DOM parsing. No credential automation or bypasses.
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

export class LinkedInProvider implements SearchProvider {
  public readonly name = "LinkedIn";

  public supports(intent: SearchIntent): boolean {
    if (intent.companyType === "STARTUP" && !intent.role) {
      // If user strictly requested only stealth startups without a role, let YC prioritize
      return true;
    }
    return true; // LinkedIn supports all general, tech, and student job searches
  }

  public buildSearchUrl(intent: SearchIntent): string {
    const queryParts: string[] = [];
    const companies = intent.companies || (intent as any).targetCompanies;
    if (companies && companies.length > 0) {
      queryParts.push(companies.join(" "));
    } else if (intent.company) {
      queryParts.push(intent.company);
    }
    const role = intent.role || intent.roles?.[0] || "";
    if (role) {
      queryParts.push(role);
    }
    const expLevel = intent.experienceLevel || intent.experienceLevels?.[0];
    const oppType = intent.opportunityType || intent.opportunityTypes?.[0];
    const roleLower = role.toLowerCase();
    const alreadyMentionsIntern = roleLower.includes("intern");
    if (!alreadyMentionsIntern && (expLevel === "INTERN" || oppType === "INTERNSHIP")) {
      queryParts.push("Intern");
    }
    if (intent.skills && intent.skills.length > 0) {
      queryParts.push(intent.skills.slice(0, 2).join(" "));
    }
    if (intent.targetGradYear) {
      queryParts.push(intent.targetGradYear.toString());
    }

    const keywords = queryParts.join(" ").trim() || "Software Engineer Intern";
    const rawLoc = intent.location || intent.locations?.[0] || "";
    const isExplicitLoc = intent.isExplicitLocation ?? (rawLoc.length > 0 && rawLoc.toLowerCase() !== "any" && rawLoc.toLowerCase() !== "worldwide");
    const workMode = intent.workMode || intent.workModes?.[0];
    const location = (isExplicitLoc && rawLoc && rawLoc.toLowerCase() !== "any")
      ? rawLoc
      : (workMode === "REMOTE" ? "Remote" : "Worldwide");

    const params = new URLSearchParams({
      keywords,
      location,
      sortBy: "DD", // Most recent
    });

    if (workMode === "REMOTE") {
      params.set("f_WT", "2"); // LinkedIn Remote filter
    }
    if (expLevel === "INTERN" || oppType === "INTERNSHIP") {
      params.set("f_E", "1"); // LinkedIn Internship filter
    } else if (expLevel === "ENTRY_LEVEL") {
      params.set("f_E", "2"); // Entry level
    }

    // Time Posted Range (f_TPR in seconds: r259200 for 3d, r86400 for 24h, r604800 for 7d)
    if (intent.freshnessWindowHours && intent.freshnessWindowHours > 0) {
      const sec = intent.freshnessWindowHours * 3600;
      params.set("f_TPR", `r${sec}`);
    } else if (intent.postedWithinDays && intent.postedWithinDays > 0) {
      const sec = intent.postedWithinDays * 24 * 3600;
      params.set("f_TPR", `r${sec}`);
    }

    return `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?${params.toString()}`;
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
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: context?.signal || AbortSignal.timeout(limits.timeoutMs),
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const candidates: RawJobCandidate[] = [];

    const { parsePostingDate } = await import("../freshnessExtractor");

    $("li, .base-card, .job-search-card").each((_, el) => {
      if (candidates.length >= limits.maxCandidates) return false;

      const $el = $(el);
      const title = $el.find(".base-search-card__title, h3.job-search-card__title, .base-card__full-link").first().text().trim();
      const company = $el.find(".base-search-card__subtitle, h4.job-search-card__company-name, .base-card__subtitle").first().text().trim();
      const location = $el.find(".job-search-card__location, .base-search-card__metadata").first().text().trim();
      const rawHref = $el.find("a.base-card__full-link, a.job-search-card__url-wrapper, a").first().attr("href");

      const timeEl = $el.find("time, .job-search-card__listdate, .job-search-card__listdate--new").first();
      const rawDatetime = timeEl.attr("datetime");
      const timeText = timeEl.text().trim();

      let postedAt: Date | undefined = undefined;
      let postedAgoText: string | undefined = timeText || undefined;

      if (rawDatetime) {
        const parsed = new Date(rawDatetime);
        if (!isNaN(parsed.getTime())) {
          postedAt = parsed;
        }
      }
      if (!postedAt && timeText) {
        const res = parsePostingDate(timeText);
        if (res.postedAt) {
          postedAt = res.postedAt;
          postedAgoText = res.postedAgoText || timeText;
        }
      }

      if (title && company && rawHref) {
        let cleanUrl = rawHref.split("?")[0].trim();
        if (cleanUrl.startsWith("//")) cleanUrl = `https:${cleanUrl}`;

        // Extract external job ID from LinkedIn URL
        const idMatch = cleanUrl.match(/view\/([a-zA-Z0-9_-]+)/i) || cleanUrl.match(/-([0-9]+)$/);
        const externalJobId = idMatch ? idMatch[1] : undefined;

        candidates.push({
          sourcePlatform: this.name,
          sourceUrl: cleanUrl,
          applyUrl: cleanUrl, // Standard guest apply URL
          externalJobId,
          title: sanitizeSnippet(title, 120),
          companyName: sanitizeSnippet(company, 100),
          location: location ? sanitizeSnippet(location, 80) : undefined,
          workMode: intent.workMode || (location.toLowerCase().includes("remote") ? "REMOTE" : undefined),
          experienceLevel: intent.experienceLevel || "ENTRY_LEVEL",
          opportunityType: intent.opportunityType || (intent.experienceLevel === "INTERN" ? "INTERNSHIP" : "FULL_TIME"),
          rawSnippet: sanitizeSnippet($el.text(), 300),
          discoveredAt: new Date(),
          postedAt,
          postedAgoText,
        });
      }
    });

    return candidates;
  }
}

export const linkedInProvider = new LinkedInProvider();
