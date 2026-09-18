/**
 * INTENT DISTILLATION & MULTI-TENANT PII SANITIZATION
 * 
 * Sanitizes discovery searches before dispatching to external scrapers,
 * aggregators, and ATS providers. Strips out all personal user PII
 * (emails, phone numbers, personal names, resumes, private notes),
 * emitting only clean canonical queries (role, location, workMode, skills).
 */

import { type SearchIntent } from "./providers/baseProvider";
import { type DiscoveryPlan } from "./discoveryPlanner";
import { parseSearchIntent } from "./intentParser";

export interface DistilledSearchIntent {
  role?: string;
  roles: string[];
  skills: string[];
  location?: string;
  locations: string[];
  workMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  workModes: string[];
  experienceLevel?: string;
  experienceLevels: string[];
  opportunityType?: string;
  opportunityTypes: string[];
  company?: string;
  companies: string[];
  freshnessWindowHours?: number;
  postedWithinDays?: number;
  requestedCount?: number;
  sanitizedQuery: string;
  strippedPiiCount: number;
  strippedPiiTypes: string[];
}

export interface IntentDistillationOptions {
  allowCompanyTargeting?: boolean;
  maxSkillsCount?: number;
  preserveFreshness?: boolean;
}

// Canonical PII detection patterns
const PII_PATTERNS = {
  // Standard RFC 5322 compliant email matching
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/gi,

  // Obfuscated email patterns (e.g., user [at] example [dot] com, user(at)domain(dot)io)
  obfuscatedEmail: /\b[A-Za-z0-9._%+-]+\s*(?:@|\[at\]|\(at\)|\bat\b)\s*[A-Za-z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\bdot\b)\s*[A-Za-z]{2,}\b/gi,

  // North American and international phone formats with country codes
  phone: /(?:(?:\+\d{1,4}[-.\s]*)?(?:\(?\d{2,4}\)?[-.\s]*)?\d{3,5}[-.\s]*\d{3,5}(?:[-.\s]*\d{3,5})?(?:\s*(?:#|x\.?|ext\.?|extension)\s*\d+)?|\b\d{3}[-.\s]?\d{4}\b)/g,

  // Common US SSN pattern
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,

  // Personal self-identifying statements: "my name is John Doe", "I am Jane Doe"
  personalIntro: /\b(?:my\s+name\s+is|i\s+am|i'm|this\s+is)\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/gi,

  // Contact requests: "contact me at ...", "reach me at ...", "email me at ...", "call ...", "contact: ..."
  contactDirective: /\b(?:contact|reach|email|ping|call|message)(?:\s+me)?(?:\s+at|\s*:|\s+on|\s+via)?\s*[\S]+/gi,

  // Resume or CV dump blocks
  resumeDump: /\b(?:here\s+is\s+my\s+resume|my\s+cv|curriculum\s+vitae|resume\s+summary|attached\s+resume)\s*[:\-]?\s*[^.\n]+(?:\.|\n|$)/gi,

  // Private user notes and confidential tags
  privateNotes: /\b(?:private\s*notes?|personal\s*notes?|confidential|internal\s*notes?|user\s*notes?|secret)\s*[:\-]?\s*[^.\n]*(?:\.|\n|$)/gi,

  // Compensation disclosures: "my current salary is $150k", "making $120,000"
  salaryDisclosure: /\b(?:my\s+current\s+salary\s+is|i\s+currently\s+make|currently\s+earning|making)\s+[\$£€\d,\.kK]+/gi,
};

/**
 * Sanitizes raw text by scrubbing personal PII, contact info, and private notes.
 */
export function sanitizeQueryText(rawText?: string | null): {
  cleanText: string;
  strippedCount: number;
  strippedTypes: string[];
} {
  if (!rawText || typeof rawText !== "string") {
    return { cleanText: "", strippedCount: 0, strippedTypes: [] };
  }

  let text = rawText;
  let strippedCount = 0;
  const strippedTypes: string[] = [];

  for (const [piiType, regex] of Object.entries(PII_PATTERNS)) {
    const matches = text.match(regex);
    if (matches && matches.length > 0) {
      strippedCount += matches.length;
      strippedTypes.push(piiType);
      text = text.replace(regex, " ");
    }
  }

  // Clean excessive whitespace, punctuation artifacts, and trim
  const cleanText = text
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/^\s*[,.\-:]\s*/, "")
    .replace(/\s*[,.\-:]\s*$/, "")
    .trim();

  return { cleanText, strippedCount, strippedTypes };
}

/**
 * Distills any raw input (query string, partial SearchIntent, or DiscoveryPlan)
 * into a verified, canonical, PII-free DistilledSearchIntent.
 */
export function distillIntent(
  input: string | Partial<SearchIntent> | DiscoveryPlan,
  options: IntentDistillationOptions = {}
): DistilledSearchIntent {
  let rawQuery = "";
  let baseIntent: Partial<SearchIntent> = {};
  let totalStrippedCount = 0;
  const collectedTypes = new Set<string>();

  if (typeof input === "string") {
    rawQuery = input;
    const { cleanText, strippedCount, strippedTypes } = sanitizeQueryText(input);
    totalStrippedCount += strippedCount;
    strippedTypes.forEach((t) => collectedTypes.add(t));

    baseIntent = parseSearchIntent(cleanText);
  } else if ("rawQuery" in input && typeof input.rawQuery === "string") {
    rawQuery = input.rawQuery;
    const { cleanText, strippedCount, strippedTypes } = sanitizeQueryText(input.rawQuery);
    totalStrippedCount += strippedCount;
    strippedTypes.forEach((t) => collectedTypes.add(t));

    baseIntent = {
      role: input.role,
      roles: input.roles,
      skills: input.skills,
      location: input.location,
      locations: input.locations,
      workMode: input.workMode,
      workModes: input.workModes,
      opportunityType: input.opportunityType,
      opportunityTypes: input.opportunityTypes,
      experienceLevel: input.experienceLevel,
      experienceLevels: input.experienceLevels,
      company: input.company,
      companies: input.companies || input.targetCompanies,
      freshnessWindowHours: input.freshnessWindowHours,
      postedWithinDays: input.postedWithinDays,
      requestedCount: input.requestedCount,
    };
  } else {
    baseIntent = { ...input };
    if (baseIntent.queryHint) {
      const { cleanText, strippedCount, strippedTypes } = sanitizeQueryText(baseIntent.queryHint);
      totalStrippedCount += strippedCount;
      strippedTypes.forEach((t) => collectedTypes.add(t));
      baseIntent.queryHint = cleanText;
    }
  }

  // Canonicalize Role
  let role = baseIntent.role ? sanitizeQueryText(baseIntent.role).cleanText : undefined;
  let roles = Array.isArray(baseIntent.roles)
    ? baseIntent.roles.map((r) => sanitizeQueryText(r).cleanText).filter(Boolean)
    : role ? [role] : [];

  if (!role && roles.length > 0) {
    role = roles[0];
  }

  // Canonicalize Location (Ensure "Remote" is mapped to workMode, not geographic location)
  let location = baseIntent.location ? sanitizeQueryText(baseIntent.location).cleanText : undefined;
  let locations = Array.isArray(baseIntent.locations)
    ? baseIntent.locations.map((l) => sanitizeQueryText(l).cleanText).filter(Boolean)
    : location ? [location] : [];

  const hasRemoteInLocations = locations.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l));
  locations = locations.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l));
  if (location && /^(remote|fully\s*remote|remote-first)$/i.test(location)) {
    location = locations[0];
  }

  // Canonicalize WorkMode
  let workMode = baseIntent.workMode;
  let workModes = Array.isArray(baseIntent.workModes) ? [...baseIntent.workModes] : workMode ? [workMode] : [];
  if (hasRemoteInLocations && !workModes.includes("REMOTE")) {
    workModes.push("REMOTE");
    if (!workMode || workMode === "ANY") {
      workMode = "REMOTE";
    }
  }

  // Canonicalize Skills (Bounded, PII-free, and canonicalized)
  const rawSkills = Array.isArray(baseIntent.skills) ? baseIntent.skills : [];
  const maxSkills = options.maxSkillsCount || 10;
  const cleanedSkills: string[] = [];

  for (const s of rawSkills) {
    if (typeof s !== "string") continue;
    const clean = sanitizeQueryText(s).cleanText;
    // Skip empty, leftover PII labels (e.g. "SSN", "phone", "email"), or strings that fail isDistilledSafe
    if (
      clean &&
      clean.length >= 2 &&
      !/^(ssn|email|mail|phone|telephone|tel|mobile|cell|contact|notes?|personal|private|secret|confidential|resume|cv|salary|compensation)$/i.test(clean) &&
      isDistilledSafe({ skills: [clean] }) &&
      !cleanedSkills.includes(clean)
    ) {
      cleanedSkills.push(clean);
      if (cleanedSkills.length >= maxSkills) break;
    }
  }

  // Canonicalize Companies (Gated if requested)
  let company: string | undefined = undefined;
  let companies: string[] = [];

  if (options.allowCompanyTargeting !== false) {
    company = baseIntent.company ? sanitizeQueryText(baseIntent.company).cleanText : undefined;
    if (company && /^(notes?|personal|private|confidential|internal|secret|do not|candidate)/i.test(company)) {
      company = undefined;
    }
    companies = Array.isArray(baseIntent.companies)
      ? baseIntent.companies
          .map((c) => sanitizeQueryText(c).cleanText)
          .filter((c) => c.length > 0 && !/^(notes?|personal|private|confidential|internal|secret|do not|candidate)/i.test(c))
      : company ? [company] : [];

    if (!company && companies.length > 0) {
      company = companies[0];
    }
    if (company && !companies.includes(company)) {
      companies.unshift(company);
    }
  }

  // Build clean sanitizedQuery string for outbound search scrapers
  const queryTokens: string[] = [];
  if (role) queryTokens.push(role);
  if (cleanedSkills.length > 0) queryTokens.push(cleanedSkills.slice(0, 3).join(" "));
  if (location) queryTokens.push(location);
  if (workMode && workMode !== "ANY" && workMode !== location) queryTokens.push(workMode);

  const sanitizedQuery = queryTokens.join(" ").trim() || role || "Software Engineer";

  return {
    role,
    roles,
    skills: cleanedSkills,
    location,
    locations,
    workMode,
    workModes,
    experienceLevel: baseIntent.experienceLevel,
    experienceLevels: baseIntent.experienceLevels || (baseIntent.experienceLevel ? [baseIntent.experienceLevel] : []),
    opportunityType: baseIntent.opportunityType,
    opportunityTypes: baseIntent.opportunityTypes || (baseIntent.opportunityType ? [baseIntent.opportunityType] : []),
    company,
    companies,
    freshnessWindowHours: baseIntent.freshnessWindowHours,
    postedWithinDays: baseIntent.postedWithinDays,
    requestedCount: baseIntent.requestedCount || 30,
    sanitizedQuery,
    strippedPiiCount: totalStrippedCount,
    strippedPiiTypes: Array.from(collectedTypes),
  };
}

/**
 * Distills and cleans an existing DiscoveryPlan, stripping all PII from its
 * criteria and raw queries before provider dispatch.
 */
export function distillDiscoveryPlan(plan: DiscoveryPlan): DiscoveryPlan {
  const distilled = distillIntent(plan);

  return {
    ...plan,
    rawQuery: distilled.sanitizedQuery,
    role: distilled.role,
    roles: distilled.roles,
    skills: distilled.skills,
    location: distilled.location,
    locations: distilled.locations,
    workMode: distilled.workMode,
    workModes: distilled.workModes,
    company: distilled.company,
    companies: distilled.companies,
    targetCompanies: distilled.companies,
  };
}

/**
 * Security Assertion: Validates that an intent contains zero detectable PII.
 */
export function isDistilledSafe(intent: Partial<SearchIntent> | DistilledSearchIntent): boolean {
  const fieldsToCheck = [
    intent.role,
    intent.location,
    intent.company,
    ...(intent.roles || []),
    ...(intent.locations || []),
    ...(intent.skills || []),
    ...(intent.companies || []),
    (intent as any).rawQuery,
    (intent as any).queryHint,
    (intent as any).sanitizedQuery,
  ].filter((f): f is string => typeof f === "string" && f.length > 0);

  for (const field of fieldsToCheck) {
    for (const regex of Object.values(PII_PATTERNS)) {
      regex.lastIndex = 0;
      if (regex.test(field)) {
        return false;
      }
    }
  }

  return true;
}
