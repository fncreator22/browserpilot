/**
 * §DEEPREACH CHANNEL: TWITTER / X
 * Zero-fee public hiring announcements, founder threads, and hiring manager scouting via Jina Reader & public bridges.
 * Extracts role titles, requirements, and direct application links.
 */

import type { 
  VerifiableJobCandidate, 
  VerifiableRecruiterContact 
} from "@/lib/verification/midwayVerifier";
import { fetchViaJinaReader } from "../jinaReader";
import type { 
  DeepReachChannelAdapter, 
  DeepReachChannelParams, 
  DeepReachChannelResult 
} from "./types";

export function parseTwitterHiringPostsFromText(
  pageText: string,
  companyName: string,
  fallbackRole: string = "Engineer"
): { jobs: VerifiableJobCandidate[]; recruiters: VerifiableRecruiterContact[] } {
  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const seenUrls = new Set<string>();
  const seenHandles = new Set<string>();

  // Extract status links: https://x.com/username/status/123456789 or https://twitter.com/username/status/123456789
  // In markdown: [Text](https://x.com/username/status/123456789)
  const tweetRegex = /(?:\[([^\]]+)\]\()?https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,20})\/status\/(\d+)\)?/gi;
  let match: RegExpExecArray | null;

  // Split into lines/paragraphs to capture surrounding context for each tweet
  const paragraphs = pageText.split(/\n\s*\n/);

  while ((match = tweetRegex.exec(pageText)) !== null) {
    const rawAnchorText = match[1]?.trim() || "";
    const username = match[2].trim();
    const statusId = match[3].trim();
    const tweetUrl = `https://x.com/${username}/status/${statusId}`;

    if (seenUrls.has(tweetUrl)) continue;
    seenUrls.add(tweetUrl);

    // Find the paragraph containing this tweet URL to extract full text context
    const contextPara = paragraphs.find((p) => p.includes(statusId) || p.includes(username)) || rawAnchorText;

    // Extract any embedded application link inside this paragraph (e.g. Lever, Greenhouse, Ashby, company career page)
    const embeddedUrlMatches = contextPara.match(/https?:\/\/(?!x\.com|twitter\.com|t\.co)[^\s"')>]+/gi) || [];
    const directApplyUrl = embeddedUrlMatches[0]?.replace(/[.,;]$/, "") || tweetUrl;

    // Detect role title from tweet context or fallback
    let detectedRole = fallbackRole;
    const roleMatch = contextPara.match(/hiring\s+(?:a\s+|an\s+)?([A-Za-z0-9\s/]+(?:Engineer|Developer|Designer|Architect|Lead|Manager|Intern))/i);
    if (roleMatch && roleMatch[1] && roleMatch[1].trim().length < 40) {
      detectedRole = roleMatch[1].trim();
    }

    // Extract requirements or tech stack hints
    const techStackHints: string[] = [];
    const keywords = ["TypeScript", "React", "Next.js", "Node", "Python", "Rust", "Go", "Kubernetes", "AWS", "AI", "LLM", "SQL"];
    for (const kw of keywords) {
      if (new RegExp(`\\b${kw}\\b`, "i").test(contextPara)) {
        techStackHints.push(kw);
      }
    }

    const description = contextPara.length > 30 
      ? contextPara.replace(/\s+/g, " ").trim().slice(0, 300)
      : `Public hiring announcement on X by @${username} for ${detectedRole} at ${companyName}.`;

    jobs.push({
      title: `${detectedRole} (Hiring Thread)`,
      companyName,
      applyUrl: directApplyUrl,
      sourceUrl: tweetUrl,
      sourcePlatform: "X",
      workMode: contextPara.toLowerCase().includes("remote") ? "REMOTE" : "ANY",
      description: techStackHints.length > 0
        ? `${description} (Stack: ${techStackHints.join(", ")})`
        : description,
    });

    // Add hiring manager / founder contact if handle is valid
    const cleanHandle = username.toLowerCase();
    if (!seenHandles.has(cleanHandle) && !["search", "i", "home", "explore"].includes(cleanHandle)) {
      seenHandles.add(cleanHandle);
      const isFounder = /founder|ceo|cto|co-founder/i.test(contextPara);
      const role = isFounder ? "Founder / Executive (X)" : "Hiring Manager / Team Lead (X)";

      recruiters.push({
        fullName: `@${username}`,
        roleTitle: role,
        companyName,
        profileUrl: `https://x.com/${username}`,
        department: "Engineering Leadership",
        sourcePlatform: "X",
      });
    }
  }

  return { jobs, recruiters };
}

export async function scanTwitterChannel(
  params: DeepReachChannelParams
): Promise<DeepReachChannelResult> {
  const { 
    companyName, 
    roleTitle = "Software Engineer", 
    maxResults = 10,
    timeoutMs = 6000, 
    fetcher = fetchViaJinaReader 
  } = params;

  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const sourceUrls: string[] = [];
  const errors: string[] = [];

  // Query public hiring tweets, threads, and founder posts via DuckDuckGo + Jina Reader
  const searchQueries = [
    `"${companyName}" ("we're hiring" OR "hiring" OR "join us") ("${roleTitle}" OR engineer) site:x.com`,
    `"${companyName}" ("founder" OR "CTO" OR "Engineering Manager") hiring site:x.com`,
  ];

  for (const query of searchQueries) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    sourceUrls.push(searchUrl);

    try {
      const pageText = await fetcher(searchUrl, timeoutMs);
      if (pageText) {
        const { jobs: parsedJobs, recruiters: parsedRecruiters } = parseTwitterHiringPostsFromText(
          pageText, 
          companyName, 
          roleTitle
        );
        jobs.push(...parsedJobs);
        recruiters.push(...parsedRecruiters);
      }
    } catch (err) {
      errors.push(`Twitter/X scan error: ${(err as Error).message}`);
    }
  }

  // Deduplicate across search queries
  const uniqueJobs = Array.from(
    new Map(jobs.map((j) => [j.applyUrl.toLowerCase(), j])).values()
  );
  const uniqueRecruiters = Array.from(
    new Map(recruiters.map((r) => [r.profileUrl.toLowerCase(), r])).values()
  );

  return {
    channelName: "Twitter/X Hiring Radar",
    sourcePlatform: "X",
    jobs: uniqueJobs.slice(0, maxResults),
    recruiters: uniqueRecruiters.slice(0, maxResults),
    sourceUrls,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export const twitterChannel: DeepReachChannelAdapter = {
  id: "deepreach-twitter",
  name: "Twitter/X Hiring Radar",
  sourcePlatform: "X",
  description: "Scrapes public founder threads, hiring announcements, and tech leads on X.",
  scan: scanTwitterChannel,
};
