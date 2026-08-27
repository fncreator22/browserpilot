/**
 * §AUTONOMOUS SEARCH & URL RESOLVER (Anti-Bot Resilient)
 * Resolves natural language entity queries to real landing page URLs
 * using deterministic direct platform mapping + DuckDuckGo HTML fallback (0 Google CAPTCHAs).
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
 * Extracts search keywords from a conversational prompt (strips "go to", "find me", "at least 10", etc.)
 */
export function extractKeywordsFromPrompt(prompt: string): string {
  return prompt
    .replace(/\b(go\s*to|find\s*me|search\s*for|look\s*up|get\s*me|give\s*me|scrape|atleast|at\s*least|\d+\s*(of\s*the\s*)?links|to\s*fill|jobs?|roles?|under\s*the\s*roles?\s*of)\b/gi, " ")
    .replace(/\b(linkedin|github|wikipedia|indeed|amazon|google)\b/gi, " ")
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
  if (lower.includes("linkedin")) {
    const url = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}`;
    return {
      url,
      domain: "linkedin.com",
      source: "PLATFORM_MAPPED",
      queryUsed: keywords,
    };
  }

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

  // 3. Perform organic search discovery via DuckDuckGo HTML endpoint (Never Google to avoid bot CAPTCHAs)
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
      const resultLinkRegex = /<a[^>]*class=["'][^"']*result__url[^"']*["'][^>]*href=["']([^"']+)["']/i;
      const snippetRegex = /<a[^>]*class=["'][^"']*result__snippet[^"']*["'][^>]*>([\s\S]*?)<\/a>/i;

      const linkMatch = html.match(resultLinkRegex);
      const snippetMatch = html.match(snippetRegex);

      if (linkMatch && linkMatch[1]) {
        let rawHref = linkMatch[1];
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
    console.warn(`[SearchResolver] Organic DuckDuckGo search timed out:`, err);
  }

  // 4. Default Fallback: DuckDuckGo HTML search (CAPTCHA-immune)
  const fallbackUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
  return {
    url: fallbackUrl,
    domain: "duckduckgo.com",
    source: "DEFAULT_FALLBACK",
    queryUsed: cleanQuery,
  };
}
