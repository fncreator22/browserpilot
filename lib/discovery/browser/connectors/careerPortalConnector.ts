/**
 * §COMPANY CAREER PORTAL BROWSER CONNECTOR (TASK-039 & TASK-065)
 * 
 * Directly crawls and extracts job postings from employer-hosted `/careers` and `/jobs` pages,
 * custom organizational portals (e.g. hospitals, research institutes, law firms, job boards),
 * and client-rendered career portals.
 * 
 * Architecture:
 * 1. Safe URL validation & SSRF prevention
 * 2. Workday CXS API fast-path detection for direct Workday portals
 * 3. Playwright browser navigation with WAF & CAPTCHA containment
 * 4. Hybrid extraction: Direct DOM anchor / card scraping + Gemini LLM fallback
 * 5. Strict candidate validation via validateAndNormalizeExtractionBatch
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
  if (/\b(intern|internship|trainee|co-op|fellow|fellowship|clerk|clerkship)\b/i.test(lower)) return "INTERN";
  if (/\b(entry|junior|jr|graduate|grad|associate|new grad|assistant)\b/i.test(lower)) return "ENTRY_LEVEL";
  if (/\b(senior|sr|lead|principal|staff|director|head|vp|manager|chief)\b/i.test(lower)) return "SENIOR";
  return "MID";
}

function deduceWorkMode(title: string, locationStr: string): string {
  const combined = `${title} ${locationStr}`.toLowerCase();
  if (/\b(remote|work from home|wfh|anywhere|distributed)\b/i.test(combined)) return "REMOTE";
  if (/\b(hybrid|flexible)\b/i.test(combined)) return "HYBRID";
  return "ON_SITE";
}

function toRawJobCandidates(
  extractions: Array<import("@/lib/scraper/extractionContract").OpportunityExtraction>,
  defaultUrl: string,
  platform = "Career Portal"
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

export class CareerPortalBrowserConnector extends BrowserSourceConnector {
  public readonly name = "Company Careers";
  public readonly sourceType = "COMPANY_CAREERS" as const;

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

  /**
   * Search career portals matching user search intent
   */
  public async search(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    try {
      const discovery = await discoverCandidateTargets(intent, {
        userId: context?.userId,
        maxTargets: 6,
      });

      // Prefer open-web portals and custom career sites
      const openWebTargets = discovery.targets.filter(
        (t) => t.dispatchRoute === "OPEN_WEB" || t.category !== "GENERAL"
      );

      const targetsToCrawl = (openWebTargets.length > 0 ? openWebTargets : discovery.targets).slice(0, 3);
      if (targetsToCrawl.length === 0) {
        return [];
      }

      const allCandidates: RawJobCandidate[] = [];
      for (const target of targetsToCrawl) {
        if (context?.signal?.aborted) break;
        if (!target.careerUrl) continue;

        try {
          const candidates = await this.crawl(target.careerUrl, context);
          for (const c of candidates) {
            // If target name known, default if missing
            if (!c.companyName || c.companyName === "Unknown Company") {
              c.companyName = target.name;
            }
            allCandidates.push(c);
          }
        } catch (crawlErr) {
          console.warn(`[CareerPortalConnector] Crawl failed for ${target.careerUrl}:`, crawlErr);
        }
      }

      const filtered = this.filterCandidates(allCandidates, intent);
      return filtered.slice(0, limits.maxCandidates || 25);
    } catch (err) {
      console.warn("[CareerPortalConnector] Search execution error:", err);
      return [];
    }
  }

  /**
   * Crawl a single careers/jobs URL using Playwright and LLM/DOM extraction
   */
  public async crawl(
    targetUrl: string,
    context?: BrowserConnectorContext
  ): Promise<RawJobCandidate[]> {
    if (!targetUrl || !isSafePublicUrl(targetUrl)) {
      return [];
    }

    const crawlStart = Date.now();
    const isWorkdayUrl = /myworkdayjobs\.com/i.test(targetUrl);
    const connectorCheckName = isWorkdayUrl ? "Workday CXS" : this.name;
    const isEnabled = await connectorUsageService.isConnectorEnabled(connectorCheckName, targetUrl);
    if (!isEnabled) {
      console.log(`[CareerPortalConnector] Connector "${connectorCheckName}" disabled by administrator. Skipping.`);
      return [];
    }

    // 1. Workday CXS fast-path if target is a direct Workday portal URL
    const workdayCandidates = await this.tryWorkdayCxsHarvest(targetUrl);
    if (workdayCandidates.length > 0) {
      const validated = validateAndNormalizeExtractionBatch(workdayCandidates, { allowLocalForTests: true });
      const rawList = toRawJobCandidates([...validated.valid, ...validated.partial], targetUrl, "Workday");
      await connectorUsageService.recordConnectorHarvest({
        connectorName: "Workday CXS",
        targetUrl,
        status: "SUCCESS",
        jobsFoundCount: workdayCandidates.length,
        qualityGatePassCount: validated.valid.length + validated.partial.length,
        durationMs: Date.now() - crawlStart,
      });
      return rawList;
    }

    // 2. Playwright Browser Session
    const correlationId = context?.correlationId || `crawl_${Date.now()}`;
    const session = await browserPool.createSession({
      jobId: correlationId,
      timeoutMs: 30000,
      headless: true,
    });

    try {
      if (context?.signal?.aborted) {
        return [];
      }

      const response = await session.page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      }).catch((e) => {
        console.warn(`[CareerPortalConnector] Navigation warning for ${targetUrl}:`, e.message);
        return null;
      });

      // 3. WAF & Access Denied Detection
      const status = response ? response.status() : 0;
      if (status === 403 || status === 401) {
        await connectorUsageService.recordConnectorHarvest({
          connectorName: this.name,
          targetUrl,
          status: "BLOCKED",
          jobsFoundCount: 0,
          qualityGatePassCount: 0,
          durationMs: Date.now() - crawlStart,
          errorMessage: `HTTP ${status} Forbidden/Unauthorized`,
        });
        this.reportStructuredError(
          new Error(`HTTP ${status} Forbidden/Unauthorized at ${targetUrl}`),
          "SOURCE_BLOCKED",
          correlationId
        );
        return [];
      }

      // Allow dynamic client hydration of job cards
      await session.page
        .waitForSelector("a[href*='/job/'], a[href*='/careers/apply'], a[href*='myworkdayjobs'], [data-ui='job-item']", { timeout: 8000 })
        .catch(() => {});
      await session.page.waitForTimeout(3500);

      const pageContent = await session.page.content();
      const pageText = await session.page.evaluate(() => document.body?.innerText || "");

      // Check WAF signatures
      if (
        pageContent.includes("errors.edgesuite.net") ||
        pageContent.includes("Access Denied") ||
        pageContent.includes("403 Forbidden") ||
        status === 403
      ) {
        await connectorUsageService.recordConnectorHarvest({
          connectorName: this.name,
          targetUrl,
          status: "BLOCKED",
          jobsFoundCount: 0,
          qualityGatePassCount: 0,
          durationMs: Date.now() - crawlStart,
          errorMessage: "WAF challenge or Access Denied signature",
        });
        this.reportStructuredError(
          new Error(`Access denied or WAF block at ${targetUrl}`),
          "SOURCE_BLOCKED",
          correlationId
        );
        return [];
      }

      if (this.detectCaptcha(pageContent) || this.detectCaptcha(pageText)) {
        await connectorUsageService.recordConnectorHarvest({
          connectorName: this.name,
          targetUrl,
          status: "BLOCKED",
          jobsFoundCount: 0,
          qualityGatePassCount: 0,
          durationMs: Date.now() - crawlStart,
          errorMessage: "CAPTCHA challenge detected",
        });
        this.reportStructuredError(
          new Error(`Verification challenge detected at ${targetUrl}`),
          "CAPTCHA_DETECTED",
          correlationId
        );
        return [];
      }

      // 4. Secondary Workday Link Detection in DOM
      const workdaySubUrl = await session.page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll("a"));
        const wdLink = anchors.find((a) => /myworkdayjobs\.com/i.test(a.href));
        return wdLink ? wdLink.href : null;
      });

      if (workdaySubUrl) {
        const subWdJobs = await this.tryWorkdayCxsHarvest(workdaySubUrl);
        if (subWdJobs.length > 0) {
          const validated = validateAndNormalizeExtractionBatch(subWdJobs, { allowLocalForTests: true });
          return toRawJobCandidates([...validated.valid, ...validated.partial], workdaySubUrl, "Workday");
        }
      }

      // 5. DOM-Level Job Extraction
      const rawDomJobs = await session.page.evaluate(() => {
        const results: Array<{
          title: string;
          href: string;
          snippet: string;
          company?: string;
          location?: string;
        }> = [];

        const seenUrls = new Set<string>();

        // Look for anchor tags with job-like identifiers
        const anchors = Array.from(document.querySelectorAll("a"));
        for (const a of anchors) {
          const href = a.href || "";
          const text = a.innerText.trim();

          const isJobHref =
            /(\/job\/|\/jobs\/|\/careers\/apply|\/position\/|\/positions\/|\/opening\/|\/openings\/|job[iI]d=|\/requisition\/|\/details\/|\/apply\/)/i.test(href);

          if (isJobHref && text.length >= 3 && !seenUrls.has(href)) {
            // Filter out navigation boilerplate
            if (/^(apply|apply now|view job|read more|details|learn more|click here|jobs|careers|back|next|previous)$/i.test(text)) {
              // Try getting title from parent container
              const parent = a.closest("li, tr, [class*='job'], [class*='card'], div");
              const heading = parent?.querySelector("h1, h2, h3, h4, [class*='title']");
              const derivedTitle = heading ? (heading as HTMLElement).innerText.trim() : "";
              if (derivedTitle && derivedTitle.length > 3) {
                seenUrls.add(href);
                results.push({
                  title: derivedTitle,
                  href,
                  snippet: parent ? (parent as HTMLElement).innerText.slice(0, 300) : text,
                });
              }
              continue;
            }

            seenUrls.add(href);
            // Grab surrounding card context if available
            const card = a.closest("li, tr, [class*='job'], [class*='card'], article, div");
            const snippet = card ? (card as HTMLElement).innerText.slice(0, 300) : text;

            let extractedTitle = text;
            let extractedCompany = "";
            let extractedLocation = "";

            if (text.includes("\n")) {
              const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
              if (lines.length > 0) {
                extractedTitle = lines[0];
                if (lines.length > 1 && lines[1].length < 80) extractedCompany = lines[1];
                if (lines.length > 2 && lines[2].length < 80) extractedLocation = lines[2];
              }
            } else {
              const heading = a.querySelector("h1, h2, h3, h4, [class*='title']");
              if (heading && (heading as HTMLElement).innerText.trim().length > 3) {
                extractedTitle = (heading as HTMLElement).innerText.trim();
              }
            }

            results.push({
              title: extractedTitle,
              href,
              snippet,
              company: extractedCompany,
              location: extractedLocation,
            });
          }
        }
        return results;
      });

      const harvested: RawJobCandidate[] = [];
      const parsedBase = new URL(targetUrl);
      const defaultDomain = parsedBase.hostname.replace(/^www\./i, "").split(".")[0];
      const fallbackCompany = defaultDomain.charAt(0).toUpperCase() + defaultDomain.slice(1);

      if (rawDomJobs.length > 0) {
        for (const j of rawDomJobs.slice(0, 40)) {
          const exp = deduceExperienceLevel(j.title);
          const workMode = deduceWorkMode(j.title, j.snippet);
          const oppType = exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME";

          harvested.push({
            sourcePlatform: "Career Portal",
            sourceUrl: targetUrl,
            applyUrl: j.href,
            externalJobId: j.href,
            title: j.title,
            companyName: j.company || fallbackCompany,
            location: j.location || "On-site / Various",
            workMode,
            experienceLevel: exp,
            opportunityType: oppType,
            description: j.snippet || `${j.title} at ${fallbackCompany}`,
            rawSnippet: j.snippet.slice(0, 300),
            discoveredAt: new Date(),
            postedAt: new Date(),
          });
        }
      }

      // 6. LLM-Assisted Extraction if DOM yielded 0 or sparse candidates
      if (harvested.length === 0 && pageText.length > 200) {
        const llmJobs = await this.extractWithLlm(pageText, targetUrl, fallbackCompany, context?.userId);
        harvested.push(...llmJobs);
      }

      // 7. Upstream Canonical Validation & Normalization
      const validationBatch = validateAndNormalizeExtractionBatch(harvested, { allowLocalForTests: true });
      const validCount = validationBatch.valid.length + validationBatch.partial.length;
      await connectorUsageService.recordConnectorHarvest({
        connectorName: this.name,
        targetUrl,
        status: harvested.length > 0 ? "SUCCESS" : "EMPTY",
        jobsFoundCount: harvested.length,
        qualityGatePassCount: validCount,
        durationMs: Date.now() - crawlStart,
      });
      return toRawJobCandidates([...validationBatch.valid, ...validationBatch.partial], targetUrl, "Career Portal");
    } finally {
      await session.close().catch(() => {});
    }
  }

  /**
   * Fast-path Workday CXS harvest for organizations hosting careers on myworkdayjobs.com
   */
  private async tryWorkdayCxsHarvest(url: string): Promise<RawJobCandidate[]> {
    try {
      const match = url.match(/https?:\/\/([^/]+)\.myworkdayjobs\.com\/(?:[a-zA-Z-]+(?:\/|\?))?([a-zA-Z0-9_]+)/i);
      if (!match) return [];

      const host = `${match[1]}.myworkdayjobs.com`;
      const tenant = match[1].split(".")[0];
      const site = match[2];

      const cxsEndpoint = `https://${host}/wday/cxs/${tenant}/${site}/jobs`;
      const res = await fetch(cxsEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
      });

      if (!res.ok) return [];
      const data = (await res.json()) as any;
      if (!data || !Array.isArray(data.jobPostings)) return [];

      const companyName = tenant.toUpperCase();
      return data.jobPostings.map((j: any): RawJobCandidate => {
        const title = j.title || "Opportunity";
        const loc = j.locationsText || "Various Locations";
        const applyUrl = `https://${host}/en-US/${site}${j.externalPath}`;
        const exp = deduceExperienceLevel(title);

        return {
          sourcePlatform: "Workday",
          sourceUrl: url,
          applyUrl,
          externalJobId: String(j.bulletFields?.[0] || j.externalPath || ""),
          title,
          companyName,
          location: loc,
          workMode: deduceWorkMode(title, loc),
          experienceLevel: exp,
          opportunityType: exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME",
          description: `${title} at ${companyName}. Location: ${loc}. Posted: ${j.postedOn || "Recently"}`,
          rawSnippet: `${title} - ${loc}`,
          discoveredAt: new Date(),
          postedAt: new Date(),
          postedAgoText: j.postedOn || null,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Fallback extraction using configured Gemini model over rendered text
   */
  private async extractWithLlm(
    pageText: string,
    targetUrl: string,
    fallbackCompany: string,
    userId?: string | null
  ): Promise<RawJobCandidate[]> {
    try {
      const apiKey = await resolveGeminiApiKey(null, userId);
      if (!apiKey) return [];

      const ai = createGeminiClient(apiKey);
      const distilled = pageText.slice(0, 10000).replace(/\s+/g, " ").trim();

      const prompt = `You are a job posting extraction agent. Extract real, active job opportunities from the following careers page text.
Target URL: ${targetUrl}
Default Employer: ${fallbackCompany}

Text Content:
${distilled}

Extract a JSON array of up to 15 job postings:
[
  {
    "title": "Exact Job Title",
    "companyName": "Employer Name",
    "location": "Location (City, State, or Remote)",
    "applyUrl": "Absolute URL or relative link to apply/view",
    "description": "Brief 1-2 sentence description",
    "postedAgoText": "e.g. 2 days ago, or null"
  }
]
Output ONLY a valid JSON array. If no genuine job postings are found, return [].`;

      let responseText: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        responseText = res.text;
      } catch {
        const fbRes = await ai.models.generateContent({
          model: FALLBACK_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        responseText = fbRes.text;
      }

      if (!responseText) return [];
      const cleanJson = responseText.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(cleanJson);

      if (!Array.isArray(parsed)) return [];

      return parsed.map((item: any): RawJobCandidate => {
        let applyUrl = item.applyUrl || targetUrl;
        if (applyUrl.startsWith("/")) {
          const origin = new URL(targetUrl).origin;
          applyUrl = `${origin}${applyUrl}`;
        }

        const exp = deduceExperienceLevel(item.title);
        const loc = item.location || "On-site / Various";

        return {
          sourcePlatform: "Career Portal",
          sourceUrl: targetUrl,
          applyUrl,
          externalJobId: applyUrl,
          title: item.title,
          companyName: item.companyName || fallbackCompany,
          location: loc,
          workMode: deduceWorkMode(item.title, loc),
          experienceLevel: exp,
          opportunityType: exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME",
          description: item.description || `${item.title} at ${item.companyName || fallbackCompany}`,
          rawSnippet: (item.description || item.title).slice(0, 300),
          discoveredAt: new Date(),
          postedAt: new Date(),
          postedAgoText: item.postedAgoText || null,
        };
      });
    } catch {
      return [];
    }
  }

  private filterCandidates(candidates: RawJobCandidate[], intent: SearchIntent): RawJobCandidate[] {
    const queryRoles = [
      ...(intent.roles || []),
      ...(intent.role ? [intent.role] : []),
    ].map((r) => r.toLowerCase().trim()).filter(Boolean);

    const queryWorkMode = intent.workMode && intent.workMode !== "ANY" ? intent.workMode : null;
    const queryExp = intent.experienceLevel && intent.experienceLevel !== "ANY" ? intent.experienceLevel : null;

    if (queryRoles.length === 0 && !queryWorkMode && !queryExp) {
      return candidates;
    }

    return candidates.filter((c) => {
      const titleLower = c.title.toLowerCase();

      if (queryExp && c.experienceLevel && c.experienceLevel !== "ANY") {
        if (queryExp === "INTERN" && c.experienceLevel !== "INTERN") return false;
      }

      if (queryWorkMode && c.workMode && c.workMode !== "ANY") {
        if (queryWorkMode !== c.workMode) return false;
      }

      if (queryRoles.length > 0) {
        const matchesRole = queryRoles.some((r) => {
          const words = r.split(/\s+/).filter((w) => w.length > 2);
          return words.some((w) => titleLower.includes(w));
        });
        if (!matchesRole) return false;
      }

      return true;
    });
  }
}

export const careerPortalBrowserConnector = new CareerPortalBrowserConnector();
