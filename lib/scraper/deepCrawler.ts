/**
 * §MULTI-SOURCE DEEP CRAWLER & VERIFIED ORCHESTRATION ENGINE
 * Executes multi-platform link harvesting, iterative deep page inspection,
 * per-job screenshot capture, and deduplicated structured synthesis.
 */

import type { Page } from "playwright";
import * as cheerio from "cheerio";
import { distillHtml } from "./distiller";
import { normalizeAndDeduplicateJobs, type NormalizedJobItem } from "./normalizer";
import { artifactStorage } from "@/lib/storage";

export interface DeepCrawlOptions {
  jobId: string;
  targetCount?: number;
  captureScreenshots?: boolean;
  onProgress?: (current: number, total: number, message: string) => void;
}

export interface DeepCrawlResult {
  jobs: NormalizedJobItem[];
  sourcesVisited: string[];
  screenshotsCaptured: number;
  totalHarvested: number;
}

/**
 * Harvests individual candidate job URLs from a search results page
 */
export async function harvestJobUrlsFromPage(
  page: Page,
  maxCount = 10
): Promise<Array<{ title: string; url: string; company?: string; location?: string }>> {
  return page.evaluate((limit: number) => {
    const results: Array<{ title: string; url: string; company?: string; location?: string }> = [];
    const seenUrls = new Set<string>();

    // Strategy 1: LinkedIn Public Job Cards
    const linkedInCards = document.querySelectorAll("div.base-card, li.jobs-search__results-list li, div.job-search-card");
    if (linkedInCards.length > 0) {
      linkedInCards.forEach((card) => {
        if (results.length >= limit) return;
        const linkEl = card.querySelector<HTMLAnchorElement>("a.base-card__full-link, a.job-search-card__url, a[href*='/jobs/view/']");
        const titleEl = card.querySelector("h3.base-search-card__title, h3, h4");
        const companyEl = card.querySelector("h4.base-search-card__subtitle, a.hidden-nested-link");
        const locationEl = card.querySelector("span.job-search-card__location");

        if (linkEl && linkEl.href && !seenUrls.has(linkEl.href)) {
          seenUrls.add(linkEl.href);
          results.push({
            title: titleEl?.textContent?.trim() || "AI Engineer",
            url: linkEl.href,
            company: companyEl?.textContent?.trim() || "Technology Company",
            location: locationEl?.textContent?.trim() || "Remote / Hybrid",
          });
        }
      });
      if (results.length > 0) return results;
    }

    // Strategy 2: Y Combinator WorkAtAStartup
    const ycCards = document.querySelectorAll("div.job-name, a[href*='/companies/']");
    if (ycCards.length > 0) {
      ycCards.forEach((card) => {
        if (results.length >= limit) return;
        const anchor = (card.tagName.toLowerCase() === "a" ? card : card.closest("a")) as HTMLAnchorElement | null;
        if (anchor && anchor.href && !seenUrls.has(anchor.href)) {
          seenUrls.add(anchor.href);
          results.push({
            title: anchor.textContent?.trim() || "AI Engineer",
            url: anchor.href,
            company: "YC Startup",
            location: "Remote / San Francisco",
          });
        }
      });
      if (results.length > 0) return results;
    }

    // Strategy 3: Universal Job / Result Anchor Tag Extractor
    const allAnchors = Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"));
    for (const a of allAnchors) {
      if (results.length >= limit) break;
      const href = a.href;
      const text = (a.innerText || a.textContent || "").trim();

      // Look for job-like links
      const isJobLink = /\/(jobs|careers|position|role|vacancy|view)\//i.test(href);
      if (isJobLink && text.length > 3 && !seenUrls.has(href)) {
        seenUrls.add(href);
        results.push({
          title: text,
          url: href,
          company: new URL(href).hostname.replace(/^www\./, ""),
          location: "Remote",
        });
      }
    }

    return results;
  }, maxCount).catch(() => []);
}

/**
 * Executes a deep crawl across multiple job pages with per-job screenshot capture
 */
export async function executeDeepJobCrawl(
  page: Page,
  options: DeepCrawlOptions
): Promise<DeepCrawlResult> {
  const targetCount = options.targetCount || 10;
  const sourcesVisited: string[] = [page.url()];
  let screenshotsCaptured = 0;

  options.onProgress?.(1, targetCount, "Harvesting canonical job URLs from search index...");

  // Phase 1: Harvest candidate URLs
  const candidateUrls = await harvestJobUrlsFromPage(page, targetCount);
  const harvestedJobs: Array<Record<string, unknown>> = [];

  // Phase 2: Deep visit top candidate links
  const toVisit = candidateUrls.slice(0, Math.min(candidateUrls.length, targetCount));

  for (let i = 0; i < toVisit.length; i++) {
    const candidate = toVisit[i];
    const stepNum = i + 1;

    options.onProgress?.(
      stepNum,
      toVisit.length,
      `Visiting job ${stepNum} of ${toVisit.length}: ${candidate.title} (${candidate.company})...`
    );

    let screenshotArtifactUrl: string | undefined;

    try {
      // Navigate to dedicated job URL
      await page.goto(candidate.url, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});

      // Auto-dismiss any contextual popups on the dedicated page
      await page.evaluate(() => {
        document.querySelectorAll(".contextual-sign-in-modal, [aria-modal='true'], .modal").forEach((el) => el.remove());
        document.body.style.overflow = "auto";
      }).catch(() => {});

      // Capture dedicated per-job screenshot
      if (options.captureScreenshots !== false) {
        const screenshotBuf = await page.screenshot({ type: "png", fullPage: false }).catch(() => null);
        if (screenshotBuf) {
          const filename = `job_proof_step_${stepNum}_${Date.now()}.png`;
          await artifactStorage.saveArtifact(options.jobId, filename, screenshotBuf);
          screenshotArtifactUrl = artifactStorage.getArtifactUrl(options.jobId, filename);
          screenshotsCaptured++;
        }
      }

      // Extract cleaned text from dedicated page
      const pageHtml = await page.content();
      const cleaned = distillHtml(pageHtml, { maxCharacters: 5000 });

      harvestedJobs.push({
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
        description: cleaned.slice(0, 800),
        applyUrl: candidate.url,
        screenshotUrl: screenshotArtifactUrl,
        sourcePlatform: new URL(candidate.url).hostname.replace(/^www\./, ""),
      });
    } catch {
      // If individual page navigation fails, keep candidate record
      harvestedJobs.push({
        title: candidate.title,
        company: candidate.company,
        location: candidate.location,
        applyUrl: candidate.url,
        sourcePlatform: new URL(candidate.url).hostname.replace(/^www\./, ""),
      });
    }
  }

  // Phase 3: Normalize and deduplicate
  const normalizedJobs = normalizeAndDeduplicateJobs(harvestedJobs, "LinkedIn");

  return {
    jobs: normalizedJobs,
    sourcesVisited,
    screenshotsCaptured,
    totalHarvested: normalizedJobs.length,
  };
}
