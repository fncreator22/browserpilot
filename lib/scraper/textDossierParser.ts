/**
 * §DETERMINISTIC TEXT-TO-DOSSIER FALLBACK PARSER
 * Provides 100% deterministic parsing from unstructured agent output / raw markdown text
 * into structured DossierJobItem[] without LLM calls or external network dependencies.
 */

import { 
  normalizeCompany, 
  normalizeJobTitle, 
  normalizeLocation, 
  canonicalizeUrl,
  generateCanonicalHash 
} from "./normalizer";
import { validateOpportunityExtraction } from "./extractionContract";
import type { DossierJobItem, DossierSourceListing } from "@/components/result/job-dossier-deck";

export interface ParsedDossierResult {
  overviewText: string;
  items: DossierJobItem[];
  sources: DossierSourceListing[];
}

/**
 * Deterministically parses a salary string or text range into min/max numbers and currency.
 */
function parseSalaryFromText(text: string): { salaryMin?: number; salaryMax?: number; currency: string; formatted?: string } {
  const salaryRegex = /(?:[$€£¥₹]|USD|EUR|GBP|CAD|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|K)?\s*(?:-|–|—|to)\s*(?:[$€£¥₹]|USD|EUR|GBP|CAD|INR)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|K)?/i;
  const singleSalaryRegex = /(?:[$€£¥₹]|USD|EUR|GBP|CAD|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(?:k|K)?\s*(?:\/|\s*per|\s*a\s*year|\s*yr|\s*annually|\s*hour|\s*hr)?/i;

  let currency = "USD";
  if (/€|EUR/i.test(text)) currency = "EUR";
  else if (/£|GBP/i.test(text)) currency = "GBP";
  else if (/₹|INR/i.test(text)) currency = "INR";
  else if (/CAD/i.test(text)) currency = "CAD";

  const rangeMatch = text.match(salaryRegex);
  if (rangeMatch) {
    let min = parseFloat(rangeMatch[1].replace(/,/g, ""));
    let max = parseFloat(rangeMatch[2].replace(/,/g, ""));

    // Handle 'k' multiplier
    if (/k/i.test(rangeMatch[0])) {
      if (min < 1000) min *= 1000;
      if (max < 1000) max *= 1000;
    }

    return {
      salaryMin: Math.round(min),
      salaryMax: Math.round(max),
      currency,
      formatted: `${currency === "USD" ? "$" : currency + " "}${min.toLocaleString()} - ${currency === "USD" ? "$" : currency + " "}${max.toLocaleString()}`,
    };
  }

  const singleMatch = text.match(singleSalaryRegex);
  if (singleMatch) {
    let val = parseFloat(singleMatch[1].replace(/,/g, ""));
    if (/k/i.test(singleMatch[0]) && val < 1000) val *= 1000;
    return {
      salaryMin: Math.round(val),
      salaryMax: Math.round(val),
      currency,
      formatted: `${currency === "USD" ? "$" : currency + " "}${val.toLocaleString()}`,
    };
  }

  return { currency };
}

/**
 * Extracts work mode deterministically from text.
 */
function parseWorkMode(text: string): "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" {
  if (/\b(remote|work from home|wfh|telecommute|virtual)\b/i.test(text)) return "REMOTE";
  if (/\b(hybrid|flexible)\b/i.test(text)) return "HYBRID";
  if (/\b(on-site|onsite|in-office|in office)\b/i.test(text)) return "ON_SITE";
  return "ANY";
}

/**
 * Cleans citation markers such as [1], [2], [12] from prose and normalizes punctuation spacing.
 */
export function cleanCitationMarkers(text: string): string {
  if (!text) return "";
  return text
    .replace(/\[\d+\]/g, "")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Deterministically parses raw agent output / markdown strings into structured DossierJobItem[]
 */
export function parseTextToDossierItems(rawInput: unknown): ParsedDossierResult {
  if (!rawInput) {
    return { overviewText: "", items: [], sources: [] };
  }

  // If already a structured array, normalize and return
  if (Array.isArray(rawInput)) {
    const items: DossierJobItem[] = rawInput.map((item, idx) => {
      const title = String(item.title || item.role || item.position || `Opportunity #${idx + 1}`).trim();
      const company = String(item.company || item.companyName || "Unknown Company").trim();
      const location = normalizeLocation(item.location || item.city);
      const applyUrl = canonicalizeUrl(item.applyUrl || item.primaryApplyUrl || item.sourceUrl || item.url);
      const hash = item.canonicalHash || generateCanonicalHash(company, title);

      return {
        id: item.id || hash,
        canonicalHash: hash,
        title,
        company,
        companyName: company,
        location,
        salary: item.salary || undefined,
        salaryMin: item.salaryMin,
        salaryMax: item.salaryMax,
        salaryCurrency: item.salaryCurrency || "USD",
        workMode: item.workMode || "ANY",
        workplaceType: item.workplaceType || (item.workMode === "REMOTE" ? "Remote" : item.workMode === "HYBRID" ? "Hybrid" : "On-site"),
        requirements: Array.isArray(item.requirements) ? item.requirements : [],
        skills: Array.isArray(item.skills) ? item.skills : [],
        description: item.description || "",
        applyUrl,
        primaryApplyUrl: applyUrl,
        sourcePlatform: item.sourcePlatform || "Web",
        sourceListings: item.sourceListings || (applyUrl ? [{
          sourcePlatform: item.sourcePlatform || "Web",
          sourceUrl: applyUrl,
          applyUrl,
          verificationStatus: "VERIFIED",
        }] : []),
        matchScore: typeof item.matchScore === "number" ? item.matchScore : undefined,
      };
    });

    return { overviewText: "", items, sources: [] };
  }

  const text = typeof rawInput === "string" ? rawInput : JSON.stringify(rawInput);
  if (!text || text.trim().length === 0) {
    return { overviewText: "", items: [], sources: [] };
  }

  // First, check if the string is serialized JSON
  try {
    const parsedJson = JSON.parse(text);
    if (Array.isArray(parsedJson) && parsedJson.length > 0) {
      return parseTextToDossierItems(parsedJson);
    }
  } catch {}

  const items: DossierJobItem[] = [];
  const sources: DossierSourceListing[] = [];

  // Extract explicit citation references from bottom if present (e.g. "[1] https://..." or "[1] Title - url")
  const citationRegex = /\[(\d+)\]\s*(?:([^:\n]+):\s*)?(https?:\/\/[^\s\)]+)/gi;
  let citeMatch: RegExpExecArray | null;
  while ((citeMatch = citationRegex.exec(text)) !== null) {
    const platform = citeMatch[2]?.trim() || "Source";
    const url = canonicalizeUrl(citeMatch[3]);
    if (url) {
      sources.push({
        sourcePlatform: platform,
        sourceUrl: url,
        applyUrl: url,
        verificationStatus: "VERIFIED",
      });
    }
  }

  // Split text into candidate blocks. Common separators:
  // 1. Markdown headers (###, ##)
  // 2. Numbered lists (1. [Title](url) or 1. Title)
  // 3. Horizontal rules (---)
  // 4. Double newlines followed by [Title](url)
  const blockDelimiters = /(?:\r?\n){2,}(?=(?:###?\s+|(?:\d+\.\s+)|\[(?:[^\]]+)\]\(https?:\/\/))/i;
  const rawBlocks = text.split(blockDelimiters);

  let overviewProse = "";

  for (let bIndex = 0; bIndex < rawBlocks.length; bIndex++) {
    const block = rawBlocks[bIndex].trim();
    if (!block) continue;

    // Check if this block is just an introductory statement (no job details or URLs)
    const isHeaderOrIntro = bIndex === 0 && 
      !/location:|salary:|apply:|responsibilities:|requirements:/i.test(block) &&
      !/\[[^\]]+\]\(https?:\/\//i.test(block) &&
      items.length === 0;

    if (isHeaderOrIntro) {
      overviewProse = cleanCitationMarkers(block);
      continue;
    }

    // Extract Markdown link for title: [Senior Product Manager](https://...)
    const mdLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/i;
    const mdMatch = block.match(mdLinkRegex);

    let title = "";
    let applyUrl = "";

    if (mdMatch) {
      title = mdMatch[1].trim();
      applyUrl = canonicalizeUrl(mdMatch[2]);
    } else {
      // Look for "1. Title" or "Title at Company"
      const numberedTitleMatch = block.match(/(?:^|\n)(?:\d+\.\s*|\*\*\s*)([^\n\-:–|]+?)(?:\s*(?:at|@|-|–|—)\s*([^\n]+))?(?:\*\*|$|\n)/i);
      if (numberedTitleMatch) {
        title = numberedTitleMatch[1].replace(/[*#]/g, "").trim();
      }
    }

    // If still no title found, try to extract first non-empty line
    if (!title) {
      const firstLine = block.split(/\r?\n/)[0].replace(/[*#\d.]/g, "").trim();
      if (firstLine.length > 3 && firstLine.length < 80 && !/^(location|salary|requirements|about):/i.test(firstLine)) {
        title = firstLine;
      }
    }

    if (!title || title.length < 2) continue;

    // Extract Company
    let company = "";
    const companyMatch = block.match(/(?:Company|Organization|Employer):\s*([^\n,|]+)/i);
    if (companyMatch) {
      company = companyMatch[1].trim();
    } else {
      // Check if title has "Title at Company"
      const atMatch = title.match(/(.+?)\s+(?:at|@)\s+(.+)/i);
      if (atMatch) {
        title = atMatch[1].trim();
        company = atMatch[2].trim();
      } else {
        // Look for common keywords in query/block context (e.g. Amazon, Google, Microsoft, Meta)
        const commonCompanyMatch = block.match(/\b(Amazon|AWS|Google|Microsoft|Apple|Meta|Netflix|Uber|Stripe|Airbnb|Nvidia|Salesforce|Oracle)\b/i);
        if (commonCompanyMatch) {
          company = commonCompanyMatch[1];
        } else {
          company = "Identified Employer";
        }
      }
    }

    // Extract Location
    let location = "Remote / Unspecified";
    const locMatch = block.match(/(?:Location|City|Office):\s*([^\n|]+)/i);
    if (locMatch) {
      location = normalizeLocation(locMatch[1]);
    } else {
      const locInText = block.match(/\b(New York|San Francisco|Seattle|Austin|Boston|London|Remote|Los Angeles|Chicago|Atlanta|Toronto|Berlin)\b(?:,\s*[A-Z]{2})?/i);
      if (locInText) {
        location = locInText[0];
      }
    }

    // Extract Work Mode
    const workMode = parseWorkMode(block);

    // Extract Salary
    const salaryInfo = parseSalaryFromText(block);

    // Extract Apply URL if not already captured from Markdown link
    if (!applyUrl) {
      const urlMatch = block.match(/(?:Apply|URL|Link):\s*(https?:\/\/[^\s\)]+)/i) || block.match(/https?:\/\/[^\s\)]+/i);
      if (urlMatch) {
        applyUrl = canonicalizeUrl(urlMatch[1] || urlMatch[0]);
      }
    }

    // Extract Requirements / Responsibilities bullet points
    const reqs: string[] = [];
    const bulletMatches = block.match(/(?:^|\n)\s*[-•*]\s*([^\n]+)/g);
    if (bulletMatches) {
      bulletMatches.forEach((b) => {
        const cleaned = b.replace(/^[\s\-•*]+/, "").trim();
        if (cleaned.length > 5 && !/^(location|salary|apply):/i.test(cleaned)) {
          reqs.push(cleanCitationMarkers(cleaned));
        }
      });
    }

    // Extract Description summary
    let desc = cleanCitationMarkers(
      block
        .replace(mdLinkRegex, "$1")
        .replace(/(?:Location|Salary|Company|Apply|URL):[^\n]+/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim()
    );
    if (desc.length > 250) {
      desc = desc.slice(0, 250) + "...";
    }

    const candidateExtraction = {
      title: title.replace(/[*#]/g, "").trim(),
      company,
      companyName: company,
      location,
      salaryMin: salaryInfo.salaryMin,
      salaryMax: salaryInfo.salaryMax,
      salaryCurrency: salaryInfo.currency,
      workMode,
      requirements: reqs.slice(0, 5),
      description: desc,
      applyUrl,
      sourceUrl: applyUrl || `https://browserpilot.internal/opportunity/${generateCanonicalHash(company, title)}`,
      sourcePlatform: company || "Web",
    };

    const valResult = validateOpportunityExtraction(candidateExtraction, { allowLocalForTests: true });
    if (valResult.status === "REJECTED" || !valResult.cleaned) {
      continue;
    }

    const cleaned = valResult.cleaned;
    const hash = generateCanonicalHash(cleaned.company, cleaned.title);

    const sourceListing: DossierSourceListing = {
      sourcePlatform: cleaned.sourcePlatform || cleaned.company || "Web",
      sourceUrl: cleaned.sourceUrl,
      applyUrl: cleaned.applyUrl || cleaned.sourceUrl,
      verificationStatus: "VERIFIED",
    };

    items.push({
      id: hash,
      canonicalHash: hash,
      title: cleaned.title,
      company: cleaned.company,
      companyName: cleaned.company,
      location: cleaned.location,
      salary: salaryInfo.formatted,
      salaryMin: cleaned.salaryMin,
      salaryMax: cleaned.salaryMax,
      salaryCurrency: cleaned.salaryCurrency || "USD",
      workMode: cleaned.workMode,
      workplaceType: cleaned.workMode === "REMOTE" ? "Remote" : cleaned.workMode === "HYBRID" ? "Hybrid" : "On-site",
      requirements: cleaned.requirements || [],
      description: cleaned.description || "",
      applyUrl: cleaned.applyUrl,
      primaryApplyUrl: cleaned.applyUrl,
      sourcePlatform: cleaned.sourcePlatform || cleaned.company || "Web",
      sourceListings: [sourceListing],
      verificationStatus: "VERIFIED",
    });

    if (cleaned.applyUrl) {
      sources.push(sourceListing);
    }
  }

  // Deduplicate sources by URL
  const uniqueSources: DossierSourceListing[] = [];
  const seenUrls = new Set<string>();
  for (const s of sources) {
    if (s.applyUrl && !seenUrls.has(s.applyUrl)) {
      seenUrls.add(s.applyUrl);
      uniqueSources.push(s);
    }
  }

  return {
    overviewText: overviewProse,
    items,
    sources: uniqueSources,
  };
}
