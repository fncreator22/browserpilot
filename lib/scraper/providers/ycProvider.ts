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

const YC_STARTUP_ATS: Array<{ company: string; ashbySlug?: string; greenhouseSlug?: string }> = [
  { company: "Supabase", ashbySlug: "supabase" },
  { company: "PostHog", ashbySlug: "posthog" },
  { company: "Retool", ashbySlug: "retool" },
  { company: "Linear", ashbySlug: "linear" },
  { company: "Ramp", ashbySlug: "ramp" },
  { company: "GitLab", greenhouseSlug: "gitlab" },
];

export class YCProvider implements SearchProvider {
  public readonly name = "Y Combinator";

  public supports(intent: SearchIntent): boolean {
    if (intent.companyType === "ENTERPRISE") return false; // YC is startup-only
    return true; // Supports startups, early-career, AI/ML, full-stack, and internship queries
  }

  public buildSearchUrl(intent: SearchIntent): string {
    const queryTerms: string[] = [];
    const role = intent.role || intent.roles?.[0] || "";
    if (role) queryTerms.push(role);
    if (intent.skills && intent.skills.length > 0) {
      queryTerms.push(intent.skills[0]);
    }
    const location = intent.location || intent.locations?.[0] || "";
    const isSafeLocation =
      location &&
      location.length < 30 &&
      !/\b(companies|startups|with|using|react|typescript|javascript|python|combinator|accelerator)\b/i.test(location) &&
      location.toLowerCase() !== "remote" &&
      location.toLowerCase() !== "any" &&
      location.toLowerCase() !== "worldwide";

    if (isSafeLocation) {
      queryTerms.push(location);
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

    const candidates: RawJobCandidate[] = [];
    const resolvedRole = intent.role || intent.roles?.[0];

    if (isSafePublicUrl(searchUrl)) {
      try {
        const response = await fetcher(searchUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          signal: context?.signal || AbortSignal.timeout(limits.timeoutMs),
        });

        if (response.ok) {
          const html = await response.text();
          const $ = cheerio.load(html);

          // Parse YC company cards and job rows
          $(".company-card, .job-card, div[data-company-name], .w-full").each((_, el) => {
            if (candidates.length >= limits.maxCandidates) return false;

            const $el = $(el);
            const companyName =
              $el.find(".company-name, .font-bold, h3, a[href*='/companies/']").first().text().trim() ||
              $el.attr("data-company-name");
            const title =
              $el.find(".job-name, .job-title, h4, .text-lg").first().text().trim() ||
              (resolvedRole ? `${resolvedRole} at ${companyName}` : undefined);
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
        }
      } catch {
        // Fallback below
      }
    }

    // Resilient Fallback: If WAAS client-rendered page yields 0, query verified top YC startups
    if (candidates.length === 0) {
      const roleTokens = (intent.role || intent.roles?.[0] || "engineer")
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 2 && !/^(and|for|the|jobs?|roles?)$/i.test(w));

      for (const target of YC_STARTUP_ATS) {
        if (candidates.length >= limits.maxCandidates) break;

        try {
          if (target.ashbySlug) {
            const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(target.ashbySlug)}`;
            const resp = await fetcher(url, { signal: context?.signal || AbortSignal.timeout(5000) });
            if (resp.ok) {
              const data = (await resp.json()) as any;
              const jobs = Array.isArray(data.jobs) ? data.jobs : [];
              for (const j of jobs) {
                if (candidates.length >= limits.maxCandidates) break;
                const titleLower = (j.title || "").toLowerCase();
                const matchesRole = roleTokens.some((t) => titleLower.includes(t));
                if (!matchesRole && roleTokens.length > 0) continue;

                candidates.push({
                  sourcePlatform: this.name,
                  sourceUrl: j.jobUrl || `https://jobs.ashbyhq.com/${target.ashbySlug}/${j.id}`,
                  applyUrl: j.applyUrl || j.jobUrl || `https://jobs.ashbyhq.com/${target.ashbySlug}/${j.id}`,
                  externalJobId: String(j.id),
                  title: sanitizeSnippet(j.title, 120),
                  companyName: target.company,
                  location: j.location || "Remote",
                  workMode: (j.location || "").toLowerCase().includes("remote") || j.isRemote ? "REMOTE" : "ANY",
                  experienceLevel: intent.experienceLevel || "ENTRY_LEVEL",
                  opportunityType: intent.opportunityType || "FULL_TIME",
                  rawSnippet: sanitizeSnippet(j.department || j.title, 300),
                  discoveredAt: new Date(),
                  postedAt: j.publishedAt ? new Date(j.publishedAt) : new Date(),
                });
              }
            }
          }
        } catch {
          // Continue to next YC startup
        }
      }
    }

    return candidates;
  }
}

export const ycProvider = new YCProvider();
