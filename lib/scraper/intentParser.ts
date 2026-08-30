/**
 * §DETERMINISTIC NATURAL-LANGUAGE SEARCH INTENT PARSER (TASK-018)
 * Translates natural-language user requests into structured, deterministic SearchIntent
 * and DiscoveryPlan configuration without requiring any external LLM calls or network latency.
 * 
 * 100% deterministic — Zero token overhead ($0).
 */

import { type SearchIntent } from "./providers/baseProvider";

export interface KnownSkillDefinition {
  canonicalName: string;
  regex: RegExp;
}

/**
 * Deterministically classifies whether a natural language query is an Opportunity / Job Discovery request
 * versus a general Browser Agent browsing / automation task.
 * 
 * Zero external LLM token overhead ($0).
 */
export function isOpportunityDiscoveryIntent(rawPrompt?: string | null): boolean {
  if (!rawPrompt || typeof rawPrompt !== "string") return false;
  const clean = rawPrompt.trim();
  if (clean.length === 0) return false;
  const lower = clean.toLowerCase();

  // 1. Explicit Non-Job Automation Action Patterns (without any job/career context)
  const isGenericWebAutomation =
    /\b(navigate to|go to|open (?:the |this )?(?:website|page|url|link)|click (?:on)?|fill (?:the |out )?form|submit (?:the )?form|login to|sign in to|scrape (?:the )?(?:pricing|table|articles|comments|news|posts)|extract (?:the )?(?:pricing|table|data from|information about|articles|matrix)|take a screenshot of|search the web for information about|summarize (?:the |this )?(?:website|article|page|content)|browse to|inspect (?:the |this )?(?:website|page|site))\b/i.test(lower);

  // 2. Clear Job, Career & Opportunity Keywords
  const hasJobKeywords =
    /\b(jobs?|internships?|interns?|co-?op|coops?|openings?|hiring|vacanc(?:y|ies)|careers?|positions?|roles?|opportunities|job-search|job search|employment|entry-level|fresher|freshers|reposted|reposts?|job postings?)\b/i.test(lower);

  // 3. Job Monitoring / Watch Phrases
  const hasWatchJobKeywords =
    /\b(keep watching for|watch for|monitor|track|alert me when|notify me when)\b.*\b(jobs?|internships?|roles?|opportunities|openings?|postings?|reposts?|matches?)\b/i.test(lower) ||
    /\b(keep watching for (?:these|new|genuinely new|reposts?|opportunities|openings?))\b/i.test(lower);

  // 4. Tech Role with Discovery Verbs (e.g. "Find React developer in Hyderabad", "Looking for AI engineers")
  const hasDiscoveryVerb = /\b(find|search|looking for|seek|seeking|show me|discover|get|locate|list)\b/i.test(lower);
  const hasTechRole = /\b(software engineer|swe|sde|software developer|developer|frontend|front-end|backend|back-end|fullstack|full-stack|ai engineer|ml engineer|data scientist|data engineer|devops|product manager|qa engineer|programmer)\b/i.test(lower);

  // If it's a generic web automation command AND lacks clear job/opportunity keywords, it is NOT job discovery
  if (isGenericWebAutomation && !hasJobKeywords && !hasWatchJobKeywords) {
    return false;
  }

  // If it contains job keywords, watch-job phrases, or discovery verb + tech role -> TRUE
  if (hasJobKeywords || hasWatchJobKeywords || (hasDiscoveryVerb && hasTechRole)) {
    return true;
  }

  // Also check if role definitions in KNOWN_ROLE_DEFINITIONS match alongside search verbs or locations/skills
  const matchesKnownRole = KNOWN_ROLE_DEFINITIONS.some((r) => r.regex.test(lower));
  const hasLocationOrSkill =
    KNOWN_LOCATION_DEFINITIONS.some((l) => l.regex.test(lower)) ||
    KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(lower));

  if (matchesKnownRole && (hasDiscoveryVerb || hasLocationOrSkill)) {
    return true;
  }

  return false;
}

export const KNOWN_SKILL_DEFINITIONS: KnownSkillDefinition[] = [
  { canonicalName: "react", regex: /\b(react|react\.js|reactjs)\b/i },
  { canonicalName: "next.js", regex: /\b(next\.js|nextjs|next)\b/i },
  { canonicalName: "typescript", regex: /\b(typescript|ts)\b/i },
  { canonicalName: "javascript", regex: /\b(javascript|js|es6)\b/i },
  { canonicalName: "node.js", regex: /\b(node|node\.js|nodejs)\b/i },
  { canonicalName: "python", regex: /\b(python|py|django|flask|fastapi)\b/i },
  { canonicalName: "ai", regex: /\b(ai\/ml|ai|artificial intelligence|machine learning|ml|deep learning|llm|nlp|genai)\b/i },
  { canonicalName: "pytorch", regex: /\b(pytorch|torch)\b/i },
  { canonicalName: "tensorflow", regex: /\b(tensorflow|tf|keras)\b/i },
  { canonicalName: "java", regex: /\b(java|spring|springboot)\b/i },
  { canonicalName: "golang", regex: /\b(golang|go)\b/i },
  { canonicalName: "rust", regex: /\b(rust)\b/i },
  { canonicalName: "c++", regex: /(^|\s|\b)c\+\+(\s|\b|$|[,\.])/i },
  { canonicalName: "c#", regex: /(^|\s|\b)c#(\s|\b|$|[,\.])/i },
  { canonicalName: "sql", regex: /\b(sql|mysql|sqlite)\b/i },
  { canonicalName: "postgresql", regex: /\b(postgresql|postgres|psql)\b/i },
  { canonicalName: "mongodb", regex: /\b(mongodb|mongo)\b/i },
  { canonicalName: "redis", regex: /\b(redis)\b/i },
  { canonicalName: "aws", regex: /\b(aws|amazon web services)\b/i },
  { canonicalName: "gcp", regex: /\b(gcp|google cloud)\b/i },
  { canonicalName: "azure", regex: /\b(azure|microsoft azure)\b/i },
  { canonicalName: "docker", regex: /\b(docker|containers|k8s|kubernetes)\b/i },
  { canonicalName: "graphql", regex: /\b(graphql)\b/i },
  { canonicalName: "tailwind", regex: /\b(tailwind|tailwindcss)\b/i },
  { canonicalName: "html", regex: /\b(html|html5)\b/i },
  { canonicalName: "css", regex: /\b(css|css3)\b/i },
  { canonicalName: "vue", regex: /\b(vue|vuejs|vue\.js)\b/i },
  { canonicalName: "angular", regex: /\b(angular|angularjs)\b/i },
  { canonicalName: "svelte", regex: /\b(svelte|sveltekit)\b/i },
  { canonicalName: "flutter", regex: /\b(flutter|dart)\b/i },
  { canonicalName: "swift", regex: /\b(swift|ios)\b/i },
  { canonicalName: "kotlin", regex: /\b(kotlin|android)\b/i },
];

export interface KnownCompanyDefinition {
  canonicalName: string;
  regex: RegExp;
}

export const KNOWN_COMPANY_DEFINITIONS: KnownCompanyDefinition[] = [
  { canonicalName: "Google", regex: /\b(google|alphabet)\b/i },
  { canonicalName: "Microsoft", regex: /\b(microsoft|msft)\b/i },
  { canonicalName: "OpenAI", regex: /\b(openai)\b/i },
  { canonicalName: "Amazon", regex: /\b(amazon|aws)\b/i },
  { canonicalName: "Meta", regex: /\b(meta|facebook)\b/i },
  { canonicalName: "Apple", regex: /\b(apple)\b/i },
  { canonicalName: "Netflix", regex: /\b(netflix)\b/i },
  { canonicalName: "Anthropic", regex: /\b(anthropic)\b/i },
  { canonicalName: "Razorpay", regex: /\b(razorpay)\b/i },
  { canonicalName: "Stripe", regex: /\b(stripe)\b/i },
  { canonicalName: "Uber", regex: /\b(uber)\b/i },
  { canonicalName: "Airbnb", regex: /\b(airbnb)\b/i },
  { canonicalName: "Salesforce", regex: /\b(salesforce)\b/i },
  { canonicalName: "Oracle", regex: /\b(oracle)\b/i },
  { canonicalName: "Adobe", regex: /\b(adobe)\b/i },
  { canonicalName: "Databricks", regex: /\b(databricks)\b/i },
  { canonicalName: "Snowflake", regex: /\b(snowflake)\b/i },
  { canonicalName: "Nvidia", regex: /\b(nvidia)\b/i },
  { canonicalName: "Palantir", regex: /\b(palantir)\b/i },
  { canonicalName: "Coinbase", regex: /\b(coinbase)\b/i },
  { canonicalName: "Atlassian", regex: /\b(atlassian)\b/i },
  { canonicalName: "Flipkart", regex: /\b(flipkart)\b/i },
  { canonicalName: "Swiggy", regex: /\b(swiggy)\b/i },
  { canonicalName: "Zomato", regex: /\b(zomato)\b/i },
  { canonicalName: "Cred", regex: /\b(cred)\b/i },
  { canonicalName: "Postman", regex: /\b(postman)\b/i },
  { canonicalName: "GitHub", regex: /\b(github)\b/i },
  { canonicalName: "GitLab", regex: /\b(gitlab)\b/i },
  { canonicalName: "Figma", regex: /\b(figma)\b/i },
];

export interface KnownLocationDefinition {
  canonicalName: string;
  isCity: boolean;
  regex: RegExp;
}

export const KNOWN_LOCATION_DEFINITIONS: KnownLocationDefinition[] = [
  // Major Indian Tech Hubs
  { canonicalName: "Hyderabad", isCity: true, regex: /\b(hyderabad|hyd)\b/i },
  { canonicalName: "Bengaluru", isCity: true, regex: /\b(bengaluru|bangalore|blr)\b/i },
  { canonicalName: "Pune", isCity: true, regex: /\b(pune)\b/i },
  { canonicalName: "Mumbai", isCity: true, regex: /\b(mumbai|bombay)\b/i },
  { canonicalName: "Delhi", isCity: true, regex: /\b(delhi|new delhi|ncr|noida|gurgaon|gurugram)\b/i },
  { canonicalName: "Chennai", isCity: true, regex: /\b(chennai|madras)\b/i },
  { canonicalName: "Kolkata", isCity: true, regex: /\b(kolkata|calcutta)\b/i },

  // Major International Tech Hubs
  { canonicalName: "San Francisco", isCity: true, regex: /\b(san francisco|sf|bay area|silicon valley)\b/i },
  { canonicalName: "New York", isCity: true, regex: /\b(new york|nyc|ny)\b/i },
  { canonicalName: "London", isCity: true, regex: /\b(london)\b/i },
  { canonicalName: "Berlin", isCity: true, regex: /\b(berlin)\b/i },
  { canonicalName: "Toronto", isCity: true, regex: /\b(toronto)\b/i },
  { canonicalName: "Singapore", isCity: true, regex: /\b(singapore)\b/i },
  { canonicalName: "Sydney", isCity: true, regex: /\b(sydney)\b/i },

  // Countries
  { canonicalName: "India", isCity: false, regex: /\b(india)\b/i },
  { canonicalName: "United States", isCity: false, regex: /\b(united states|usa|us)\b/i },
  { canonicalName: "United Kingdom", isCity: false, regex: /\b(united kingdom|uk)\b/i },
  { canonicalName: "Canada", isCity: false, regex: /\b(canada)\b/i },
  { canonicalName: "Germany", isCity: false, regex: /\b(germany)\b/i },
  { canonicalName: "Australia", isCity: false, regex: /\b(australia)\b/i },
];

export interface KnownRoleDefinition {
  canonicalName: string;
  regex: RegExp;
  related: string[];
}

export const KNOWN_ROLE_DEFINITIONS: KnownRoleDefinition[] = [
  {
    canonicalName: "AI Engineer",
    regex: /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|nlp|genai)\b/i,
    related: ["ML Researcher", "Data Scientist", "Applied AI Engineer", "AI/ML Intern"],
  },
  {
    canonicalName: "Frontend Engineer",
    regex: /\b(frontend|front-end|front end|ui engineer|ui developer|react developer)\b/i,
    related: ["Frontend Developer", "Web Developer", "React Developer", "UI/UX Engineer"],
  },
  {
    canonicalName: "Backend Engineer",
    regex: /\b(backend|back-end|back end|api engineer|server engineer|python developer|node developer|java developer)\b/i,
    related: ["Backend Developer", "Node.js Engineer", "Python Engineer", "Systems Engineer"],
  },
  {
    canonicalName: "Full Stack Engineer",
    regex: /\b(fullstack|full-stack|full stack|web developer)\b/i,
    related: ["Software Engineer", "Web Developer", "Application Developer"],
  },
  {
    canonicalName: "Software Engineer",
    regex: /\b(software engineer|swe|software developer|sde|developer roles?|programmer)\b/i,
    related: ["Software Developer", "Junior Software Engineer", "Full Stack Developer", "Full Stack Engineer", "SDE Intern"],
  },
  {
    canonicalName: "Data Engineer",
    regex: /\b(data engineer|data pipeline|analytics engineer|big data engineer)\b/i,
    related: ["Data Analyst", "Data Pipeline Engineer", "BI Engineer"],
  },
  {
    canonicalName: "DevOps Engineer",
    regex: /\b(devops|sre|site reliability|cloud engineer|platform engineer|infrastructure)\b/i,
    related: ["Cloud Infrastructure Engineer", "Platform Engineer", "SRE Intern"],
  },
  {
    canonicalName: "Mobile Engineer",
    regex: /\b(mobile engineer|mobile developer|ios developer|android developer|flutter developer|react native developer)\b/i,
    related: ["iOS Developer", "Android Developer", "Mobile App Developer"],
  },
  {
    canonicalName: "Product Manager",
    regex: /\b(product manager|pm|associate product manager|apm)\b/i,
    related: ["APM Intern", "Technical Product Manager", "Product Specialist"],
  },
  {
    canonicalName: "QA Engineer",
    regex: /\b(qa engineer|quality assurance|sdet|test engineer|automation engineer)\b/i,
    related: ["SDET Intern", "Automation Test Engineer", "QA Analyst"],
  },
];

/**
 * Extracts comprehensive, structured SearchIntent from natural language queries
 */
export function parseSearchIntent(rawQuery?: string | null, filterOverrides?: Partial<SearchIntent>): SearchIntent {
  const cleanQuery = (rawQuery || "").trim();
  const lower = cleanQuery.toLowerCase();

  // 1. Work Mode Detection (supports compound modes)
  const matchedModes: string[] = [];
  if (/\b(remote|work from home|wfh|anywhere|distributed)\b/i.test(lower)) {
    matchedModes.push("REMOTE");
  }
  if (/\b(hybrid|flexible)\b/i.test(lower)) {
    matchedModes.push("HYBRID");
  }
  if (/\b(on-site|onsite|in-office|in office|office)\b/i.test(lower)) {
    matchedModes.push("ON_SITE");
  }
  if (matchedModes.length === 0) {
    matchedModes.push("ANY");
  }
  const primaryWorkMode = matchedModes[0] || "ANY";

  // 2. Experience Level & Opportunity Type (Supports dual coexistence like Internships + Entry-Level)
  const isInternshipMentioned = /\b(intern|interns|internship|internships|trainee|trainees|co-op|coop|student|summer intern)\b/i.test(lower);
  const isEntryLevelMentioned = /\b(entry-level|entry level|entry|junior|jr|fresh|fresher|graduate|grad|associate|new grad)\b/i.test(lower);
  const isSeniorMentioned = /\b(senior|sr|lead|principal|staff|director|architect|vp|mid-level|experienced)\b/i.test(lower);

  const matchedOppTypes: string[] = [];
  const matchedExpLevels: string[] = [];

  if (isInternshipMentioned && isEntryLevelMentioned) {
    matchedOppTypes.push("INTERNSHIP", "FULL_TIME");
    matchedExpLevels.push("INTERN", "ENTRY_LEVEL");
  } else if (isInternshipMentioned) {
    matchedOppTypes.push("INTERNSHIP");
    matchedExpLevels.push("INTERN");
  } else if (isEntryLevelMentioned) {
    matchedOppTypes.push("FULL_TIME");
    matchedExpLevels.push("ENTRY_LEVEL");
  } else if (isSeniorMentioned) {
    matchedOppTypes.push("FULL_TIME");
    matchedExpLevels.push("MID", "SENIOR");
  } else {
    matchedOppTypes.push("FULL_TIME", "INTERNSHIP");
    matchedExpLevels.push("ENTRY_LEVEL", "INTERN");
  }

  const primaryOpportunityType = isInternshipMentioned ? "INTERNSHIP" : (matchedOppTypes[0] || "FULL_TIME");
  const primaryExperienceLevel = isInternshipMentioned ? "INTERN" : (matchedExpLevels[0] || "ENTRY_LEVEL");

  // 3. Target Graduation Year (e.g. 2024, 2025, 2026, 2027, 2028)
  let targetGradYear: number | undefined;
  const gradMatch = lower.match(/\b(202[4-9]|203[0-5])\b/);
  if (gradMatch) {
    targetGradYear = parseInt(gradMatch[1], 10);
  }

  // 4. Company Type (Startup vs Enterprise)
  let companyType: SearchIntent["companyType"] = "ANY";
  if (/\b(startup|startups|early stage|y combinator|yc|seed|series a|series b)\b/i.test(lower)) {
    companyType = "STARTUP";
  } else if (/\b(enterprise|enterprises|faang|big tech|fortune 500|corp|mnc)\b/i.test(lower)) {
    companyType = "ENTERPRISE";
  }

  // 5. Locations Extraction (Multiple locations supported, prioritizing specific cities first)
  const matchedLocations: string[] = [];
  const matchedCities: string[] = [];
  const matchedCountries: string[] = [];

  for (const locDef of KNOWN_LOCATION_DEFINITIONS) {
    if (locDef.regex.test(lower)) {
      if (locDef.isCity) {
        if (!matchedCities.includes(locDef.canonicalName)) {
          matchedCities.push(locDef.canonicalName);
        }
      } else {
        if (!matchedCountries.includes(locDef.canonicalName)) {
          matchedCountries.push(locDef.canonicalName);
        }
      }
    }
  }

  // City targets take precedence, followed by country targets
  matchedLocations.push(...matchedCities, ...matchedCountries);

  // If no predefined location matched, try regex capture "in <Location>"
  if (matchedLocations.length === 0) {
    const locMatch = cleanQuery.match(/\b(?:in|at|near|around)\s+([A-Za-z\s,.-]+?)(?:\s+(?:internships?|jobs?|roles?|remote|hybrid|latest)|\s*$)/i);
    if (locMatch && locMatch[1]) {
      const extractedLoc = locMatch[1].trim();
      if (extractedLoc.length >= 2 && !/^(the|any|all|remote|hybrid|an?)$/i.test(extractedLoc)) {
        matchedLocations.push(extractedLoc);
      }
    }
  }

  const primaryLocation = matchedLocations[0] || undefined;

  // 6. Skills Extraction (Strict no-hallucination dictionary matching)
  const matchedSkills: string[] = [];
  for (const skillDef of KNOWN_SKILL_DEFINITIONS) {
    if (skillDef.regex.test(lower)) {
      if (!matchedSkills.includes(skillDef.canonicalName)) {
        matchedSkills.push(skillDef.canonicalName);
      }
    }
  }

  // 7. Roles Extraction (Multiple role families supported)
  const matchedRoles: string[] = [];
  for (const roleDef of KNOWN_ROLE_DEFINITIONS) {
    if (roleDef.regex.test(lower)) {
      if (!matchedRoles.includes(roleDef.canonicalName)) {
        matchedRoles.push(roleDef.canonicalName);
      }
      for (const rel of roleDef.related) {
        if (!matchedRoles.includes(rel)) {
          matchedRoles.push(rel);
        }
      }
    }
  }

  if (matchedRoles.length === 0 && cleanQuery.length > 0 && cleanQuery.length < 60) {
    // Fallback noun extraction
    const stripped = cleanQuery
      .replace(/\b(find|search|looking for|jobs|internships|positions|openings|in|at|for|remote|hybrid|india|usa|startups|with|and|or|latest|recent)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (stripped.length > 2) {
      matchedRoles.push(stripped);
    }
  }

  if (matchedRoles.length === 0) {
    matchedRoles.push("Software Engineer");
  }

  const primaryRole = matchedRoles[0] || "Software Engineer";

  // 7.5. Target Companies Extraction
  const matchedCompanies: string[] = [];
  for (const compDef of KNOWN_COMPANY_DEFINITIONS) {
    if (compDef.regex.test(lower)) {
      if (!matchedCompanies.includes(compDef.canonicalName)) {
        matchedCompanies.push(compDef.canonicalName);
      }
    }
  }

  // If no predefined company matched, try regex capture "from/at/company/watch <Company>" (e.g. "at Stripe", "from OpenAI", "watch Datadog")
  if (matchedCompanies.length === 0) {
    const compMatch = cleanQuery.match(/\b(?:from|at|by|company|companies|watch|watching|track|tracking|monitor|monitoring)\s+([A-Za-z0-9&.-]+(?:\s+[A-Za-z0-9&.-]+)?)(?:\s+(?:for|in|roles?|jobs?|internships?|with|where|seeking|and)|$)/i);
    if (compMatch && compMatch[1]) {
      const candidateComp = compMatch[1].trim();
      const isGeneric = /^(the|any|all|remote|hybrid|on-site|an?|india|hyderabad|bengaluru|pune|mumbai|delhi|usa|uk|software|developer|engineer|intern|internship|startups?|enterprises?|faang|big\s*tech|companies?|jobs?|internships?|roles?|positions?|openings?|freshers?|graduates?|students?|\d{4})$/i.test(candidateComp);
      if (candidateComp.length >= 2 && !isGeneric && !matchedCompanies.includes(candidateComp)) {
        matchedCompanies.push(candidateComp);
      }
    }
  }

  const primaryCompany = matchedCompanies[0] || undefined;

  // 8. Freshness & Latest Intent Detection
  const isLatestIntent = /\b(latest|recent|recently posted|new|newest|today|just posted|fresh|this week|24h|past 24 hours|last 3 days|few days)\b/i.test(lower);
  const sortMode: "LATEST" | "RELEVANCE_THEN_FRESHNESS" = isLatestIntent ? "LATEST" : "RELEVANCE_THEN_FRESHNESS";

  let freshnessWindowHours = 168; // Default 7 days
  if (isLatestIntent) {
    if (/\b(today|24h|past 24 hours|24 hours)\b/i.test(lower)) {
      freshnessWindowHours = 24;
    } else if (/\b(last 3 days|few days|3 days)\b/i.test(lower)) {
      freshnessWindowHours = 72;
    } else if (/\b(this week|past week|week)\b/i.test(lower)) {
      freshnessWindowHours = 168;
    } else {
      freshnessWindowHours = 48; // Default 48h for latest
    }
  }

  // 9. Minimum Relevance Expectations
  let minimumMatchScore = 65;
  if (/\b(high fit|strict match|high relevance|top fit)\b/i.test(lower)) {
    minimumMatchScore = 80;
  } else if (/\b(strict|top tier fit|at least 90|90%|90 pts)\b/i.test(lower)) {
    minimumMatchScore = 90;
  } else if (/\b(broad match|broad search|any fit|loose match)\b/i.test(lower)) {
    minimumMatchScore = 60;
  }
  const scoreMatch = lower.match(/\b(?:min|at least|minimum)\s+(\d{2})\s*(?:%|pts|points|score)?\b/);
  if (scoreMatch && scoreMatch[1]) {
    const parsedScore = parseInt(scoreMatch[1], 10);
    if (parsedScore >= 50 && parsedScore <= 95) {
      minimumMatchScore = parsedScore;
    }
  }

  // 10. Source Preferences
  const matchedSources: string[] = [];
  if (/\b(linkedin|linked in)\b/i.test(lower)) {
    matchedSources.push("LinkedIn");
  }
  if (/\b(y combinator|yc|workatastartup|work at a startup)\b/i.test(lower)) {
    matchedSources.push("Y Combinator");
  }
  if (/\b(indeed)\b/i.test(lower)) {
    matchedSources.push("Indeed");
  }
  const finalSources = matchedSources.length > 0 ? matchedSources : ["LinkedIn", "Y Combinator", "Indeed"];

  // 11. Exclusion Intent ("avoid showing me jobs I already know about", "jobs I haven't seen before", "only tell me when you find something genuinely new")
  const excludeKnown = /\b(avoid showing|already know|exclude known|hide seen|only new|genuinely new|brand new|skip seen|skip saved|only tell me when|haven't seen|havent seen|not seen before|never seen|unseen)\b/i.test(lower);

  // 12. Watch Intent Detection ("set up a watch", "keep watching", "monitor every 4 hours", "every 12 hours", "daily")
  let watchIntent: { enabled: boolean; scanIntervalHours?: number } | undefined;
  if (/\b(watch|watching|watches|monitor|monitoring|track|tracking|alert me|notify me|keep watching|keep an eye|continuous watch|scheduled search|every\s+\d+\s*(?:hours?|h)|daily|every day)\b/i.test(lower)) {
    let scanIntervalHours = 4;
    if (/\b(2 hours|every 2h|2h)\b/i.test(lower)) scanIntervalHours = 2;
    else if (/\b(4 hours|every 4h|4h)\b/i.test(lower)) scanIntervalHours = 4;
    else if (/\b(6 hours|every 6h|6h)\b/i.test(lower)) scanIntervalHours = 6;
    else if (/\b(12 hours|every 12h|12h)\b/i.test(lower)) scanIntervalHours = 12;
    else if (/\b(daily|every 24 hours|24h|every day)\b/i.test(lower)) scanIntervalHours = 24;

    watchIntent = {
      enabled: true,
      scanIntervalHours,
    };
  }

  // Explicit user filter overrides take top priority
  const intent: SearchIntent = {
    role: filterOverrides?.role || primaryRole,
    roles: filterOverrides?.roles || matchedRoles,
    skills: filterOverrides?.skills || (matchedSkills.length > 0 ? matchedSkills : undefined),
    location: filterOverrides?.location || primaryLocation,
    locations: filterOverrides?.locations || (matchedLocations.length > 0 ? matchedLocations : undefined),
    company: filterOverrides?.company || primaryCompany,
    companies: filterOverrides?.companies || (matchedCompanies.length > 0 ? matchedCompanies : undefined),
    workMode: filterOverrides?.workMode || primaryWorkMode,
    workModes: filterOverrides?.workModes || matchedModes,
    experienceLevel: filterOverrides?.experienceLevel || primaryExperienceLevel,
    experienceLevels: filterOverrides?.experienceLevels || matchedExpLevels,
    opportunityType: filterOverrides?.opportunityType || primaryOpportunityType,
    opportunityTypes: filterOverrides?.opportunityTypes || matchedOppTypes,
    targetGradYear: filterOverrides?.targetGradYear || targetGradYear,
    companyType: filterOverrides?.companyType || companyType,
    queryHint: cleanQuery || filterOverrides?.queryHint || primaryRole,
    sortMode: filterOverrides?.sortMode || sortMode,
    freshnessWindowHours: filterOverrides?.freshnessWindowHours || freshnessWindowHours,
    minimumMatchScore: filterOverrides?.minimumMatchScore || minimumMatchScore,
    sources: filterOverrides?.sources || finalSources,
    excludeKnown: filterOverrides?.excludeKnown !== undefined ? filterOverrides.excludeKnown : excludeKnown,
    watchIntent: filterOverrides?.watchIntent || watchIntent,
  };

  return intent;
}
