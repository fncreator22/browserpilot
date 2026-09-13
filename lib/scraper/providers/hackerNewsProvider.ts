/**
 * §HACKER NEWS "WHO IS HIRING" TECH COMMUNITY PROVIDER
 * 
 * Harvests real, live startup and founder-direct hiring opportunities
 * from official monthly "Ask HN: Who is hiring?" threads via Algolia's public search API.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
  isSafePublicUrl,
} from "./baseProvider";

let cachedThreadId: string | null = null;
let cachedThreadTime = 0;
const THREAD_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x2F;/g, "/")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function deduceWorkMode(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(remote|work from home|wfh|anywhere|distributed)\b/i.test(lower)) return "REMOTE";
  if (/\b(hybrid|flexible)\b/i.test(lower)) return "HYBRID";
  return "ON_SITE";
}

function deduceExperienceLevel(text: string): string {
  const lower = text.toLowerCase();
  if (/\b(intern|internship|trainee|co-op)\b/i.test(lower)) return "INTERN";
  if (/\b(entry|junior|jr|graduate|grad|associate|new grad)\b/i.test(lower)) return "ENTRY_LEVEL";
  if (/\b(senior|sr|lead|principal|staff|director|head|vp)\b/i.test(lower)) return "SENIOR";
  return "MID";
}

export class HackerNewsProvider implements SearchProvider {
  public readonly name = "Hacker News";

  public supports(intent: SearchIntent): boolean {
    return true;
  }

  private async getLatestThreadId(fetchFn: typeof fetch, signal?: AbortSignal): Promise<string | null> {
    const now = Date.now();
    if (cachedThreadId && (now - cachedThreadTime < THREAD_CACHE_TTL_MS)) {
      return cachedThreadId;
    }

    try {
      const url = "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=Who%20is%20hiring&hitsPerPage=1";
      const resp = await fetchFn(url, { signal });
      if (!resp.ok) return cachedThreadId;
      const data = await resp.json();
      const firstHit = data?.hits?.[0];
      if (firstHit && firstHit.objectID) {
        cachedThreadId = String(firstHit.objectID);
        cachedThreadTime = now;
        return cachedThreadId;
      }
    } catch {
      // Fallback to cache if network drop
    }
    return cachedThreadId;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    const fetchFn = context?.customFetch || fetch;
    const signal = context?.signal || AbortSignal.timeout(limits.timeoutMs || 8000);

    try {
      const threadId = await this.getLatestThreadId(fetchFn, signal);
      if (!threadId) return [];

      const queryParts: string[] = [];
      const role = intent.role || intent.roles?.[0] || "";
      if (role) queryParts.push(role);
      if (intent.skills && intent.skills.length > 0) queryParts.push(intent.skills[0]);
      const location = intent.location || intent.locations?.[0] || "";
      if (location && location.toLowerCase() !== "remote" && location.toLowerCase() !== "any" && location.toLowerCase() !== "worldwide") {
        queryParts.push(location);
      }

      const searchQuery = queryParts.join(" ").trim() || "engineer";
      const searchUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${threadId}&query=${encodeURIComponent(searchQuery)}&hitsPerPage=${limits.maxCandidates || 15}`;

      const resp = await fetchFn(searchUrl, { signal });
      if (!resp.ok) return [];

      const data = await resp.json();
      if (!data?.hits || !Array.isArray(data.hits)) return [];

      const candidates: RawJobCandidate[] = [];

      for (const hit of data.hits) {
        if (!hit.comment_text) continue;

        const cleanText = stripHtml(hit.comment_text);
        if (cleanText.length < 40) continue;

        const firstLine = cleanText.split("\n")[0] || cleanText.slice(0, 100);
        const parts = firstLine.split(/\s*\|\s*|\s*–\s*|\s*-\s*/).map((p: string) => p.trim());

        let company = parts[0] ? parts[0].slice(0, 40) : (hit.author || "Tech Startup");
        let title = parts[1] ? parts[1].slice(0, 60) : (role || "Software Engineer");

        if (title.length < 3) title = role || "Software Engineer";
        if (company.length < 2) company = "Tech Startup";

        const urlMatch = cleanText.match(/https?:\/\/[^\s\)\"\'<>]+/);
        const applyUrl = urlMatch && isSafePublicUrl(urlMatch[0])
          ? urlMatch[0]
          : `https://news.ycombinator.com/item?id=${hit.objectID}`;

        const workMode = deduceWorkMode(cleanText);
        const exp = deduceExperienceLevel(title + " " + cleanText);

        candidates.push({
          sourcePlatform: "Hacker News",
          sourceUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
          applyUrl,
          externalJobId: String(hit.objectID),
          title,
          companyName: company,
          location: workMode === "REMOTE" ? "Remote" : "Various / See Post",
          workMode,
          experienceLevel: exp,
          opportunityType: exp === "INTERN" ? "INTERNSHIP" : "FULL_TIME",
          description: cleanText.slice(0, 2000),
          rawSnippet: cleanText.slice(0, 300),
          discoveredAt: new Date(),
          postedAt: hit.created_at ? new Date(hit.created_at) : new Date(),
        });
      }

      return candidates;
    } catch {
      return [];
    }
  }
}

export const hackerNewsProvider = new HackerNewsProvider();
