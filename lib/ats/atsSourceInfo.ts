/**
 * §ATS SOURCE INFO & BRAND CLASSIFICATION
 * 
 * Pure, framework-agnostic utility functions safe for both Server and Client Components.
 * Identifies ATS platform brands, styles, and author handles without Client Component boundary issues.
 */

import { humanizeConnectorType } from "@/lib/utils/display-mappings";

export interface AtsSourceInfoResult {
  name: string;
  className: string;
  dotColor: string;
}

export function getAtsSourceInfo(
  sourcePlatform?: string,
  applyUrl?: string | null,
  sourceListings?: Array<{ sourcePlatform?: string; sourceUrl?: string; applyUrl?: string | null }>
): AtsSourceInfoResult {
  const primarySource = sourceListings?.[0]?.sourcePlatform || sourcePlatform || "";
  const effectiveUrl = sourceListings?.[0]?.applyUrl || sourceListings?.[0]?.sourceUrl || applyUrl || "";
  const text = `${primarySource} ${effectiveUrl}`.toLowerCase();

  // Social & DeepReach platforms (R1: REDDIT, X, YOUTUBE, LINKEDIN)
  if (text.includes("reddit") || primarySource.toUpperCase() === "REDDIT") {
    return { name: "REDDIT", className: "bg-[#FFF0EB] text-[#FF4500] border-[#FFD2C2] dark:bg-[#2A150E] dark:text-[#FF6633] dark:border-[#5A2518]", dotColor: "bg-[#FF4500]" };
  }
  if (text.includes("twitter") || text.includes("x.com") || primarySource.toUpperCase() === "X") {
    return { name: "X", className: "bg-slate-100 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700", dotColor: "bg-slate-900 dark:bg-slate-100" };
  }
  if (text.includes("youtube") || text.includes("youtu.be") || primarySource.toUpperCase() === "YOUTUBE") {
    return { name: "YOUTUBE", className: "bg-[#FFEBEE] text-[#FF0000] border-[#FFCDD2] dark:bg-[#2A0E11] dark:text-[#FF4D4D] dark:border-[#5A181E]", dotColor: "bg-[#FF0000]" };
  }
  if (text.includes("linkedin") || primarySource.toUpperCase() === "LINKEDIN") {
    return { name: "LINKEDIN", className: "bg-[#E8F3FA] text-[#0077B5] border-[#B6DCF5] dark:bg-[#0E202C] dark:text-[#3399CC] dark:border-[#183E58]", dotColor: "bg-[#0077B5]" };
  }

  // ATS Platforms
  if (text.includes("greenhouse")) {
    return { name: "Greenhouse", className: "bg-[#EBF7EE] text-[#0D6832] border-[#BCE4C9]", dotColor: "bg-[#0D6832]" };
  }
  if (text.includes("lever")) {
    return { name: "Lever", className: "bg-[#EBF2FC] text-[#0E4399] border-[#BDD7FB]", dotColor: "bg-[#0E4399]" };
  }
  if (text.includes("ashby")) {
    return { name: "Ashby", className: "bg-[#F0EEFF] text-[#5636D6] border-[#D6CEFD]", dotColor: "bg-[#5636D6]" };
  }
  if (text.includes("workable")) {
    return { name: "Workable", className: "bg-[#E8F8F5] text-[#008060] border-[#B2E6DC]", dotColor: "bg-[#008060]" };
  }
  if (text.includes("workday")) {
    return { name: "Workday", className: "bg-[#FFF3E6] text-[#A14400] border-[#FCD3A5]", dotColor: "bg-[#A14400]" };
  }
  if (text.includes("indeed")) {
    return { name: "Indeed", className: "bg-[#EAF1FB] text-[#2164F3] border-[#B9D1FB]", dotColor: "bg-[#2164F3]" };
  }
  return {
    name: primarySource ? humanizeConnectorType(primarySource) : "Direct Web",
    className: "bg-[#E8EFEA] text-emerald-600 dark:text-emerald-400 border-[#C3D5CA]",
    dotColor: "bg-emerald-600",
  };
}

export function getSocialAuthorHandle(job: any): string | null {
  if (job?.companyContacts?.[0]?.fullName) {
    const name = job.companyContacts[0].fullName;
    if (name.startsWith("u/") || name.startsWith("@")) return name;
    const isTeam = name.toLowerCase().includes("team") || name.toLowerCase().includes("official");
    if (!isTeam) {
      const plat = (job.sourcePlatform || job.sourceListings?.[0]?.sourcePlatform || "").toUpperCase();
      if (plat === "REDDIT") return `u/${name}`;
      if (plat === "X" || plat === "TWITTER") return `@${name}`;
      return name;
    }
  }
  const url = job?.applyUrl || job?.primaryApplyUrl || job?.sourceListings?.[0]?.applyUrl || job?.sourceListings?.[0]?.sourceUrl || "";
  const xMatch = url.match(/(?:x|twitter)\.com\/([a-zA-Z0-9_]{1,20})\/status/i);
  if (xMatch) return `@${xMatch[1]}`;
  const redditMatch = url.match(/reddit\.com\/r\/([a-zA-Z0-9_-]+)/i);
  if (redditMatch) return `r/${redditMatch[1]}`;
  const ytMatch = url.match(/youtube\.com\/(?:@|c\/)?([a-zA-Z0-9_-]+)/i);
  if (ytMatch && !["watch", "results"].includes(ytMatch[1])) return `@${ytMatch[1]}`;
  const desc = job?.description || job?.sourceListings?.[0]?.rawSnippet || "";
  const authorMatch = desc.match(/\b(?:by|author|user|from)\s+([@u\/][a-zA-Z0-9_-]+)/i);
  if (authorMatch) return authorMatch[1];
  return null;
}
