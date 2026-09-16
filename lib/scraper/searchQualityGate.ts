/**
 * §AUTHORITATIVE SEARCH RESULT QUALITY GATE (TASK-044)
 * 
 * Provides a single, deterministic boundary to evaluate candidate validity,
 * date eligibility, job-level URL resolution, role relevance, and metadata confidence
 * before ranking, deduplication, and persistence.
 */

import { type RawJobCandidate } from "./providers/baseProvider";
import { type DiscoveryPlan } from "./discoveryPlanner";
import { 
  classifyJobUrl, 
  type JobUrlType, 
  normalizeJobTitle, 
  normalizeCompany 
} from "./normalizer";
import { 
  parsePostingDate, 
  isWithinFreshnessWindow, 
  evaluateMetadataConfidence, 
  type MetadataConfidence 
} from "./freshnessExtractor";
import { extractSeniority } from "./deduplicator";

export interface QualityGateEvaluation {
  isEligible: boolean;
  rejectionReasons: string[];
  metadataConfidence: MetadataConfidence;
  urlType: JobUrlType;
  parsedPostingDate: Date | null;
  postedAgoText?: string;
  ageHours?: number;
  roleMatch: boolean;
  seniorityMatch: boolean;
  locationMatch: boolean;
}

const INVALID_TITLE_PATTERNS = [
  /^click here\b/i,
  /^search results?$/i,
  /^jobs?$/i,
  /^all jobs?$/i,
  /^careers?$/i,
  /^sign\s*in$/i,
  /^apply(?: now)?$/i,
  /^loading(?:\.\.\.)?$/i,
  /^untitled$/i,
  /^unknown(?: job)?$/i,
  /^n\/?a$/i,
  /^404\b/i,
  /^error\b/i,
  /^position$/i,
  /^role$/i,
  // TASK-063 Synthetic Firewall Patterns
  /job_5001/i,
  /synthetic candidate/i,
  /test candidate/i,
];

const INVALID_COMPANY_PATTERNS = [
  /^unknown(?: company)?$/i,
  /^company$/i,
  /^organization$/i,
  /^n\/?a$/i,
  /^none$/i,
  /^employer$/i,
  /^null$/i,
  /^undefined$/i,
  // TASK-063 Synthetic Firewall Patterns
  /leading organization/i,
  /leading employer/i,
  /placeholder company/i,
  /mock company/i,
  /example company/i,
  /fake company/i,
];

/**
 * Checks if a candidate title is semantically disjoint from the requested role.
 * E.g. If searching for "Backend Engineer", reject "Frontend Engineer", "Graphic Designer", "iOS Engineer", etc.
 */
function isDisjointRole(candidateTitle: string, targetRoles: string[]): boolean {
  if (!targetRoles || targetRoles.length === 0) return false;

  const normCandidate = normalizeJobTitle(candidateTitle).toLowerCase();
  const lowerTitle = candidateTitle.toLowerCase();

  // If target is specifically Backend
  const isTargetBackend = targetRoles.some((r) => /backend|back end/i.test(r));
  if (isTargetBackend) {
    // If title is purely frontend, mobile, design, or data analyst without backend mentions
    const isPureFrontend = /\b(frontend|front end|ui\/ux|graphic designer|ios developer|android developer|flutter developer|mobile developer)\b/i.test(lowerTitle);
    const hasBackendToken = /\b(backend|back end|full stack|fullstack|distributed|api|platform)\b/i.test(lowerTitle);
    if (isPureFrontend && !hasBackendToken) {
      return true;
    }
  }

  // If target is specifically Frontend
  const isTargetFrontend = targetRoles.some((r) => /frontend|front end/i.test(r));
  if (isTargetFrontend) {
    const isPureBackend = /\b(backend|back end|devops|database admin|systems admin)\b/i.test(lowerTitle);
    const hasFrontendToken = /\b(frontend|front end|ui|react|vue|angular|full stack|fullstack)\b/i.test(lowerTitle);
    if (isPureBackend && !hasFrontendToken) {
      return true;
    }
  }

  // If target is Mechanical Engineer
  const isTargetMechanical = targetRoles.some((r) => /mechanical/i.test(r));
  if (isTargetMechanical) {
    const isDisjointFromMechanical = /\b(marketing|sales|recruiter|hr|human resources|accountant|accounting|finance|nurse|nursing|doctor)\b/i.test(lowerTitle);
    if (isDisjointFromMechanical && !/\bmechanical\b/i.test(lowerTitle)) {
      return true;
    }
  }

  // If target is Civil Engineer
  const isTargetCivil = targetRoles.some((r) => /civil\b/i.test(r));
  if (isTargetCivil) {
    const isDisjointFromCivil = /\b(marketing|sales|recruiter|hr|accountant|finance|nurse|software|frontend|backend)\b/i.test(lowerTitle);
    if (isDisjointFromCivil && !/\bcivil\b/i.test(lowerTitle)) {
      return true;
    }
  }

  // If target is Healthcare / Nurse
  const isTargetHealthcare = targetRoles.some((r) => /nurse|doctor|healthcare/i.test(r));
  if (isTargetHealthcare) {
    const isDisjointFromHealthcare = /\b(software|developer|marketing|sales|mechanical|civil|electrical)\b/i.test(lowerTitle);
    if (isDisjointFromHealthcare && !/\b(nurse|nursing|doctor|clinical|medical)\b/i.test(lowerTitle)) {
      return true;
    }
  }

  // If target is Finance / Accountant
  const isTargetFinance = targetRoles.some((r) => /accountant|accounting|financial/i.test(r));
  if (isTargetFinance) {
    const isDisjointFromFinance = /\b(software|developer|nurse|doctor|mechanical|civil|electrical)\b/i.test(lowerTitle);
    if (isDisjointFromFinance && !/\b(accountant|accounting|finance|financial|cpa|auditor)\b/i.test(lowerTitle)) {
      return true;
    }
  }

  return false;
}

export interface GeoLocationInfo {
  city?: string;
  state?: string;
  country: string;
  continent: string;
  synonyms: string[];
}

export const KNOWN_GEO_REGIONS: Record<string, GeoLocationInfo> = {
  // Indian Tech Hubs & Major Cities
  bengaluru: {
    city: "Bengaluru",
    state: "Karnataka",
    country: "India",
    continent: "Asia",
    synonyms: ["bengaluru", "bangalore", "blr", "electronic city", "whitefield", "bellandur", "marathahalli", "koramangala", "indiranagar", "karnataka"],
  },
  hyderabad: {
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    continent: "Asia",
    synonyms: ["hyderabad", "hyd", "cyberabad", "hitec city", "gachibowli", "telangana", "secunderabad"],
  },
  pune: {
    city: "Pune",
    state: "Maharashtra",
    country: "India",
    continent: "Asia",
    synonyms: ["pune", "hinjawadi", "magarpatta", "maharashtra"],
  },
  mumbai: {
    city: "Mumbai",
    state: "Maharashtra",
    country: "India",
    continent: "Asia",
    synonyms: ["mumbai", "bombay", "navi mumbai", "thane", "maharashtra"],
  },
  delhi: {
    city: "Delhi",
    state: "Delhi NCR",
    country: "India",
    continent: "Asia",
    synonyms: ["delhi", "new delhi", "ncr", "noida", "gurgaon", "gurugram", "faridabad", "ghaziabad"],
  },
  chennai: {
    city: "Chennai",
    state: "Tamil Nadu",
    country: "India",
    continent: "Asia",
    synonyms: ["chennai", "madras", "tamil nadu", "tamilnadu"],
  },
  kolkata: {
    city: "Kolkata",
    state: "West Bengal",
    country: "India",
    continent: "Asia",
    synonyms: ["kolkata", "calcutta", "west bengal"],
  },
  ahmedabad: {
    city: "Ahmedabad",
    state: "Gujarat",
    country: "India",
    continent: "Asia",
    synonyms: ["ahmedabad", "gandhinagar", "gujarat"],
  },
  kochi: {
    city: "Kochi",
    state: "Kerala",
    country: "India",
    continent: "Asia",
    synonyms: ["kochi", "cochin", "kerala", "infopark", "kakkanad"],
  },
  chandigarh: {
    city: "Chandigarh",
    state: "Punjab/Haryana",
    country: "India",
    continent: "Asia",
    synonyms: ["chandigarh", "mohali", "panchkula"],
  },
  jaipur: {
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    continent: "Asia",
    synonyms: ["jaipur", "rajasthan"],
  },
  lucknow: {
    city: "Lucknow",
    state: "Uttar Pradesh",
    country: "India",
    continent: "Asia",
    synonyms: ["lucknow", "uttar pradesh", "up"],
  },
  // Entire Country India
  india: {
    country: "India",
    continent: "Asia",
    synonyms: ["india", "in", "pan-india", "all india", "bharat"],
  },

  // Egypt Hubs
  egypt: {
    country: "Egypt",
    continent: "Africa",
    synonyms: ["egypt", "cairo", "new cairo", "alexandria", "giza", "shubra", "6th of october", "suez", "mansoura"],
  },
  cairo: {
    city: "Cairo",
    country: "Egypt",
    continent: "Africa",
    synonyms: ["cairo", "new cairo", "egypt", "giza"],
  },

  // USA Major Hubs
  "san francisco": {
    city: "San Francisco",
    state: "CA",
    country: "United States",
    continent: "North America",
    synonyms: ["san francisco", "sf", "bay area", "silicon valley", "palo alto", "mountain view", "sunnyvale", "san jose", "menlo park"],
  },
  "new york": {
    city: "New York",
    state: "NY",
    country: "United States",
    continent: "North America",
    synonyms: ["new york", "nyc", "ny", "manhattan", "brooklyn"],
  },
  seattle: {
    city: "Seattle",
    state: "WA",
    country: "United States",
    continent: "North America",
    synonyms: ["seattle", "bellevue", "redmond", "wa"],
  },
  austin: {
    city: "Austin",
    state: "TX",
    country: "United States",
    continent: "North America",
    synonyms: ["austin", "tx", "texas"],
  },
  boston: {
    city: "Boston",
    state: "MA",
    country: "United States",
    continent: "North America",
    synonyms: ["boston", "cambridge ma", "ma", "massachusetts"],
  },
  chicago: {
    city: "Chicago",
    state: "IL",
    country: "United States",
    continent: "North America",
    synonyms: ["chicago", "il", "illinois"],
  },
  "los angeles": {
    city: "Los Angeles",
    state: "CA",
    country: "United States",
    continent: "North America",
    synonyms: ["los angeles", "la", "santa monica", "culver city"],
  },
  usa: {
    country: "United States",
    continent: "North America",
    synonyms: ["usa", "united states", "us", "u.s.", "u.s.a."],
  },

  // UK Hubs
  london: {
    city: "London",
    country: "United Kingdom",
    continent: "Europe",
    synonyms: ["london", "uk", "greater london"],
  },
  uk: {
    country: "United Kingdom",
    continent: "Europe",
    synonyms: ["uk", "united kingdom", "great britain", "england", "scotland", "wales"],
  },

  // Germany Hubs
  berlin: {
    city: "Berlin",
    country: "Germany",
    continent: "Europe",
    synonyms: ["berlin", "germany", "deutschland"],
  },
  germany: {
    country: "Germany",
    continent: "Europe",
    synonyms: ["germany", "deutschland", "de"],
  },

  // Canada Hubs
  toronto: {
    city: "Toronto",
    state: "Ontario",
    country: "Canada",
    continent: "North America",
    synonyms: ["toronto", "gta", "ontario", "waterloo", "canada"],
  },
  canada: {
    country: "Canada",
    continent: "North America",
    synonyms: ["canada", "ca"],
  },

  // Singapore
  singapore: {
    city: "Singapore",
    country: "Singapore",
    continent: "Asia",
    synonyms: ["singapore", "sg"],
  },

  // UAE Hubs
  dubai: {
    city: "Dubai",
    country: "UAE",
    continent: "Middle East",
    synonyms: ["dubai", "uae", "abu dhabi"],
  },
};

export function resolveLocationGeo(locationStr?: string | null): {
  normalized: string;
  country?: string;
  continent?: string;
  city?: string;
  isRemoteOnly: boolean;
} {
  if (!locationStr || !locationStr.trim()) {
    return { normalized: "", isRemoteOnly: false };
  }
  const clean = locationStr.trim().toLowerCase();
  const isRemoteOnly = /^(remote|anywhere|work from home|wfh|telecommute|virtual)$/i.test(clean) ||
    (/remote/i.test(clean) && !Object.values(KNOWN_GEO_REGIONS).some((g) => g.synonyms.some((syn) => clean.includes(syn))));

  for (const [, info] of Object.entries(KNOWN_GEO_REGIONS)) {
    if (info.synonyms.some((syn) => {
      if (syn.length <= 3) {
        return new RegExp(`\\b${syn}\\b`, "i").test(clean);
      }
      return clean.includes(syn);
    })) {
      return {
        normalized: info.city || info.country,
        country: info.country,
        continent: info.continent,
        city: info.city,
        isRemoteOnly,
      };
    }
  }

  // Fallback heuristic detection for countries
  if (/\b(india|bharat)\b/i.test(clean)) return { normalized: "India", country: "India", continent: "Asia", isRemoteOnly };
  if (/\b(egypt|cairo|alexandria)\b/i.test(clean)) return { normalized: "Egypt", country: "Egypt", continent: "Africa", isRemoteOnly };
  if (/\b(usa|united states|us\b)\b/i.test(clean)) return { normalized: "United States", country: "United States", continent: "North America", isRemoteOnly };
  if (/\b(united kingdom|uk\b|london|great britain|england)\b/i.test(clean)) return { normalized: "United Kingdom", country: "United Kingdom", continent: "Europe", isRemoteOnly };
  if (/\b(germany|deutschland)\b/i.test(clean)) return { normalized: "Germany", country: "Germany", continent: "Europe", isRemoteOnly };
  if (/\b(canada)\b/i.test(clean)) return { normalized: "Canada", country: "Canada", continent: "North America", isRemoteOnly };
  if (/\b(australia)\b/i.test(clean)) return { normalized: "Australia", country: "Australia", continent: "Oceania", isRemoteOnly };

  return { normalized: clean, isRemoteOnly };
}

export function evaluateLocationCompatibility(
  candidateLocation: string | undefined,
  planLocations: string[],
  candidateWorkMode?: string,
  isExplicitLocation: boolean = false
): { isMatch: boolean; rejectionReason?: string } {
  if (!planLocations || planLocations.length === 0) {
    return { isMatch: true };
  }

  const activeTargets = planLocations.filter(
    (l) => l && !/^(any|all|worldwide|anywhere|global)$/i.test(l.trim())
  );
  if (activeTargets.length === 0) {
    return { isMatch: true };
  }

  const candLoc = (candidateLocation || "").trim();
  const candWorkMode = (candidateWorkMode || "").toUpperCase();
  const isCandidateRemote = candWorkMode === "REMOTE" || /\bremote\b/i.test(candLoc);

  if (!candLoc) {
    if (isCandidateRemote) {
      return { isMatch: true };
    }
    if (isExplicitLocation) {
      return {
        isMatch: false,
        rejectionReason: `Job posting has no location metadata under explicit location search for "${activeTargets.join(", ")}"`,
      };
    }
    return { isMatch: true };
  }

  const candGeo = resolveLocationGeo(candLoc);

  let hasExactCityOrSynonymMatch = false;
  let hasCountryMismatch = false;
  let mismatchedCountryName = "";
  let targetCountryName = "";
  let hasDifferentCityInSameCountry = false;

  for (const rawTarget of activeTargets) {
    const targetGeo = resolveLocationGeo(rawTarget);
    const targetNorm = rawTarget.toLowerCase().trim();
    const candNorm = candLoc.toLowerCase().trim();

    const targetDef = KNOWN_GEO_REGIONS[targetNorm] || Object.values(KNOWN_GEO_REGIONS).find((g) =>
      g.synonyms.some((s) => s.toLowerCase() === targetNorm || targetNorm.includes(s))
    );

    if (targetDef) {
      const matchesTargetSynonym = targetDef.synonyms.some((syn) => {
        if (syn.length <= 3) return new RegExp(`\\b${syn}\\b`, "i").test(candNorm);
        return candNorm.includes(syn);
      });
      if (matchesTargetSynonym) {
        hasExactCityOrSynonymMatch = true;
        break;
      }
    } else {
      if (candNorm.includes(targetNorm) || targetNorm.includes(candNorm)) {
        hasExactCityOrSynonymMatch = true;
        break;
      }
    }

    if (targetGeo.country && candGeo.country) {
      if (targetGeo.country.toLowerCase() !== candGeo.country.toLowerCase()) {
        hasCountryMismatch = true;
        mismatchedCountryName = candGeo.country;
        targetCountryName = targetGeo.country;
      } else {
        if (targetGeo.city && candGeo.city && targetGeo.city.toLowerCase() !== candGeo.city.toLowerCase()) {
          hasDifferentCityInSameCountry = true;
        }
      }
    }
  }

  if (hasExactCityOrSynonymMatch) {
    return { isMatch: true };
  }

  // Cross-border / foreign country mismatch: Strictly REJECT even if tagged remote
  if (hasCountryMismatch) {
    return {
      isMatch: false,
      rejectionReason: `Location "${candLoc}" is geographically disjoint from requested location "${activeTargets.join(", ")}" (cross-border: ${mismatchedCountryName} vs ${targetCountryName})`,
    };
  }

  // Different city in same country
  if (hasDifferentCityInSameCountry) {
    if (!isCandidateRemote) {
      return {
        isMatch: false,
        rejectionReason: `Location "${candLoc}" is on-site in a different city than requested "${activeTargets.join(", ")}"`,
      };
    }
    return { isMatch: true };
  }

  if (candGeo.isRemoteOnly || isCandidateRemote) {
    return { isMatch: true };
  }

  if (isExplicitLocation) {
    return {
      isMatch: false,
      rejectionReason: `Location "${candLoc}" does not match requested location "${activeTargets.join(", ")}"`,
    };
  }

  return { isMatch: true };
}

/**
 * Single authoritative Quality Gate evaluation for a raw job candidate.
 */
export function evaluateCandidateQualityGate(
  candidate: RawJobCandidate,
  plan: DiscoveryPlan,
  referenceTime: Date = new Date()
): QualityGateEvaluation {
  const rejectionReasons: string[] = [];

  // 1. Required Metadata Validation (Title & Company)
  const rawTitle = (candidate.title || "").trim();
  if (!rawTitle || rawTitle.length < 3) {
    rejectionReasons.push("Job title is missing or too short");
  } else if (INVALID_TITLE_PATTERNS.some((p) => p.test(rawTitle))) {
    rejectionReasons.push(`Job title matches invalid placeholder pattern: "${rawTitle}"`);
  }

  const rawCompany = (candidate.companyName || (candidate as any).company || "").trim();
  if (!rawCompany || rawCompany.length < 2) {
    rejectionReasons.push("Company name is missing or too short");
  } else if (INVALID_COMPANY_PATTERNS.some((p) => p.test(rawCompany))) {
    rejectionReasons.push(`Company name matches invalid placeholder pattern: "${rawCompany}"`);
  }

  // 2. Job URL Classification & Validation
  const primaryUrl = candidate.sourceUrl || candidate.applyUrl || "";
  const applyUrl = candidate.applyUrl || candidate.sourceUrl || "";
  let urlType = classifyJobUrl(primaryUrl);
  let effectiveJobUrl = primaryUrl;

  if (/boards\.ashby\.io/i.test(primaryUrl) || /boards\.ashby\.io/i.test(applyUrl)) {
    rejectionReasons.push("URL points to mock/synthetic ATS domain: boards.ashby.io");
  }

  // If primaryUrl was classified as generic portal, check if applyUrl is an exact job detail URL
  if (urlType !== "JOB_DETAIL") {
    const applyType = classifyJobUrl(applyUrl);
    if (applyType === "JOB_DETAIL") {
      urlType = "JOB_DETAIL";
      effectiveJobUrl = applyUrl;
    }
  }

  if (urlType !== "JOB_DETAIL") {
    rejectionReasons.push(`URL points to a generic portal (${urlType}) rather than a specific job posting page`);
  }

  // 3. Deterministic Date Extraction & Freshness Gating
  let postedAt = candidate.postedAt instanceof Date ? candidate.postedAt : candidate.postedAt ? new Date(candidate.postedAt) : null;
  let postedAgoText = candidate.postedAgoText;

  if (!postedAt && (candidate.rawSnippet || candidate.description)) {
    const signal = parsePostingDate(candidate.rawSnippet || candidate.description, referenceTime);
    if (signal.postedAt) {
      postedAt = signal.postedAt;
      postedAgoText = signal.postedAgoText;
    }
  }

  let ageHours: number | undefined;
  if (postedAt && !isNaN(postedAt.getTime())) {
    const refMs = referenceTime.getTime();
    const postedMs = postedAt.getTime();
    const effectivePostedMs = postedMs > refMs ? refMs : postedMs;
    ageHours = (refMs - effectivePostedMs) / (3600 * 1000);
  }

  if (plan.isExplicitFreshness) {
    if (!postedAt || isNaN(postedAt.getTime())) {
      rejectionReasons.push("Posting date could not be verified under explicit time-bound search");
    } else if (!isWithinFreshnessWindow(postedAt, plan.freshnessWindowHours, true, referenceTime)) {
      const daysOld = ageHours ? (ageHours / 24).toFixed(1) : "unknown";
      rejectionReasons.push(`Posting is ${daysOld} days old (exceeds requested ${plan.freshnessWindowHours}h / ${Math.round(plan.freshnessWindowHours / 24)}d window)`);
    }
  }

  // 4. Role Relevance Check
  let roleMatch = true;
  if (plan.roles && plan.roles.length > 0) {
    if (isDisjointRole(rawTitle, plan.roles)) {
      roleMatch = false;
      rejectionReasons.push(`Role "${rawTitle}" is semantically disjoint from requested role "${plan.roles.join(", ")}"`);
    }
  }

  // 5. Seniority Alignment Check
  let seniorityMatch = true;
  if (plan.experienceLevels && plan.experienceLevels.length > 0 && !plan.experienceLevels.includes("ANY")) {
    const candSeniority = extractSeniority(rawTitle);
    const requestedLevels = plan.experienceLevels;
    if (requestedLevels.includes("ENTRY_LEVEL") || requestedLevels.includes("INTERN")) {
      if (candSeniority === "SENIOR" || candSeniority === "LEAD") {
        seniorityMatch = false;
        rejectionReasons.push(`Seniority of "${rawTitle}" (${candSeniority}) conflicts with entry-level request`);
      }
    }
  }

  // 6. Location Compatibility & Strict Regional Gating
  let locationMatch = true;
  const activePlanLocations = plan.locations && plan.locations.length > 0
    ? plan.locations
    : (plan.location ? [plan.location] : []);

  if (activePlanLocations.length > 0) {
    const locCompat = evaluateLocationCompatibility(
      candidate.location,
      activePlanLocations,
      candidate.workMode,
      Boolean(plan.isExplicitLocation)
    );
    if (!locCompat.isMatch) {
      locationMatch = false;
      if (locCompat.rejectionReason) {
        rejectionReasons.push(locCompat.rejectionReason);
      }
    }
  }

  // 7. Metadata Confidence Evaluation
  const metadataConfidence = evaluateMetadataConfidence({
    title: rawTitle,
    companyName: rawCompany,
    postedAt,
    sourceUrl: effectiveJobUrl,
    applyUrl,
  });

  const isEligible = rejectionReasons.length === 0;

  return {
    isEligible,
    rejectionReasons,
    metadataConfidence,
    urlType,
    parsedPostingDate: postedAt,
    postedAgoText: postedAgoText || undefined,
    ageHours,
    roleMatch,
    seniorityMatch,
    locationMatch,
  };
}
