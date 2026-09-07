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
  isSafePublicUrl,
} from "./baseProvider";
import { connectorUsageService } from "@/lib/discovery/connectors/connectorUsageService";

export interface AtsCompanyTarget {
  name: string;
  greenhouseSlug?: string;
  leverSlug?: string;
  ashbySlug?: string;
}

const DEFAULT_ATS_COMPANIES: AtsCompanyTarget[] = [
  { name: "GitLab", greenhouseSlug: "gitlab" },
  { name: "Figma", greenhouseSlug: "figma" },
  { name: "Stripe", greenhouseSlug: "stripe" },
  { name: "Linear", ashbySlug: "linear" },
  { name: "Ramp", ashbySlug: "ramp" },
  { name: "Palantir", leverSlug: "palantir" },
  { name: "Vercel", ashbySlug: "vercel" },
  { name: "Supabase", ashbySlug: "supabase" },
  { name: "Netflix", leverSlug: "netflix" },
  { name: "DoorDash", greenhouseSlug: "doordash" },
];

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function deduceExperienceLevel(title: string): string {
  const lower = title.toLowerCase();
  if (/\b(intern|internship|trainee|co-op)\b/i.test(lower)) return "INTERN";
  if (/\b(entry|junior|jr|graduate|grad|associate|new grad)\b/i.test(lower)) return "ENTRY_LEVEL";
  if (/\b(senior|sr|lead|principal|staff|director|head|vp)\b/i.test(lower)) return "SENIOR";
  return "MID";
}

function deduceWorkMode(title: string, locationStr: string): string {
  const combined = `${title} ${locationStr}`.toLowerCase();
  if (/\b(remote|work from home|wfh|anywhere|distributed)\b/i.test(combined)) return "REMOTE";
  if (/\b(hybrid|flexible)\b/i.test(combined)) return "HYBRID";
  return "ON_SITE";
}

export class AtsProvider implements SearchProvider {
  public readonly name = "ATS Direct";

  public supports(intent: SearchIntent): boolean {
    return true; // Dynamic candidate discovery routes any domain to matching ATS boards
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    const fetchFn = context?.customFetch || fetch;
    const timeoutSignal = AbortSignal.timeout(Math.min(limits.timeoutMs || 8000, 15000));
    const compositeSignal = context?.signal
      ? anySignal([context.signal, timeoutSignal])
      : timeoutSignal;

    // Resolve target companies
    const companiesToQuery: AtsCompanyTarget[] = [];
    const allCandidates: RawJobCandidate[] = [];
    const harvestPromises: Promise<RawJobCandidate[]>[] = [];

    const explicitCompanies = [
      ...(intent.companies || []),
      ...(intent.company ? [intent.company] : []),
    ];

    if (explicitCompanies.length > 0) {
      for (const compName of explicitCompanies) {
        const slug = compName.toLowerCase().replace(/[^a-z0-9]/g, "");
        companiesToQuery.push({
          name: compName,
          greenhouseSlug: slug,
          leverSlug: slug,
          ashbySlug: slug,
        });
      }
    } else {
      // Dynamic Candidate Discovery for open-ended queries (TASK-061 & TASK-065)
      try {
        const { discoverCandidateTargets } = await import("../candidateDiscoveryEngine");
        const discovery = await discoverCandidateTargets(intent, { userId: (context as any)?.userId });
        const directAts = discovery.targets.filter((t) => t.dispatchRoute === "ATS_DIRECT" || t.atsSlug);
        for (const t of directAts) {
          companiesToQuery.push({
            name: t.name,
            greenhouseSlug: t.atsProvider === "GREENHOUSE" ? t.atsSlug : undefined,
            leverSlug: t.atsProvider === "LEVER" ? t.atsSlug : undefined,
            ashbySlug: t.atsProvider === "ASHBY" ? t.atsSlug : undefined,
          });
        }

        // TASK-065: Route OPEN_WEB candidates through generic browser career portal connector
        const openWebTargets = discovery.targets.filter((t) => t.dispatchRoute === "OPEN_WEB" && t.careerUrl);
        if (openWebTargets.length > 0) {
          const { careerPortalBrowserConnector } = await import("@/lib/discovery/browser/connectors/careerPortalConnector");
          for (const target of openWebTargets.slice(0, 2)) {
            harvestPromises.push(
              careerPortalBrowserConnector.crawl(target.careerUrl, {
                userId: (context as any)?.userId,
                signal: compositeSignal,
              }).catch(() => [])
            );
          }
        }
      } catch (err) {
        console.warn("[AtsProvider] Dynamic candidate discovery failed, falling back to curated list:", err);
      }
      if (companiesToQuery.length === 0 && harvestPromises.length === 0) {
        companiesToQuery.push(...DEFAULT_ATS_COMPANIES.slice(0, 6));
      }
    }

    const isGreenhouseEnabled = await connectorUsageService.isConnectorEnabled("Greenhouse");
    const isLeverEnabled = await connectorUsageService.isConnectorEnabled("Lever");
    const isAshbyEnabled = await connectorUsageService.isConnectorEnabled("Ashby");

    for (const comp of companiesToQuery) {
      if (comp.greenhouseSlug && isGreenhouseEnabled) {
        harvestPromises.push(this.harvestGreenhouse(comp.name, comp.greenhouseSlug, fetchFn, compositeSignal));
      }
      if (comp.leverSlug && isLeverEnabled) {
        harvestPromises.push(this.harvestLever(comp.name, comp.leverSlug, fetchFn, compositeSignal));
      }
      if (comp.ashbySlug && isAshbyEnabled) {
        harvestPromises.push(this.harvestAshby(comp.name, comp.ashbySlug, fetchFn, compositeSignal));
      }
    }

    const results = await Promise.allSettled(harvestPromises);
    for (const res of results) {
      if (res.status === "fulfilled" && Array.isArray(res.value)) {
        allCandidates.push(...res.value);
      }
    }

    // Filter against intent
    const filtered = this.filterCandidates(allCandidates, intent);
    return filtered.slice(0, limits.maxCandidates || 50);
  }

  private async harvestGreenhouse(
    companyName: string,
    slug: string,
    fetchFn: typeof fetch,
    signal: AbortSignal
  ): Promise<RawJobCandidate[]> {
    const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`;
    if (!isSafePublicUrl(url)) return [];

    try {
      const resp = await fetchFn(url, { signal, headers: { Accept: "application/json" } });
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      if (!data || !Array.isArray(data.jobs)) return [];

      const candidates: RawJobCandidate[] = data.jobs.map((job: any): RawJobCandidate => {
        const title = job.title || "Software Opportunity";
        const loc = job.location?.name || "Remote / Various";
        const workMode = deduceWorkMode(title, loc);
        const exp = deduceExperienceLevel(title);
        const oppType = exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME";
        const contentPlain = stripHtml(job.content || "");

        return {
          sourcePlatform: "Greenhouse",
          sourceUrl: job.absolute_url || url,
          applyUrl: job.absolute_url || url,
          externalJobId: String(job.id || ""),
          title,
          companyName,
          location: loc,
          workMode,
          experienceLevel: exp,
          opportunityType: oppType,
          description: contentPlain.slice(0, 2000) || `${title} at ${companyName}`,
          rawSnippet: contentPlain.slice(0, 300),
          discoveredAt: new Date(),
          postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
        };
      });

      await connectorUsageService.recordConnectorHarvest({
        connectorName: "Greenhouse",
        targetUrl: url,
        status: candidates.length > 0 ? "SUCCESS" : "EMPTY",
        jobsFoundCount: candidates.length,
        qualityGatePassCount: candidates.length,
      });

      return candidates;
    } catch {
      return [];
    }
  }

  private async harvestLever(
    companyName: string,
    slug: string,
    fetchFn: typeof fetch,
    signal: AbortSignal
  ): Promise<RawJobCandidate[]> {
    const url = `https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`;
    if (!isSafePublicUrl(url)) return [];

    try {
      const resp = await fetchFn(url, { signal, headers: { Accept: "application/json" } });
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      if (!Array.isArray(data)) return [];

      const candidates: RawJobCandidate[] = data.map((job: any): RawJobCandidate => {
        const title = job.text || "Opportunity";
        const loc = job.categories?.location || "Remote / Various";
        const wp = (job.categories?.workplaceType || "").toLowerCase();
        const workMode = wp === "remote" ? "REMOTE" : wp === "hybrid" ? "HYBRID" : wp === "on-site" ? "ON_SITE" : deduceWorkMode(title, loc);
        const exp = deduceExperienceLevel(title);
        const commitment = (job.categories?.commitment || "").toLowerCase();
        const oppType = commitment.includes("intern") || exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME";
        const description = (job.descriptionPlain || job.additionalPlain || "").slice(0, 2000);

        return {
          sourcePlatform: "Lever",
          sourceUrl: job.hostedUrl || job.applyUrl || url,
          applyUrl: job.applyUrl || job.hostedUrl || url,
          externalJobId: String(job.id || ""),
          title,
          companyName,
          location: loc,
          workMode,
          experienceLevel: exp,
          opportunityType: oppType,
          description: description || `${title} at ${companyName}`,
          rawSnippet: description.slice(0, 300),
          discoveredAt: new Date(),
          postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
        };
      });

      await connectorUsageService.recordConnectorHarvest({
        connectorName: "Lever",
        targetUrl: url,
        status: candidates.length > 0 ? "SUCCESS" : "EMPTY",
        jobsFoundCount: candidates.length,
        qualityGatePassCount: candidates.length,
      });

      return candidates;
    } catch {
      return [];
    }
  }

  private async harvestAshby(
    companyName: string,
    slug: string,
    fetchFn: typeof fetch,
    signal: AbortSignal
  ): Promise<RawJobCandidate[]> {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`;
    if (!isSafePublicUrl(url)) return [];

    try {
      const resp = await fetchFn(url, { signal, headers: { Accept: "application/json" } });
      if (!resp.ok) return [];
      const data = (await resp.json()) as any;
      if (!data || !Array.isArray(data.jobs)) return [];

      const candidates: RawJobCandidate[] = data.jobs.map((job: any): RawJobCandidate => {
        const title = job.title || "Opportunity";
        const loc = job.location || (job.isRemote ? "Remote" : "Various");
        const workMode = job.isRemote ? "REMOTE" : deduceWorkMode(title, loc);
        const exp = deduceExperienceLevel(title);
        const empType = (job.employmentType || "").toLowerCase();
        const oppType = empType.includes("intern") || exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME";
        const snippet = `${job.department ? `Department: ${job.department}. ` : ""}${title} at ${companyName}`;

        return {
          sourcePlatform: "Ashby",
          sourceUrl: job.jobUrl || job.applyUrl || url,
          applyUrl: job.applyUrl || job.jobUrl || url,
          externalJobId: String(job.id || ""),
          title,
          companyName,
          location: loc,
          workMode,
          experienceLevel: exp,
          opportunityType: oppType,
          description: snippet,
          rawSnippet: snippet,
          discoveredAt: new Date(),
          postedAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
        };
      });

      await connectorUsageService.recordConnectorHarvest({
        connectorName: "Ashby",
        targetUrl: url,
        status: candidates.length > 0 ? "SUCCESS" : "EMPTY",
        jobsFoundCount: candidates.length,
        qualityGatePassCount: candidates.length,
      });

      return candidates;
    } catch {
      return [];
    }
  }

  private filterCandidates(candidates: RawJobCandidate[], intent: SearchIntent): RawJobCandidate[] {
    const queryRoles = [
      ...(intent.roles || []),
      ...(intent.role ? [intent.role] : []),
    ].map((r) => r.toLowerCase().trim()).filter(Boolean);

    const querySkills = (intent.skills || []).map((s) => s.toLowerCase().trim()).filter(Boolean);
    const queryWorkMode = intent.workMode && intent.workMode !== "ANY" ? intent.workMode : null;
    const queryExp = intent.experienceLevel && intent.experienceLevel !== "ANY" ? intent.experienceLevel : null;
    const queryOppType = intent.opportunityType && intent.opportunityType !== "ANY" ? intent.opportunityType : null;

    if (queryRoles.length === 0 && querySkills.length === 0 && !queryWorkMode && !queryExp && !queryOppType) {
      return candidates;
    }

    // Role token matching
    const roleTokens = new Set<string>();
    for (const r of queryRoles) {
      r.split(/\s+/).forEach((w) => {
        if (w.length > 2 && !/^(and|for|the|jobs?|roles?|positions?)$/i.test(w)) {
          roleTokens.add(w);
        }
      });
    }

    return candidates.filter((c) => {
      const titleLower = c.title.toLowerCase();
      const descLower = (c.description || "").toLowerCase();

      // Experience Level filter
      if (queryExp && c.experienceLevel && c.experienceLevel !== "ANY") {
        if (queryExp === "INTERN" && c.experienceLevel !== "INTERN") return false;
      }

      // Opportunity Type filter
      if (queryOppType) {
        if (queryOppType === "INTERNSHIP" && c.opportunityType !== "INTERNSHIP") return false;
      }

      // Work mode filter
      if (queryWorkMode && c.workMode && c.workMode !== "ANY") {
        if (queryWorkMode !== c.workMode) return false;
      }

      // Role match check
      if (roleTokens.size > 0) {
        const titleWords = titleLower.split(/\W+/);
        let hasTokenMatch = false;
        for (const token of roleTokens) {
          if (titleWords.includes(token) || titleLower.includes(token)) {
            hasTokenMatch = true;
            break;
          }
        }
        if (!hasTokenMatch && queryRoles.length > 0) {
          // Check description for tech keywords
          const hasDescMatch = queryRoles.some((r) => descLower.includes(r));
          if (!hasDescMatch) return false;
        }
      }

      return true;
    });
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const sig of signals) {
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

export const atsProvider = new AtsProvider();
