/**
 * §DEEPREACH CHANNEL: REDDIT
 * Zero-fee public unadvertised hiring posts, referral networks, and recruiter reachouts via Reddit's native JSON API.
 * Queries /r/forhire+cscareerquestions and global search with no API keys required.
 */

import type { 
  VerifiableJobCandidate, 
  VerifiableRecruiterContact 
} from "@/lib/verification/midwayVerifier";
import type { 
  DeepReachChannelAdapter, 
  DeepReachChannelParams, 
  DeepReachChannelResult 
} from "./types";

interface RedditPostData {
  title: string;
  selftext?: string;
  author: string;
  url: string;
  permalink: string;
  subreddit: string;
  created_utc: number;
  is_self?: boolean;
}

interface RedditListingResponse {
  data?: {
    children?: Array<{
      kind: string;
      data: RedditPostData;
    }>;
  };
}

export function parseRedditListingJson(
  rawJson: string | object,
  companyName: string,
  fallbackRole: string = "Engineer"
): { jobs: VerifiableJobCandidate[]; recruiters: VerifiableRecruiterContact[] } {
  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const seenUrls = new Set<string>();
  const seenAuthors = new Set<string>();

  let parsed: RedditListingResponse;
  try {
    parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
  } catch {
    return { jobs, recruiters };
  }

  const posts = parsed.data?.children || [];
  const companyLower = companyName.toLowerCase();

  for (const item of posts) {
    const post = item.data;
    if (!post || !post.title) continue;

    const fullText = `${post.title} ${post.selftext || ""}`.toLowerCase();

    // Verify company relevance
    if (!fullText.includes(companyLower)) continue;

    // Filter for hiring intent or referral offers (skip "For Hire" job seekers)
    const isSeekingWork = /^\[for\s*hire\]/i.test(post.title);
    const isHiring = /\[hiring\]|\bhiring\b|\breferral\b|\bopen role\b|\bwe are hiring\b/i.test(fullText);

    if (isSeekingWork && !isHiring) continue;

    // Canonical link or direct external apply link extracted from post content
    const permalink = post.permalink.startsWith("http")
      ? post.permalink
      : `https://www.reddit.com${post.permalink}`;

    // Extract any external application link inside post selftext (Lever, Ashby, Greenhouse, Careers)
    const externalLinks = (post.selftext || "").match(/https?:\/\/(?!www\.reddit\.com|reddit\.com|preview\.redd\.it)[^\s"')>]+/gi) || [];
    const directApplyUrl = (!post.is_self && post.url && !post.url.includes("reddit.com"))
      ? post.url
      : externalLinks[0]?.replace(/[.,;]$/, "") || permalink;

    if (seenUrls.has(directApplyUrl)) continue;
    seenUrls.add(directApplyUrl);

    // Clean title by removing [Hiring] tag prefixes
    const cleanTitle = post.title
      .replace(/^\[hiring\]\s*[-–:]?\s*/i, "")
      .replace(/^\[referral\]\s*[-–:]?\s*/i, "")
      .trim() || `${fallbackRole} at ${companyName}`;

    const snippet = (post.selftext || post.title).replace(/\s+/g, " ").trim().slice(0, 300);

    jobs.push({
      title: cleanTitle,
      companyName,
      applyUrl: directApplyUrl,
      sourceUrl: permalink,
      sourcePlatform: "REDDIT",
      workMode: fullText.includes("remote") ? "REMOTE" : "ANY",
      description: `Discovered on r/${post.subreddit}: ${snippet}`,
    });

    // Extract author as community referral contact / recruiter
    const author = post.author?.trim();
    if (
      author && 
      author !== "[deleted]" && 
      author.toLowerCase() !== "automoderator" && 
      !seenAuthors.has(author.toLowerCase())
    ) {
      seenAuthors.add(author.toLowerCase());
      recruiters.push({
        fullName: `u/${author}`,
        roleTitle: "Community Talent / Employee Referral (Reddit)",
        companyName,
        profileUrl: `https://www.reddit.com/user/${author}`,
        department: "Community Referral Network",
        sourcePlatform: "REDDIT",
      });
    }
  }

  return { jobs, recruiters };
}

export async function scanRedditChannel(
  params: DeepReachChannelParams
): Promise<DeepReachChannelResult> {
  const { 
    companyName, 
    roleTitle = "Software Engineer", 
    maxResults = 10,
    timeoutMs = 6000, 
    fetcher 
  } = params;

  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const sourceUrls: string[] = [];
  const errors: string[] = [];

  // 1. Query /r/forhire + /r/cscareerquestions + /r/jobbit
  const targetedUrl = `https://www.reddit.com/r/forhire+cscareerquestions+jobbit/search.json?q=${encodeURIComponent(companyName)}&restrict_sr=1&sort=new&limit=25`;
  // 2. Global Reddit search for company hiring posts
  const globalUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(`"${companyName}" (hiring OR referral OR "[Hiring]")`)}&sort=new&limit=25`;

  const queryUrls = [targetedUrl, globalUrl];

  for (const targetUrl of queryUrls) {
    sourceUrls.push(targetUrl);
    try {
      let rawText: string | null = null;

      if (fetcher) {
        rawText = await fetcher(targetUrl, timeoutMs);
      } else {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(targetUrl, {
          headers: {
            "User-Agent": "BrowserPilot/1.0 (DeepReach Native Client)",
            "Accept": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        if (response.ok) {
          rawText = await response.text();
        }
      }

      if (rawText) {
        const { jobs: parsedJobs, recruiters: parsedRecruiters } = parseRedditListingJson(
          rawText, 
          companyName, 
          roleTitle
        );
        jobs.push(...parsedJobs);
        recruiters.push(...parsedRecruiters);
      }
    } catch (err) {
      errors.push(`Reddit channel error for ${targetUrl}: ${(err as Error).message}`);
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
    channelName: "Reddit Referral & Community Channel",
    sourcePlatform: "REDDIT",
    jobs: uniqueJobs.slice(0, maxResults),
    recruiters: uniqueRecruiters.slice(0, maxResults),
    sourceUrls,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export const redditChannel: DeepReachChannelAdapter = {
  id: "deepreach-reddit",
  name: "Reddit Referral & Community Channel",
  sourcePlatform: "REDDIT",
  description: "Scrapes unadvertised hiring posts, referral networks, and recruiter threads on Reddit.",
  scan: scanRedditChannel,
};
