/**
 * §ATS PORTAL BROWSER CONNECTOR (TASK-039 & TASK-065)
 * 
 * Executes direct career portal crawls across Ashby, Greenhouse, Lever, and Workable
 * using browser page automation and official public board endpoints.
 */

import { BrowserSourceConnector, type BrowserConnectorContext } from "../browserSourceConnector";
import {
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  isSafePublicUrl,
} from "@/lib/scraper/providers/baseProvider";
import { type BrowserSessionRecord, type BrowserSessionValidationResult } from "../browserSessionTypes";
import { browserPool } from "@/worker/browser";
import { validateAndNormalizeExtractionBatch } from "@/lib/scraper/extractionContract";
import {
  createGeminiClient,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  resolveGeminiApiKey,
} from "@/lib/ai/modelSelector";
import { connectorUsageService } from "@/lib/discovery/connectors/connectorUsageService";
import { discoverCandidateTargets } from "@/lib/scraper/candidateDiscoveryEngine";

function deduceExperienceLevel(title: string): string {
  const lower = title.toLowerCase();
  if (/\b(intern|internship|trainee|co-op|fellow)\b/i.test(lower)) return "INTERN";
  if (/\b(entry|junior|jr|graduate|grad|associate|new grad)\b/i.test(lower)) return "ENTRY_LEVEL";
  if (/\b(senior|sr|lead|principal|staff|director|head|vp|chief)\b/i.test(lower)) return "SENIOR";
  return "MID";
}

function deduceWorkMode(title: string, locationStr: string): string {
  const combined = `${title} ${locationStr}`.toLowerCase();
  if (/\b(remote|work from home|wfh|anywhere|distributed)\b/i.test(combined)) return "REMOTE";
  if (/\b(hybrid|flexible)\b/i.test(combined)) return "HYBRID";
  return "ON_SITE";
}

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

function toRawJobCandidates(
  extractions: Array<import("@/lib/scraper/extractionContract").OpportunityExtraction>,
  defaultUrl: string,
  platform = "ATS Portal"
): RawJobCandidate[] {
  return extractions.map((o) => ({
    sourcePlatform: o.sourcePlatform || platform,
    sourceUrl: o.sourceUrl || defaultUrl,
    applyUrl: o.applyUrl || o.sourceUrl || defaultUrl,
    externalJobId: o.externalJobId || o.applyUrl || o.sourceUrl || defaultUrl,
    title: o.title,
    companyName: o.companyName || o.company || "Company",
    location: o.location || "Remote / Various",
    workMode: o.workMode || "ANY",
    experienceLevel: o.experienceLevel || "ANY",
    opportunityType: o.opportunityType || "FULL_TIME",
    salaryText:
      o.salaryMin && o.salaryMax
        ? `${o.salaryCurrency || "$"} ${o.salaryMin} - ${o.salaryMax}`
        : undefined,
    description: o.description || `${o.title} at ${o.companyName || o.company}`,
    rawSnippet: (o.description || o.title).slice(0, 300),
    discoveredAt: new Date(),
    postedAt: o.postedAt ? new Date(o.postedAt) : new Date(),
    postedAgoText: o.postedAgoText || null,
  }));
}

export class AtsBrowserConnector extends BrowserSourceConnector {
  public readonly name: string;
  public readonly sourceType = "ATS_PORTAL" as const;

  constructor(atsName = "Greenhouse") {
    super();
    this.name = atsName;
  }

  public async verifySession(
    session: BrowserSessionRecord,
    rawState?: Record<string, unknown> | null
  ): Promise<BrowserSessionValidationResult> {
    return {
      isValid: true,
      status: "CONNECTED",
      expiresAt: session?.expiresAt,
    };
  }

  public async search(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    try {
      const explicitCompanies = [
        ...(intent.companies || []),
        ...(intent.company ? [intent.company] : []),
      ].filter(Boolean);

      const targetUrls: string[] = [];

      if (explicitCompanies.length > 0) {
        for (const comp of explicitCompanies) {
          const slug = comp.toLowerCase().replace(/[^a-z0-9]/g, "");
          targetUrls.push(this.buildDefaultAtsUrl(slug));
        }
      } else {
        const discovery = await discoverCandidateTargets(intent, {
          userId: context?.userId,
          maxTargets: 6,
        });
        const matched = discovery.targets.filter(
          (t) => t.atsProvider.toUpperCase() === this.name.toUpperCase() || t.careerUrl.toLowerCase().includes(this.name.toLowerCase())
        );
        for (const t of matched.slice(0, 3)) {
          if (t.careerUrl) targetUrls.push(t.careerUrl);
          else if (t.atsSlug) targetUrls.push(this.buildDefaultAtsUrl(t.atsSlug));
        }
      }

      if (targetUrls.length === 0) {
        return [];
      }

      const allCandidates: RawJobCandidate[] = [];
      for (const url of targetUrls.slice(0, 3)) {
        if (context?.signal?.aborted) break;
        const crawled = await this.crawl(url, context);
        allCandidates.push(...crawled);
      }

      const filtered = this.filterCandidates(allCandidates, intent);
      return filtered.slice(0, limits.maxCandidates || 25);
    } catch (err) {
      console.warn(`[AtsBrowserConnector:${this.name}] Search failed:`, err);
      return [];
    }
  }

  public async crawl(
    targetUrl: string,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    if (!targetUrl || !isSafePublicUrl(targetUrl)) {
      return [];
    }

    const crawlStart = Date.now();
    const isEnabled = await connectorUsageService.isConnectorEnabled(this.name, targetUrl);
    if (!isEnabled) {
      console.log(`[AtsBrowserConnector:${this.name}] Disabled by administrator. Skipping ${targetUrl}.`);
      return [];
    }

    // 1. Check for fast-path direct public ATS APIs
    const apiCandidates = await this.tryDirectAtsApi(targetUrl);
    if (apiCandidates.length > 0) {
      const validated = validateAndNormalizeExtractionBatch(apiCandidates, { allowLocalForTests: true });
      const rawResults = toRawJobCandidates([...validated.valid, ...validated.partial], targetUrl, this.name);
      await connectorUsageService.recordConnectorHarvest({
        connectorName: this.name,
        targetUrl,
        status: "SUCCESS",
        jobsFoundCount: apiCandidates.length,
        qualityGatePassCount: validated.valid.length + validated.partial.length,
        durationMs: Date.now() - crawlStart,
      });
      return rawResults;
    }

    // 2. Playwright Web Crawl Fallback
    const correlationId = context?.correlationId || `crawl_ats_${Date.now()}`;
    const session = await browserPool.createSession({
      jobId: correlationId,
      timeoutMs: 30000,
      headless: true,
    });

    try {
      if (context?.signal?.aborted) return [];

      const resp = await session.page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      }).catch((e) => {
        console.warn(`[AtsBrowserConnector:${this.name}] Navigation warning for ${targetUrl}:`, e.message);
        return null;
      });

      const status = resp ? resp.status() : 0;
      if (status === 403 || status === 401) {
        this.reportStructuredError(
          new Error(`HTTP ${status} Forbidden/Unauthorized at ${targetUrl}`),
          "SOURCE_BLOCKED",
          correlationId
        );
        return [];
      }

      await session.page.waitForTimeout(2500);

      const pageContent = await session.page.content();
      if (this.detectCaptcha(pageContent)) {
        this.reportStructuredError(
          new Error(`Verification challenge detected at ${targetUrl}`),
          "CAPTCHA_DETECTED",
          correlationId
        );
        return [];
      }

      // Extract DOM anchor job postings
      const domJobs = await session.page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const results: Array<{ title: string; href: string; snippet: string; location?: string }> = [];
        const seen = new Set<string>();

        for (const a of anchors) {
          const href = a.href || "";
          const text = a.innerText.trim();

          const isJobHref =
            /(\/jobs\/\d+|\/postings\/|\/j\/[a-zA-Z0-9]+|jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]+|apply\.workable\.com\/[^/]+\/j\/)/i.test(href) ||
            (href.includes("/job/") && text.length > 3);

          if (isJobHref && text.length >= 3 && !seen.has(href)) {
            seen.add(href);
            const parent = a.closest("li, tr, [class*='job'], [class*='posting'], div");
            const snippet = parent ? (parent as HTMLElement).innerText.slice(0, 300) : text;
            results.push({ title: text, href, snippet });
          }
        }
        return results;
      });

      const candidates: RawJobCandidate[] = [];
      const parsedBase = new URL(targetUrl);
      const company = parsedBase.pathname.split("/").filter(Boolean)[0] || "Target Company";
      const normalizedCompany = company.charAt(0).toUpperCase() + company.slice(1);

      if (domJobs.length > 0) {
        for (const j of domJobs.slice(0, 40)) {
          const exp = deduceExperienceLevel(j.title);
          const workMode = deduceWorkMode(j.title, j.snippet);

          candidates.push({
            sourcePlatform: this.name,
            sourceUrl: targetUrl,
            applyUrl: j.href,
            externalJobId: j.href,
            title: j.title,
            companyName: normalizedCompany,
            location: "Remote / Various",
            workMode,
            experienceLevel: exp,
            opportunityType: exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME",
            description: j.snippet || `${j.title} at ${normalizedCompany}`,
            rawSnippet: j.snippet.slice(0, 300),
            discoveredAt: new Date(),
            postedAt: new Date(),
          });
        }
      }

      // Fallback to LLM extraction if DOM had no recognized cards
      if (candidates.length === 0) {
        const pageText = await session.page.evaluate(() => document.body?.innerText || "");
        if (pageText.length > 200) {
          const llmJobs = await this.extractWithLlm(pageText, targetUrl, normalizedCompany, context?.userId);
          candidates.push(...llmJobs);
        }
      }

      const validated = validateAndNormalizeExtractionBatch(candidates, { allowLocalForTests: true });
      const validCount = validated.valid.length + validated.partial.length;
      await connectorUsageService.recordConnectorHarvest({
        connectorName: this.name,
        targetUrl,
        status: candidates.length > 0 ? "SUCCESS" : "EMPTY",
        jobsFoundCount: candidates.length,
        qualityGatePassCount: validCount,
        durationMs: Date.now() - crawlStart,
      });
      return toRawJobCandidates([...validated.valid, ...validated.partial], targetUrl, this.name);
    } finally {
      await session.close().catch(() => {});
    }
  }

  private buildDefaultAtsUrl(slug: string): string {
    switch (this.name.toUpperCase()) {
      case "GREENHOUSE":
        return `https://boards.greenhouse.io/${slug}`;
      case "LEVER":
        return `https://jobs.lever.co/${slug}`;
      case "ASHBY":
        return `https://jobs.ashbyhq.com/${slug}`;
      case "WORKABLE":
        return `https://apply.workable.com/${slug}`;
      default:
        return `https://boards.greenhouse.io/${slug}`;
    }
  }

  private async tryDirectAtsApi(targetUrl: string): Promise<RawJobCandidate[]> {
    try {
      const lower = targetUrl.toLowerCase();
      // 1. Greenhouse
      if (lower.includes("greenhouse.io")) {
        const match = targetUrl.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)/i);
        if (match) {
          const slug = match[1];
          const resp = await fetch(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`, {
            headers: { Accept: "application/json" },
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (Array.isArray(data?.jobs)) {
              return data.jobs.map((job: any): RawJobCandidate => {
                const title = job.title || "Opportunity";
                const loc = job.location?.name || "Remote / Various";
                const content = stripHtml(job.content || "");
                return {
                  sourcePlatform: "Greenhouse",
                  sourceUrl: job.absolute_url || targetUrl,
                  applyUrl: job.absolute_url || targetUrl,
                  externalJobId: String(job.id || ""),
                  title,
                  companyName: slug.charAt(0).toUpperCase() + slug.slice(1),
                  location: loc,
                  workMode: deduceWorkMode(title, loc),
                  experienceLevel: deduceExperienceLevel(title),
                  opportunityType: "FULL_TIME",
                  description: content.slice(0, 2000) || `${title} at ${slug}`,
                  rawSnippet: content.slice(0, 300),
                  discoveredAt: new Date(),
                  postedAt: job.updated_at ? new Date(job.updated_at) : new Date(),
                };
              });
            }
          }
        }
      }

      // 2. Lever
      if (lower.includes("jobs.lever.co")) {
        const match = targetUrl.match(/jobs\.lever\.co\/([^/?#]+)/i);
        if (match) {
          const slug = match[1];
          const resp = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`, {
            headers: { Accept: "application/json" },
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (Array.isArray(data)) {
              return data.map((job: any): RawJobCandidate => {
                const title = job.text || "Opportunity";
                const loc = job.categories?.location || "Remote / Various";
                const desc = (job.descriptionPlain || job.additionalPlain || "").slice(0, 2000);
                return {
                  sourcePlatform: "Lever",
                  sourceUrl: job.hostedUrl || job.applyUrl || targetUrl,
                  applyUrl: job.applyUrl || job.hostedUrl || targetUrl,
                  externalJobId: String(job.id || ""),
                  title,
                  companyName: slug.charAt(0).toUpperCase() + slug.slice(1),
                  location: loc,
                  workMode: deduceWorkMode(title, loc),
                  experienceLevel: deduceExperienceLevel(title),
                  opportunityType: "FULL_TIME",
                  description: desc || `${title} at ${slug}`,
                  rawSnippet: desc.slice(0, 300),
                  discoveredAt: new Date(),
                  postedAt: job.createdAt ? new Date(job.createdAt) : new Date(),
                };
              });
            }
          }
        }
      }

      // 3. Ashby
      if (lower.includes("jobs.ashbyhq.com")) {
        const match = targetUrl.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i);
        if (match) {
          const slug = match[1];
          const resp = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}`, {
            headers: { Accept: "application/json" },
          });
          if (resp.ok) {
            const data = (await resp.json()) as any;
            if (Array.isArray(data?.jobs)) {
              return data.jobs.map((job: any): RawJobCandidate => {
                const title = job.title || "Opportunity";
                const loc = job.location || (job.isRemote ? "Remote" : "Various");
                const snippet = `${job.department ? `${job.department}: ` : ""}${title}`;
                return {
                  sourcePlatform: "Ashby",
                  sourceUrl: job.jobUrl || job.applyUrl || targetUrl,
                  applyUrl: job.applyUrl || job.jobUrl || targetUrl,
                  externalJobId: String(job.id || ""),
                  title,
                  companyName: slug.charAt(0).toUpperCase() + slug.slice(1),
                  location: loc,
                  workMode: job.isRemote ? "REMOTE" : deduceWorkMode(title, loc),
                  experienceLevel: deduceExperienceLevel(title),
                  opportunityType: "FULL_TIME",
                  description: snippet,
                  rawSnippet: snippet,
                  discoveredAt: new Date(),
                  postedAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
                };
              });
            }
          }
        }
      }
    } catch {
      // Fall through to browser crawl
    }
    return [];
  }

  private async extractWithLlm(
    pageText: string,
    targetUrl: string,
    companyName: string,
    userId?: string | null
  ): Promise<RawJobCandidate[]> {
    try {
      const apiKey = await resolveGeminiApiKey(null, userId);
      if (!apiKey) return [];

      const ai = createGeminiClient(apiKey);
      const prompt = `Extract all active job postings from this ${this.name} careers portal text for employer ${companyName}.
URL: ${targetUrl}
Content:
${pageText.slice(0, 8000)}

Return a JSON array:
[
  {
    "title": "Job Title",
    "location": "Location",
    "applyUrl": "URL if present or ${targetUrl}",
    "description": "Brief description"
  }
]`;

      let text: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        text = res.text;
      } catch {
        const fbRes = await ai.models.generateContent({
          model: FALLBACK_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        text = fbRes.text;
      }

      if (!text) return [];
      const clean = text.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(clean);
      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: any): RawJobCandidate => ({
        sourcePlatform: this.name,
        sourceUrl: targetUrl,
        applyUrl: item.applyUrl || targetUrl,
        externalJobId: item.applyUrl || targetUrl,
        title: item.title,
        companyName,
        location: item.location || "Remote / Various",
        workMode: deduceWorkMode(item.title, item.location || ""),
        experienceLevel: deduceExperienceLevel(item.title),
        opportunityType: "FULL_TIME",
        description: item.description || `${item.title} at ${companyName}`,
        rawSnippet: (item.description || item.title).slice(0, 300),
        discoveredAt: new Date(),
        postedAt: new Date(),
      }));
    } catch {
      return [];
    }
  }

  private filterCandidates(candidates: RawJobCandidate[], intent: SearchIntent): RawJobCandidate[] {
    const queryRoles = [
      ...(intent.roles || []),
      ...(intent.role ? [intent.role] : []),
    ].map((r) => r.toLowerCase().trim()).filter(Boolean);

    if (queryRoles.length === 0) return candidates;

    return candidates.filter((c) => {
      const titleLower = c.title.toLowerCase();
      return queryRoles.some((r) => {
        const words = r.split(/\s+/).filter((w) => w.length > 2);
        return words.some((w) => titleLower.includes(w));
      });
    });
  }
}

export const greenhouseBrowserConnector = new AtsBrowserConnector("Greenhouse");
export const ashbyBrowserConnector = new AtsBrowserConnector("Ashby");
export const leverBrowserConnector = new AtsBrowserConnector("Lever");
export const workableBrowserConnector = new AtsBrowserConnector("Workable");
