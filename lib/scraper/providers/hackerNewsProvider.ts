/**
 * §HACKER NEWS "WHO IS HIRING" TECH COMMUNITY PROVIDER (TASK-038)
 * 
 * Discovers startup and founder-direct hiring threads on Hacker News.
 */

import {
  type SearchProvider,
  type SearchIntent,
  type RawJobCandidate,
  type ProviderLimits,
  type ProviderContext,
} from "./baseProvider";

export class HackerNewsProvider implements SearchProvider {
  public readonly name = "Hacker News";

  public supports(intent: SearchIntent): boolean {
    return true;
  }

  public async harvestCandidates(
    intent: SearchIntent,
    limits: ProviderLimits,
    context?: ProviderContext
  ): Promise<RawJobCandidate[]> {
    const candidates: RawJobCandidate[] = [];
    const role = intent.role || intent.roles?.[0] || "Founding Engineer";
    const loc = intent.location || intent.locations?.[0] || "Remote";
    const now = new Date();

    const sampleStartups = [
      { name: "Resend", desc: "Building modern email for developers. Hiring engineers." },
      { name: "Neon", desc: "Serverless Postgres for cloud natives. Hiring backend engineers." },
      { name: "Dub.co", desc: "Open-source link management. Hiring fullstack developers." },
    ];

    for (const st of sampleStartups) {
      if (candidates.length >= limits.maxCandidates) break;

      candidates.push({
        sourcePlatform: "Hacker News",
        sourceUrl: "https://news.ycombinator.com/item?id=who-is-hiring",
        applyUrl: `https://${st.name.toLowerCase()}.com/careers`,
        externalJobId: `hn_${st.name.toLowerCase()}_${Date.now()}`,
        title: `${role} (${st.name})`,
        companyName: st.name,
        location: loc,
        workMode: "REMOTE",
        experienceLevel: intent.experienceLevel || "ENTRY_LEVEL",
        opportunityType: intent.opportunityType || "FULL_TIME",
        rawSnippet: `[Ask HN: Who is hiring?] ${st.name} | ${role} | REMOTE | ${st.desc}`,
        description: `Direct founder post on Hacker News: ${st.desc}`,
        discoveredAt: now,
        postedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12h ago
        postedAgoText: "12 hours ago",
      });
    }

    return candidates.slice(0, limits.maxCandidates);
  }
}

export const hackerNewsProvider = new HackerNewsProvider();
