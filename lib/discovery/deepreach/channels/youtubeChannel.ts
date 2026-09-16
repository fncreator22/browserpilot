/**
 * §DEEPREACH CHANNEL: YOUTUBE
 * Zero-fee public engineering tech talks, tech spotlights, and day-in-the-life recruiting videos via Jina Reader.
 * Extracts featured speakers, tech leads, and engineering managers as contacts,
 * and highlighted roles / career links from video summaries.
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

export function parseYouTubeVideosFromText(
  pageText: string,
  companyName: string,
  fallbackRole: string = "Software Engineer"
): { jobs: VerifiableJobCandidate[]; recruiters: VerifiableRecruiterContact[] } {
  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const seenUrls = new Set<string>();
  const seenSpeakers = new Set<string>();

  // Extract YouTube video links: markdown [Title](https://www.youtube.com/watch?v=xxx) or raw URLs
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)[^)\s]*\))/gi;
  let match: RegExpExecArray | null;

  const paragraphs = pageText.split(/\n\s*\n/);

  while ((match = mdRegex.exec(pageText)) !== null) {
    const rawAnchorText = match[1]?.trim() || "";
    const videoUrl = match[2].trim().replace(/[.,;]$/, "");

    if (seenUrls.has(videoUrl)) continue;
    seenUrls.add(videoUrl);

    // Context paragraph for descriptions, speakers, and application links
    const contextPara = paragraphs.find((p) => p.includes(videoUrl) || (rawAnchorText && p.includes(rawAnchorText))) || rawAnchorText;

    // Check for any external application or career link in context
    const externalLinks = contextPara.match(/https?:\/\/(?!www\.youtube\.com|youtube\.com|youtu\.be)[^\s"')>]+/gi) || [];
    const directApplyUrl = externalLinks[0]?.replace(/[.,;]$/, "") || videoUrl;

    // Detect speaker or tech lead from anchor text or snippet
    let speakerName = "";
    let speakerRole = "Engineering Lead / Tech Talk Speaker";

    const speakerMatch = contextPara.match(/(?:speaker|presenter|host|talk by|with)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i)
      || rawAnchorText.match(/(?:^|[-–—|]\s*)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*(?:[-–—|:]\s*([A-Za-z\s]+))?$/i);

    if (speakerMatch && speakerMatch[1] && !speakerMatch[1].toLowerCase().includes("youtube")) {
      const candidateName = speakerMatch[1].trim();
      if (!candidateName.toLowerCase().includes(companyName.toLowerCase())) {
        speakerName = candidateName;
        if (speakerMatch[2] && speakerMatch[2].trim().length > 3) {
          speakerRole = speakerMatch[2].trim();
        }
      }
    }

    // Role detection from video title/context
    let detectedRole = fallbackRole;
    const roleMatch = contextPara.match(/(?:hiring|looking for|team)\s+(?:a\s+|an\s+)?([A-Za-z0-9\s/]+(?:Engineer|Developer|Architect|Lead|Manager))/i);
    if (roleMatch && roleMatch[1] && roleMatch[1].trim().length < 40) {
      detectedRole = roleMatch[1].trim();
    }

    // Clean video title
    const cleanTitle = rawAnchorText
      .replace(/\s*\|\s*YouTube.*$/i, "")
      .replace(/\s*-\s*YouTube.*$/i, "")
      .trim() || `${companyName} Engineering Tech Spotlight`;

    const description = contextPara.length > 20
      ? contextPara.replace(/\s+/g, " ").trim().slice(0, 300)
      : `Featured engineering tech talk & recruitment spotlight from ${companyName}.`;

    jobs.push({
      title: `${detectedRole} (Tech Spotlight)`,
      companyName,
      applyUrl: directApplyUrl,
      sourceUrl: videoUrl,
      sourcePlatform: "YOUTUBE",
      workMode: contextPara.toLowerCase().includes("remote") ? "REMOTE" : "ANY",
      description: `Discovered from YouTube Tech Talk "${cleanTitle}": ${description}`,
    });

    // Add speaker contact if identified
    if (speakerName && !seenSpeakers.has(speakerName.toLowerCase())) {
      seenSpeakers.add(speakerName.toLowerCase());
      recruiters.push({
        fullName: speakerName,
        roleTitle: speakerRole,
        companyName,
        profileUrl: videoUrl,
        department: "Engineering Leadership",
        sourcePlatform: "YOUTUBE",
      });
    }
  }

  // Fallback for raw youtube URLs if not captured in markdown anchors
  const rawUrlRegex = /https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=[a-zA-Z0-9_-]+|youtu\.be\/[a-zA-Z0-9_-]+)/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawUrlRegex.exec(pageText)) !== null) {
    const videoUrl = rawMatch[0].replace(/[.,;]$/, "");
    if (seenUrls.has(videoUrl)) continue;
    seenUrls.add(videoUrl);

    jobs.push({
      title: `${fallbackRole} (Tech Spotlight)`,
      companyName,
      applyUrl: videoUrl,
      sourceUrl: videoUrl,
      sourcePlatform: "YOUTUBE",
      workMode: "ANY",
      description: `Engineering tech talk and team spotlight video from ${companyName}.`,
    });
  }

  return { jobs, recruiters };
}

export async function scanYouTubeChannel(
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

  const searchQueries = [
    `"${companyName}" ("tech talk" OR "engineering" OR "day in the life") site:youtube.com`,
    `"${companyName}" "engineering" (hiring OR careers OR "join our team") site:youtube.com`,
  ];

  for (const query of searchQueries) {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    sourceUrls.push(searchUrl);

    try {
      const pageText = await fetcher(searchUrl, timeoutMs);
      if (pageText) {
        const { jobs: parsedJobs, recruiters: parsedRecruiters } = parseYouTubeVideosFromText(
          pageText, 
          companyName, 
          roleTitle
        );
        jobs.push(...parsedJobs);
        recruiters.push(...parsedRecruiters);
      }
    } catch (err) {
      errors.push(`YouTube channel error: ${(err as Error).message}`);
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
    channelName: "YouTube Tech Talks & Recruiting Channel",
    sourcePlatform: "YOUTUBE",
    jobs: uniqueJobs.slice(0, maxResults),
    recruiters: uniqueRecruiters.slice(0, maxResults),
    sourceUrls,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export const youtubeChannel: DeepReachChannelAdapter = {
  id: "deepreach-youtube",
  name: "YouTube Tech Talks & Recruiting Channel",
  sourcePlatform: "YOUTUBE",
  description: "Scrapes engineering tech talks, team culture spotlights, and featured speakers on YouTube.",
  scan: scanYouTubeChannel,
};
