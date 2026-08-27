/**
 * §AUTONOMOUS SEARCH & URL RESOLVER (Ad-Filtering & Platform-Smart)
 * Resolves natural language entity queries to real landing page URLs
 * using deterministic direct platform mapping + DuckDuckGo HTML fallback with strict ad filtering.
 */

export interface ResolvedTarget {
  url: string;
  domain: string;
  source: "DIRECT_URL" | "PLATFORM_MAPPED" | "ORGANIC_SEARCH" | "DEFAULT_FALLBACK";
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
 * Extracts search keywords from a conversational prompt (strips conversational filler)
 */
export function extractKeywordsFromPrompt(prompt: string): string {
  return prompt
    .replace(/\b(go\s*to|find\s*me|search\s*for|look\s*up|get\s*me|give\s*me|scrape|atleast|at\s*least|\d+\s*(of\s*the\s*)?links|to\s*fill|jobs?|roles?|under\s*the\s*roles?\s*of|internships?|openings?)\b/gi, " ")
    .replace(/\b(linkedin|github|wikipedia|indeed|amazon|google|ycombinator|yc)\b/gi, " ")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

  const lower = prompt.toLowerCase();
  const keywords = extractKeywordsFromPrompt(prompt) || "AI Engineer";

  // 2. Direct Platform URL Mappings (Zero-Search Direct Navigation)
  if (lower.includes("github")) {
    const url = `https://github.com/search?q=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "github.com",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

  if (lower.includes("ycombinator") || lower.includes("yc") || lower.includes("workatastartup")) {
    const url = `https://www.workatastartup.com/companies?query=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "workatastartup.com",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

  if (lower.includes("indeed")) {
    const url = `https://www.indeed.com/jobs?q=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "indeed.com",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

  if (lower.includes("wikipedia") || lower.includes("wiki")) {
    const url = `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "wikipedia.org",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

  // 3. Smart Intent Detection: If prompt is asking for jobs/roles/internships (even without naming LinkedIn)
  const isJobQuery = /\b(job|jobs|role|roles|intern|internship|internships|hire|hiring|career|careers|vacancy|position|positions)\b/i.test(lower);
  if (isJobQuery) {
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "linkedin.com",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

  // 4. Perform organic search discovery via DuckDuckGo HTML endpoint with strict Ad filtering
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

      // Extract all result links and filter out ad/tracking URLs (e.g. y.js, ad_domain)
      const linkRegex = /<a[^>]*class=["'][^"']*(?:result__url|result__snippet)[^"']*["'][^>]*href=["']([^"']+)["']/gi;
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        let rawHref = match[1];

        // Skip ads and tracking scripts
        if (rawHref.includes("/y.js") || rawHref.includes("ad_domain") || rawHref.includes("ad_provider") || rawHref.includes("bingv7aa")) {
          continue;
        }

        if (rawHref.includes("uddg=")) {
          const params = new URL(`https://duckduckgo.com${rawHref}`).searchParams;
          const decoded = params.get("uddg");
          if (decoded) rawHref = decoded;
        } else if (rawHref.startsWith("//")) {
          rawHref = `https:${rawHref}`;
        }

        try {
          const resolvedUrl = new URL(rawHref).toString();
          const domain = new URL(resolvedUrl).hostname.toLowerCase();

          return {
            url: resolvedUrl,
            domain,
            source: "ORGANIC_SEARCH",
            queryUsed: cleanQuery,
          };
        } catch {}
      }
    }
  } catch (err) {
    console.warn(`[SearchResolver] Organic DuckDuckGo search timed out:`, err);
  }

  // 5. Default Fallback
  return {
    url: `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`,
    domain: "duckduckgo.com",
    source: "DEFAULT_FALLBACK",
    queryUsed: cleanQuery,
  };
}
