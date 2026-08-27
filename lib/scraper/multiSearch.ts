/**
 * §MULTI-DOMAIN FAN-OUT SEARCH & LINK NORMALIZER
 * Decomposes multi-source queries, extracts structured candidate records from multiple domains,
 * converts relative paths into absolute clickable links, and produces a single unified dataset.
 */

import { distillHtml } from "./distiller";
import { extractStructuredData, type InferredExtractionSchema } from "./schemaInferrer";
import { resolveTargetUrl } from "./searchResolver";

export interface MultiDomainSearchTarget {
  name: string;
  query: string;
  url?: string;
  domain: string;
}

export interface MultiSearchResult {
  sourcesVisited: string[];
  totalExtracted: number;
  items: Array<Record<string, unknown>>;
  errors: string[];
}

/**
 * Normalizes relative URLs (e.g. /jobs/view/123) into fully-qualified absolute clickable links
 */
export function normalizeLinkUrl(rawUrl: string, baseUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "";
  const trimmed = rawUrl.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  try {
    const base = new URL(baseUrl);
    return new URL(trimmed, base.origin).toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Executes a fan-out multi-source search and extracts ranked items
 */
export async function executeMultiDomainSearch(
  goal: string,
  sources: Array<{ name: string; searchKeywords: string }>,
  schema: InferredExtractionSchema,
  apiKey?: string
): Promise<MultiSearchResult> {
  const allItems: Array<Record<string, unknown>> = [];
  const sourcesVisited: string[] = [];
  const errors: string[] = [];

  for (const source of sources) {
    try {
      const resolved = await resolveTargetUrl(`${source.name} ${source.searchKeywords}`);
      if (!resolved.url) continue;

      sourcesVisited.push(source.name);

      // Fetch source page content
      const response = await fetch(resolved.url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!response.ok) continue;

      const html = await response.text();
      const cleanedMarkdown = distillHtml(html, { maxCharacters: 25000 });

      // Extract structured rows matching schema
      const dataset = await extractStructuredData(
        cleanedMarkdown,
        schema,
        `${goal} on ${source.name}`,
        apiKey
      );

      if (dataset.items && dataset.items.length > 0) {
        for (const item of dataset.items) {
          // Tag source platform
          const taggedItem: Record<string, unknown> = {
            ...item,
            sourcePlatform: source.name,
          };

          // Normalize any url / link / applyUrl fields
          for (const key of Object.keys(taggedItem)) {
            if (key.toLowerCase().includes("url") || key.toLowerCase().includes("link")) {
              const val = taggedItem[key];
              if (typeof val === "string") {
                taggedItem[key] = normalizeLinkUrl(val, resolved.url);
              }
            }
          }

          allItems.push(taggedItem);
        }
      }
    } catch (err) {
      errors.push(`Error searching ${source.name}: ${(err as Error).message}`);
    }
  }

  return {
    sourcesVisited,
    totalExtracted: allItems.length,
    items: allItems,
    errors,
  };
}
