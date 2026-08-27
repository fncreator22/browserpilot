/**
 * §MULTI-PAGE AUTONOMOUS CRAWLER & PAGINATION ENGINE
 * Automatically discovers next-page links, executes dynamic pagination or infinite scroll,
 * and aggregates structured dataset rows across multiple pages with deduplication.
 */

import type { Page } from "playwright";
import { distillHtml } from "./distiller";
import { extractStructuredData, type InferredExtractionSchema } from "./schemaInferrer";

export interface CrawlOptions {
  maxPages?: number;
  maxItems?: number;
  scrollPerPauseMs?: number;
  apiKey?: string;
  onPageProgress?: (currentPage: number, totalExtracted: number) => void;
}

export interface CrawlResult {
  pagesVisited: number;
  totalItems: number;
  items: Array<Record<string, unknown>>;
  errors: string[];
}

/**
 * Autonomous Multi-Page Crawler
 */
export async function crawlMultiPageDataset(
  page: Page,
  schema: InferredExtractionSchema,
  goal: string,
  options: CrawlOptions = {}
): Promise<CrawlResult> {
  const maxPages = options.maxPages || 5;
  const maxItems = options.maxItems || 200;
  const allItems: Array<Record<string, unknown>> = [];
  const errors: string[] = [];

  let currentPageNum = 1;

  while (currentPageNum <= maxPages && allItems.length < maxItems) {
    options.onPageProgress?.(currentPageNum, allItems.length);

    try {
      // 1. Extract and distill current page HTML
      const rawHtml = await page.content();
      const cleaned = distillHtml(rawHtml, { maxCharacters: 30000 });

      // 2. Extract structured rows for this page
      const dataset = await extractStructuredData(cleaned, schema, goal, options.apiKey);

      if (dataset.items && dataset.items.length > 0) {
        // Deduplicate items based on JSON fingerprint
        for (const item of dataset.items) {
          const itemJson = JSON.stringify(item);
          const isDuplicate = allItems.some((existing) => JSON.stringify(existing) === itemJson);
          if (!isDuplicate) {
            allItems.push(item);
          }
        }
      }

      if (allItems.length >= maxItems) break;

      // 3. Attempt to find and click "Next Page" button or trigger scroll
      const hasNextPage = await navigateToNextPage(page);
      if (!hasNextPage) {
        // Try infinite scroll if no next button was found
        const scrollSuccess = await triggerInfiniteScroll(page);
        if (!scrollSuccess) break; // Reached end of content
      }

      currentPageNum++;
      await page.waitForTimeout(2000); // Polite delay between pages
    } catch (err) {
      errors.push(`Page ${currentPageNum} error: ${(err as Error).message}`);
      break;
    }
  }

  return {
    pagesVisited: currentPageNum,
    totalItems: allItems.length,
    items: allItems,
    errors,
  };
}

/**
 * Detects and clicks next-page pagination links
 */
async function navigateToNextPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const nextSelectors = [
      "a[rel='next']",
      "link[rel='next']",
      "a[aria-label*='Next' i]",
      "button[aria-label*='Next' i]",
      "a.next",
      "button.next",
      ".pagination-next a",
      ".pagination__next a",
      "a:has-text('Next')",
      "a:has-text('Older')",
      "button:has-text('Next')",
    ];

    for (const sel of nextSelectors) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el && el.offsetParent !== null) {
        el.click();
        return true;
      }
    }
    return false;
  }).catch(() => false);
}

/**
 * Triggers infinite scroll down the page to load more lazy items
 */
async function triggerInfiniteScroll(page: Page): Promise<boolean> {
  try {
    const previousHeight = await page.evaluate(() => document.body.scrollHeight);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    return newHeight > previousHeight;
  } catch {
    return false;
  }
}
