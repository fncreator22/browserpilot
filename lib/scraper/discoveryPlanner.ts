/**
 * §DISCOVERY PLANNER & INTENT NORMALIZER (TASK-018)
 * Converts natural language queries and persistent user profile preferences
 * into a deterministic DiscoveryPlan for the swarm search engine.
 * 
 * 100% deterministic — 0 LLM token overhead.
 */

import { type SearchIntent } from "./providers/baseProvider";
import { parseSearchIntent } from "./intentParser";

export interface UserProfilePreferences {
  skills?: string[];
  educationLevel?: string;
  experienceLevel?: "INTERN" | "ENTRY_LEVEL" | "MID" | "SENIOR" | string;
  preferredOpportunityType?: "INTERNSHIP" | "FULL_TIME" | "CONTRACT" | string;
  preferredLocations?: string[];
  preferredWorkMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  targetCompanies?: string[];
  targetRoles?: string[];
  gradYear?: number;
  freshnessWindowHours?: number;
  sortMode?: SortMode;
  minimumMatchScore?: number;
  preferredSources?: string[];
}

export type SortMode = "RELEVANCE" | "LATEST" | "RELEVANCE_THEN_FRESHNESS";

export interface DiscoveryPlan {
  rawQuery: string;
  roles: string[];
  skills: string[];
  locations: string[];
  workModes: string[];
  opportunityTypes: string[];
  experienceLevels: string[];
  targetCompanies: string[];
  freshnessWindowHours: number;
  maxResultsPerSource: number;
  sources: string[];
  sortMode: SortMode;
  isLatestIntent: boolean;
  targetGradYear?: number | null;
  minimumMatchScore?: number;
  excludeKnown?: boolean;
  watchIntent?: {
    enabled: boolean;
    scanIntervalHours?: number;
  };
}

/**
 * Maps skill alias to canonical display name
 */
function canonicalizeSkill(skill: string): string {
  const s = skill.trim();
  const lower = s.toLowerCase();
  if (lower === "react" || lower === "reactjs" || lower === "react.js") return "React";
  if (lower === "next.js" || lower === "nextjs" || lower === "next") return "Next.js";
  if (lower === "typescript" || lower === "ts") return "TypeScript";
  if (lower === "javascript" || lower === "js") return "JavaScript";
  if (lower === "node.js" || lower === "nodejs" || lower === "node") return "Node.js";
  if (lower === "python" || lower === "py") return "Python";
  if (lower === "ai" || lower === "ai/ml" || lower === "ml") return "AI";
  if (lower === "pytorch") return "PyTorch";
  if (lower === "tensorflow") return "TensorFlow";
  if (lower === "golang" || lower === "go") return "Golang";
  if (lower === "postgresql" || lower === "postgres") return "PostgreSQL";
  if (lower === "mongodb" || lower === "mongo") return "MongoDB";
  if (lower === "docker" || lower === "k8s") return "Docker";
  if (lower === "aws") return "AWS";
  if (lower === "gcp") return "GCP";
  if (lower === "azure") return "Azure";
  if (lower === "tailwind") return "Tailwind";
  if (lower === "graphql") return "GraphQL";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Builds a deterministic DiscoveryPlan from raw natural language queries and profile preferences.
 * Explicit user query constraints strictly take precedence over inferred profile preferences.
 */
export function buildDiscoveryPlan(
  rawQuery: string = "",
  filters: Partial<SearchIntent> = {},
  profile?: UserProfilePreferences
): DiscoveryPlan {
  // 1. Parse baseline intent from natural language
  const parsedIntent = parseSearchIntent(rawQuery, filters);

  // 2. Resolve Roles (Strict explicit precedence: filters.roles -> filters.role -> parsedIntent.roles -> profile.targetRoles)
  const rolesSet = new Set<string>();
  if (filters.roles && filters.roles.length > 0) {
    filters.roles.forEach((r) => rolesSet.add(r));
  } else if (filters.role) {
    rolesSet.add(filters.role);
  } else if (parsedIntent.roles && parsedIntent.roles.length > 0) {
    parsedIntent.roles.forEach((r) => rolesSet.add(r));
  } else if (parsedIntent.role) {
    rolesSet.add(parsedIntent.role);
  } else if (profile?.targetRoles && profile.targetRoles.length > 0) {
    profile.targetRoles.forEach((r) => rolesSet.add(r));
  }

  if (rolesSet.size === 0) {
    rolesSet.add("Software Engineer");
  }

  const rolesList = Array.from(rolesSet);

  // 3. Resolve Skills (Strict explicit precedence: filters.skills -> parsedIntent.skills -> backfill with profile.skills)
  const skillsSet = new Set<string>();
  if (filters.skills && filters.skills.length > 0) {
    filters.skills.forEach((s) => skillsSet.add(canonicalizeSkill(s)));
  } else if (parsedIntent.skills && parsedIntent.skills.length > 0) {
    parsedIntent.skills.forEach((s) => skillsSet.add(canonicalizeSkill(s)));
  }

  // Backfill with user profile skills up to 6 skills total without hallucinating
  if (profile?.skills && skillsSet.size < 6) {
    for (const skill of profile.skills) {
      if (skillsSet.size >= 6) break;
      skillsSet.add(canonicalizeSkill(skill));
    }
  }

  const skillsList = Array.from(skillsSet);

  // 4. Resolve Locations (Strict explicit precedence: filters.locations -> filters.location -> parsedIntent.locations -> profile.preferredLocations)
  const locationsSet = new Set<string>();
  if (filters.locations && filters.locations.length > 0) {
    filters.locations.forEach((l) => locationsSet.add(l));
  } else if (filters.location) {
    locationsSet.add(filters.location);
  } else if (parsedIntent.locations && parsedIntent.locations.length > 0) {
    parsedIntent.locations.forEach((l) => locationsSet.add(l));
  } else if (parsedIntent.location) {
    locationsSet.add(parsedIntent.location);
  } else if (profile?.preferredLocations && profile.preferredLocations.length > 0) {
    profile.preferredLocations.forEach((l) => locationsSet.add(l));
  }

  const locationsList = Array.from(locationsSet);

  // 5. Resolve Work Modes (Strict explicit precedence)
  const workModesSet = new Set<string>();
  if (filters.workModes && filters.workModes.length > 0) {
    filters.workModes.forEach((wm) => workModesSet.add(wm.toUpperCase()));
  } else if (filters.workMode) {
    workModesSet.add(filters.workMode.toUpperCase());
  } else if (parsedIntent.workModes && parsedIntent.workModes.length > 0 && parsedIntent.workMode !== "ANY") {
    parsedIntent.workModes.forEach((wm) => workModesSet.add(wm.toUpperCase()));
  } else if (profile?.preferredWorkMode && profile.preferredWorkMode !== "ANY") {
    workModesSet.add(profile.preferredWorkMode.toUpperCase());
  } else {
    workModesSet.add("ANY");
  }

  const workModesList = Array.from(workModesSet);

  // 6. Resolve Opportunity Types & Experience Levels (Strict explicit precedence)
  const oppTypesSet = new Set<string>();
  if (filters.opportunityTypes && filters.opportunityTypes.length > 0) {
    filters.opportunityTypes.forEach((ot) => oppTypesSet.add(ot));
  } else if (filters.opportunityType) {
    oppTypesSet.add(filters.opportunityType);
  } else if (profile?.preferredOpportunityType) {
    oppTypesSet.add(profile.preferredOpportunityType);
  } else if (parsedIntent.opportunityTypes && parsedIntent.opportunityTypes.length > 0) {
    parsedIntent.opportunityTypes.forEach((ot) => oppTypesSet.add(ot));
  } else {
    oppTypesSet.add("FULL_TIME");
    oppTypesSet.add("INTERNSHIP");
  }

  const expLevelsSet = new Set<string>();
  if (filters.experienceLevels && filters.experienceLevels.length > 0) {
    filters.experienceLevels.forEach((el) => expLevelsSet.add(el));
  } else if (filters.experienceLevel) {
    expLevelsSet.add(filters.experienceLevel);
  } else if (profile?.experienceLevel) {
    expLevelsSet.add(profile.experienceLevel);
  } else if (parsedIntent.experienceLevels && parsedIntent.experienceLevels.length > 0) {
    parsedIntent.experienceLevels.forEach((el) => expLevelsSet.add(el));
  } else {
    expLevelsSet.add("ENTRY_LEVEL");
    expLevelsSet.add("INTERN");
  }

  // 7. Resolve Target Companies (Strict explicit precedence)
  const targetCompaniesSet = new Set<string>();
  if (filters.companies && filters.companies.length > 0) {
    filters.companies.forEach((c) => targetCompaniesSet.add(c));
  } else if (filters.company) {
    targetCompaniesSet.add(filters.company);
  } else if (parsedIntent.companies && parsedIntent.companies.length > 0) {
    parsedIntent.companies.forEach((c) => targetCompaniesSet.add(c));
  } else if (parsedIntent.company) {
    targetCompaniesSet.add(parsedIntent.company);
  } else if (profile?.targetCompanies && profile.targetCompanies.length > 0) {
    profile.targetCompanies.forEach((c) => targetCompaniesSet.add(c));
  }

  const targetCompanies = Array.from(targetCompaniesSet);

  // 8. Resolve Sources
  const defaultSources = ["LinkedIn", "Y Combinator", "Indeed"];
  let sources = defaultSources;
  if (filters.sources && filters.sources.length > 0) {
    sources = filters.sources;
  } else if (parsedIntent.sources && parsedIntent.sources.length > 0) {
    sources = parsedIntent.sources;
  } else if (profile?.preferredSources && profile.preferredSources.length > 0) {
    sources = profile.preferredSources;
  }

  // 9. Freshness, Sorting, and Relevance Thresholds
  const isLatestIntent = parsedIntent.sortMode === "LATEST" || filters.sortMode === "LATEST" || profile?.sortMode === "LATEST";
  const finalSortMode: SortMode = isLatestIntent ? "LATEST" : (filters.sortMode || profile?.sortMode || "RELEVANCE_THEN_FRESHNESS");
  const freshnessWindowHours = filters.freshnessWindowHours || parsedIntent.freshnessWindowHours || profile?.freshnessWindowHours || (isLatestIntent ? 48 : 168);
  const minimumMatchScore = filters.minimumMatchScore || parsedIntent.minimumMatchScore || profile?.minimumMatchScore || 65;

  // 10. Exclusion & Watch Intent
  const excludeKnown = filters.excludeKnown !== undefined ? filters.excludeKnown : (parsedIntent.excludeKnown || false);
  const watchIntent = filters.watchIntent || parsedIntent.watchIntent || undefined;

  return {
    rawQuery: (rawQuery || "").trim(),
    roles: rolesList,
    skills: skillsList,
    locations: locationsList,
    workModes: workModesList,
    opportunityTypes: Array.from(oppTypesSet),
    experienceLevels: Array.from(expLevelsSet),
    targetCompanies,
    freshnessWindowHours,
    maxResultsPerSource: isLatestIntent ? 12 : 8,
    sources,
    sortMode: finalSortMode,
    isLatestIntent,
    targetGradYear: filters.targetGradYear || parsedIntent.targetGradYear || profile?.gradYear || null,
    minimumMatchScore,
    excludeKnown,
    watchIntent,
  };
}
