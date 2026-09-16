/**
 * §DEEPREACH CHANNEL: LINKEDIN
 * Zero-fee public recruiter intelligence and job listing extraction via Jina Reader.
 * Discovers company recruiters (site:linkedin.com/in) and public job postings.
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

export function parseLinkedInRecruitersFromText(
  pageText: string, 
  companyName: string, 
  companyDomain?: string
): VerifiableRecruiterContact[] {
  const contacts: VerifiableRecruiterContact[] = [];
  const seenUrls = new Set<string>();

  // Extract markdown links: [Name - Role | LinkedIn](https://www.linkedin.com/in/slug)
  const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[a-zA-Z0-9%_-]+(?:\/)?)\)/gi;
  let mdMatch: RegExpExecArray | null;

  while ((mdMatch = mdLinkRegex.exec(pageText)) !== null) {
    const rawAnchorText = mdMatch[1].trim();
    const profileUrl = mdMatch[2].trim().replace(/\/$/, "");

    if (seenUrls.has(profileUrl.toLowerCase())) continue;
    seenUrls.add(profileUrl.toLowerCase());

    // Clean anchor text to find person's name and role
    const cleanedTitle = rawAnchorText
      .replace(/\s*\|\s*LinkedIn.*$/i, "")
      .replace(/\s*-\s*LinkedIn.*$/i, "")
      .trim();

    const parts = cleanedTitle.split(/\s*[-–—:]\s*/);
    let fullName = parts[0]?.trim() || "";
    let roleTitle = parts[1]?.trim() || "Technical Recruiter & Talent Partner";

    // If anchor text was generic or a URL slug
    if (!fullName || fullName.length < 2 || fullName.toLowerCase().includes("linkedin")) {
      const slug = profileUrl.split("/in/")[1]?.split("/")[0] || "";
      fullName = slug
        .replace(/[-_0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()) || "Talent Partner";
    }

    const email = companyDomain && fullName.includes(" ")
      ? `${fullName.toLowerCase().replace(/[^a-z]/g, ".")}@${companyDomain}`
      : undefined;

    contacts.push({
      fullName,
      roleTitle: roleTitle.length > 5 ? roleTitle : "Technical Recruiter & Talent Partner",
      companyName,
      profileUrl,
      email,
      department: "Talent Acquisition",
      sourcePlatform: "LINKEDIN",
    });
  }

  // Fallback regex for raw URLs if markdown links were not captured
  const rawUrlRegex = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)/gi;
  let rawMatch: RegExpExecArray | null;
  while ((rawMatch = rawUrlRegex.exec(pageText)) !== null) {
    const fullUrl = rawMatch[0].replace(/\/$/, "");
    if (seenUrls.has(fullUrl.toLowerCase())) continue;
    seenUrls.add(fullUrl.toLowerCase());

    const slug = rawMatch[1] || "";
    const inferredName = slug
      .replace(/[-_0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\w/g, (c) => c.toUpperCase()) || "Recruitment Specialist";

    const email = companyDomain && inferredName.includes(" ")
      ? `${inferredName.toLowerCase().replace(/[^a-z]/g, ".")}@${companyDomain}`
      : undefined;

    contacts.push({
      fullName: inferredName,
      roleTitle: "Technical Recruiter & Talent Partner",
      companyName,
      profileUrl: fullUrl,
      email,
      department: "Talent Acquisition",
      sourcePlatform: "LINKEDIN",
    });
  }

  return contacts;
}

export function parseLinkedInJobsFromText(
  pageText: string, 
  companyName: string, 
  fallbackRole: string = "Engineer"
): VerifiableJobCandidate[] {
  const jobs: VerifiableJobCandidate[] = [];
  const seenUrls = new Set<string>();

  // Extract job URLs: https://www.linkedin.com/jobs/view/12345
  const mdJobRegex = /\[([^\]]+)\]\((https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/jobs\/view\/[a-zA-Z0-9_-]+(?:\/)?)\)/gi;
  let jobMatch: RegExpExecArray | null;

  while ((jobMatch = mdJobRegex.exec(pageText)) !== null) {
    const rawTitle = jobMatch[1].trim();
    const applyUrl = jobMatch[2].trim();

    if (seenUrls.has(applyUrl.toLowerCase())) continue;
    seenUrls.add(applyUrl.toLowerCase());

    const cleanedTitle = rawTitle
      .replace(/\s*\|\s*LinkedIn.*$/i, "")
      .replace(/\s*-\s*LinkedIn.*$/i, "")
      .replace(/^(Job\s*:\s*)/i, "")
      .trim() || `${fallbackRole} at ${companyName}`;

    jobs.push({
      title: cleanedTitle,
      companyName,
      applyUrl,
      sourceUrl: applyUrl,
      sourcePlatform: "LINKEDIN",
      workMode: cleanedTitle.toLowerCase().includes("remote") ? "REMOTE" : "ANY",
      description: `Public LinkedIn job posting for ${cleanedTitle} at ${companyName}.`,
    });
  }

  // Fallback for standalone raw URLs
  const rawJobRegex = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/jobs\/view\/([a-zA-Z0-9_-]+)/gi;
  let rawJobMatch: RegExpExecArray | null;
  while ((rawJobMatch = rawJobRegex.exec(pageText)) !== null) {
    const applyUrl = rawJobMatch[0].replace(/\/$/, "");
    if (seenUrls.has(applyUrl.toLowerCase())) continue;
    seenUrls.add(applyUrl.toLowerCase());

    jobs.push({
      title: `${companyName} - ${fallbackRole}`,
      companyName,
      applyUrl,
      sourceUrl: applyUrl,
      sourcePlatform: "LINKEDIN",
      workMode: "ANY",
      description: `Discovered active LinkedIn opening at ${companyName}.`,
    });
  }

  return jobs;
}

export async function scanLinkedInChannel(
  params: DeepReachChannelParams
): Promise<DeepReachChannelResult> {
  const { 
    companyName, 
    roleTitle = "Software Engineer", 
    companyDomain, 
    maxResults = 10,
    timeoutMs = 6000, 
    fetcher = fetchViaJinaReader 
  } = params;

  const jobs: VerifiableJobCandidate[] = [];
  const recruiters: VerifiableRecruiterContact[] = [];
  const sourceUrls: string[] = [];
  const errors: string[] = [];

  // 1. Recruiter discovery query via Jina Reader
  const recruiterQuery = `"${companyName}" ("Technical Recruiter" OR "Talent Acquisition" OR "Head of Talent") site:linkedin.com/in`;
  const recruiterSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(recruiterQuery)}`;
  sourceUrls.push(recruiterSearchUrl);

  try {
    const recruiterPageText = await fetcher(recruiterSearchUrl, timeoutMs);
    if (recruiterPageText) {
      const extracted = parseLinkedInRecruitersFromText(recruiterPageText, companyName, companyDomain);
      recruiters.push(...extracted.slice(0, maxResults));
    }
  } catch (err) {
    errors.push(`LinkedIn recruiter search failed: ${(err as Error).message}`);
  }

  // 2. Job listing discovery: First attempt direct LinkedIn Guest API, fallback to Jina
  try {
    const { LinkedInProvider } = await import("@/lib/scraper/providers/linkedInProvider");
    const linkedInProv = new LinkedInProvider();
    const guestJobs = await linkedInProv.harvestCandidates(
      {
        roles: [roleTitle],
        companies: [companyName],
        workModes: ["ANY"],
      },
      { maxCandidates: maxResults, timeoutMs }
    );

    if (guestJobs && guestJobs.length > 0) {
      for (const gj of guestJobs) {
        jobs.push({
          title: gj.title,
          companyName: gj.companyName,
          applyUrl: gj.applyUrl || gj.sourceUrl,
          sourceUrl: gj.sourceUrl,
          sourcePlatform: "LINKEDIN",
          workMode: (gj.workMode as any) || "ANY",
          location: gj.location,
          description: gj.description || `Discovered active LinkedIn opening at ${companyName}.`,
        });
      }
    }
  } catch {
    // Non-fatal, fallback to Jina search
  }

  // Fallback to Jina search if direct guest API found nothing
  if (jobs.length === 0) {
    const jobQuery = `"${companyName}" "${roleTitle}" (hiring OR apply) site:linkedin.com/jobs/view`;
    const jobSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(jobQuery)}`;
    sourceUrls.push(jobSearchUrl);

    try {
      const jobPageText = await fetcher(jobSearchUrl, timeoutMs);
      if (jobPageText) {
        const extractedJobs = parseLinkedInJobsFromText(jobPageText, companyName, roleTitle);
        jobs.push(...extractedJobs.slice(0, maxResults));
      }
    } catch (err) {
      errors.push(`LinkedIn jobs search failed: ${(err as Error).message}`);
    }
  }

  return {
    channelName: "LinkedIn Talent & Jobs Channel",
    sourcePlatform: "LINKEDIN",
    jobs,
    recruiters,
    sourceUrls,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

export const linkedInChannel: DeepReachChannelAdapter = {
  id: "deepreach-linkedin",
  name: "LinkedIn Talent & Jobs Channel",
  sourcePlatform: "LINKEDIN",
  description: "Scrapes public company recruiter profiles and verified job postings via Jina Reader.",
  scan: scanLinkedInChannel,
};
