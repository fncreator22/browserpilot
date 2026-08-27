/**
 * §AUTONOMOUS SEARCH & URL RESOLVER
 * Resolves natural language entity queries to real landing page URLs
 * using organic search extraction when no explicit URL is provided in the prompt.
 */

export interface ResolvedTarget {
  url: string;
  domain: string;
  source: "DIRECT_URL" | "ORGANIC_SEARCH" | "DEFAULT_FALLBACK";
  queryUsed?: string;
  title?: string;
  snippet?: string;
}

/**
 * Extracts explicit URLs from natural language prompt if present
 */
export function extractUrlFromText(text: string): string | null {
  if (!text) return null;
  const urlRegex = /(https?:\/\/[^\s\),"'<>]+)/i;
  const match = text.match(urlRegex);
  if (match && match[1]) {
    try {
      const parsed = new URL(match[1]);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {}
  }
  return null;
}

/**
 * Autonomous Search Resolver: Discovers the optimal target URL from a query
 */
export async function resolveTargetUrl(
  prompt: string,
  searchHint?: string
): Promise<ResolvedTarget> {
  // 1. Check for explicit URL in prompt or hint
  const explicitUrl = extractUrlFromText(prompt) || (searchHint ? extractUrlFromText(searchHint) : null);
  if (explicitUrl) {
    const domain = new URL(explicitUrl).hostname.toLowerCase();
    return {
      url: explicitUrl,
      domain,
      source: "DIRECT_URL",
    };
  }

  // 2. Perform organic search discovery via DuckDuckGo HTML endpoint
  const query = searchHint || prompt;
  const cleanQuery = query
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const response = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const html = await response.text();

      // Extract first organic result link from DuckDuckGo HTML
      // Format: <a class="result__url" href="..."> or <a class="result__snippet" ...>
      const resultLinkRegex = /<a[^>]*class=["'][^"']*result__url[^"']*["'][^>]*href=["']([^"']+)["']/i;
      const snippetRegex = /<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i;

      const linkMatch = html.match(resultLinkRegex);
      const snippetMatch = html.match(snippetRegex);

      if (linkMatch && linkMatch[1]) {
        let rawHref = linkMatch[1];
        // DuckDuckGo redirects: //duckduckgo.com/l/?uddg=https%3A%2F%2F...
        if (rawHref.includes("uddg=")) {
          const params = new URL(`https://duckduckgo.com${rawHref}`).searchParams;
          const decoded = params.get("uddg");
          if (decoded) rawHref = decoded;
        } else if (rawHref.startsWith("//")) {
          rawHref = `https:${rawHref}`;
        }

        const resolvedUrl = new URL(rawHref).toString();
        const domain = new URL(resolvedUrl).hostname.toLowerCase();
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : undefined;

        return {
          url: resolvedUrl,
          domain,
          source: "ORGANIC_SEARCH",
          queryUsed: cleanQuery,
          snippet,
        };
      }
    }
  } catch (err) {
    console.warn(`[SearchResolver] Organic search resolution timed out or failed for "${cleanQuery}":`, err);
  }

  // 3. Fallback: If search fails, synthesize a direct Google Search URL
  const fallbackUrl = `https://www.google.com/search?q=${encodeURIComponent(cleanQuery)}`;
  return {
    url: fallbackUrl,
    domain: "google.com",
    source: "DEFAULT_FALLBACK",
    queryUsed: cleanQuery,
  };
}
