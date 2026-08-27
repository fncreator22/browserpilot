/**
 * §ANTI-HALLUCINATION SEMANTIC DEDUPLICATOR & DATA NORMALIZER
 * Strips noisy boilerplate, deduplicates repetitive phrases and duplicate job records,
 * and produces clean, high-signal structured dossiers without LLM token waste.
 */

import * as cheerio from "cheerio";

export interface NormalizedJobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  salary?: string;
  workplaceType?: "Remote" | "Hybrid" | "On-site" | "Unspecified";
  requirements: string[];
  description: string;
  applyUrl: string;
  sourcePlatform: string;
  screenshotUrl?: string;
  extractedAt: string;
}

/**
 * Deduplicates repetitive lines and hallucinated repeated sentences in text
 */
export function deduplicateTextLines(rawText: string): string {
  if (!rawText) return "";

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const seenLines = new Set<string>();
  const uniqueLines: string[] = [];

  for (const line of lines) {
    const normalized = line.toLowerCase().replace(/[^\w\s]/g, "").trim();
    if (normalized.length < 3) continue;

    // Filter repeated boilerplate lines
    if (!seenLines.has(normalized)) {
      seenLines.add(normalized);
      uniqueLines.push(line);
    }
  }

  return uniqueLines.join("\n");
}

/**
 * Generates a deterministic deduplication fingerprint for a job listing
 */
export function getJobFingerprint(title: string, company: string, location?: string): string {
  const cleanTitle = (title || "").toLowerCase().replace(/[^\w]/g, "");
  const cleanCompany = (company || "").toLowerCase().replace(/[^\w]/g, "");
  const cleanLoc = (location || "").toLowerCase().replace(/[^\w]/g, "").slice(0, 10);
  return `${cleanCompany}_${cleanTitle}_${cleanLoc}`;
}

/**
 * Normalizes and deduplicates an array of raw extracted job objects
 */
export function normalizeAndDeduplicateJobs(
  rawJobs: Array<Record<string, unknown>>,
  defaultPlatform = "Web"
): NormalizedJobItem[] {
  const seenFingerprints = new Set<string>();
  const normalizedList: NormalizedJobItem[] = [];

  for (let i = 0; i < rawJobs.length; i++) {
    const raw = rawJobs[i];

    const title = String(raw.title || raw.role || raw.position || `Job Posting #${i + 1}`).trim();
    const company = String(raw.company || raw.companyName || raw.organization || "Company").trim();
    const location = String(raw.location || raw.city || "Remote / Unspecified").trim();

    const fingerprint = getJobFingerprint(title, company, location);
    if (seenFingerprints.has(fingerprint)) {
      continue; // Skip exact/fuzzy duplicate
    }
    seenFingerprints.add(fingerprint);

    // Extract salary
    const salary = raw.salary || raw.compensation || raw.pay ? String(raw.salary || raw.compensation || raw.pay).trim() : undefined;

    // Detect workplace type
    const locLower = `${location} ${raw.description || ""}`.toLowerCase();
    let workplaceType: NormalizedJobItem["workplaceType"] = "Unspecified";
    if (locLower.includes("remote") || locLower.includes("work from home")) workplaceType = "Remote";
    else if (locLower.includes("hybrid")) workplaceType = "Hybrid";
    else if (locLower.includes("on-site") || locLower.includes("onsite")) workplaceType = "On-site";

    // Extract clean requirements as bullet points
    let requirements: string[] = [];
    if (Array.isArray(raw.requirements)) {
      requirements = raw.requirements.map(String).map((r) => r.trim()).filter(Boolean).slice(0, 5);
    } else if (typeof raw.requirements === "string") {
      requirements = raw.requirements
        .split(/[;\n•·-]/)
        .map((r) => r.trim())
        .filter((r) => r.length > 5)
        .slice(0, 5);
    } else if (raw.description) {
      // Extract first 3 high-signal sentences from description
      requirements = String(raw.description)
        .split(/[.\n]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 15)
        .slice(0, 4);
    }

    // Extract canonical apply URL
    let applyUrl = String(raw.applyUrl || raw.url || raw.link || raw.sourceUrl || "").trim();
    if (!applyUrl.startsWith("http://") && !applyUrl.startsWith("https://")) {
      applyUrl = `https://www.google.com/search?q=${encodeURIComponent(`${company} ${title} apply`)}`;
    }

    const sourcePlatform = String(raw.sourcePlatform || raw.source || defaultPlatform);

    normalizedList.push({
      id: `job_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      company,
      location,
      salary,
      workplaceType,
      requirements,
      description: deduplicateTextLines(String(raw.description || "")).slice(0, 600),
      applyUrl,
      sourcePlatform,
      screenshotUrl: raw.screenshotUrl ? String(raw.screenshotUrl) : undefined,
      extractedAt: new Date().toISOString(),
    });
  }

  return normalizedList;
}
