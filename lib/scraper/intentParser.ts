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
    regex: /\b(software\s*(?:engineer(?:ing)?|developer|dev)|swe|sde|developer roles?|programmer)\b/i,
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
  {
    canonicalName: "Mechanical Engineer",
    regex: /\b(mechanical\s*(?:engineering|engineer)?|mech\s*eng|cad\s*designer|solidworks|hvac\s*engineer)\b/i,
    related: ["Mechanical Design Engineer", "CAD Engineer", "HVAC Engineer", "Thermal Engineer"],
  },
  {
    canonicalName: "Electrical Engineer",
    regex: /\b(electrical\s*(?:engineering|engineer)?|electronics\s*engineer|hardware\s*engineer|circuit\s*design|vlsi|embedded\s*engineer)\b/i,
    related: ["Electronics Engineer", "Hardware Engineer", "Embedded Systems Engineer", "VLSI Engineer"],
  },
  {
    canonicalName: "Civil Engineer",
    regex: /\b(civil\s*(?:engineering|engineer)?|structural\s*engineer|site\s*engineer|construction\s*manager)\b/i,
    related: ["Structural Engineer", "Site Engineer", "Construction Engineer"],
  },
  {
    canonicalName: "Chemical Engineer",
    regex: /\b(chemical\s*(?:engineering|engineer)?|process\s*engineer|petroleum\s*engineer)\b/i,
    related: ["Process Engineer", "Petrochemical Engineer"],
  },
  {
    canonicalName: "Designer",
    regex: /\b(ui\/ux|ux\s*designer|ui\s*designer|product\s*designer|graphic\s*designer)\b/i,
    related: ["UI Designer", "UX Designer", "Product Designer", "Graphic Designer"],
  },
  {
    canonicalName: "Marketing Specialist",
    regex: /\b(marketing|digital\s*marketing|seo\s*specialist|growth\s*marketer|content\s*marketer|brand\s*manager)\b/i,
    related: ["Digital Marketing Manager", "Growth Marketer", "SEO Specialist", "Content Marketer"],
  },
  {
    canonicalName: "Sales Executive",
    regex: /\b(sales\s*executive|business\s*development|bdr|sdr|account\s*executive|sales\s*representative)\b/i,
    related: ["Business Development Representative", "Account Executive", "Sales Manager"],
  },
  {
    canonicalName: "Financial Analyst",
    regex: /\b(financial\s*analyst|accountant|accounting|auditor|finance\s*manager|investment\s*banking)\b/i,
    related: ["Accountant", "Finance Manager", "Auditor", "Investment Banking Analyst"],
  },
  {
    canonicalName: "Human Resources",
    regex: /\b(human\s*resources|hr\s*manager|recruiter|talent\s*acquisition)\b/i,
    related: ["HR Manager", "Technical Recruiter", "Talent Acquisition Specialist"],
  },
  {
    canonicalName: "Healthcare Professional",
    regex: /\b(nurse|nursing|doctor|physician|pharmacist|medical\s*officer|clinical\s*researcher)\b/i,
    related: ["Registered Nurse", "Clinical Pharmacist", "Medical Doctor"],
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
    matchedExpLevels.push("ANY");
  }

  const primaryOpportunityType = isInternshipMentioned ? "INTERNSHIP" : (matchedOppTypes[0] || "FULL_TIME");
  const primaryExperienceLevel = isInternshipMentioned ? "INTERN" : isEntryLevelMentioned ? "ENTRY_LEVEL" : isSeniorMentioned ? "SENIOR" : "ANY";

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

  // Dynamic pattern extraction for any custom role in natural language
  if (matchedRoles.length === 0) {
    const rolePattern = /\b(?:search\s+(?:for\s+)?|find\s+|looking\s+for\s+|show\s+(?:me\s+)?|get\s+)?(?:\d+\s+)?([a-zA-Z\s/&-]+?)\s+(?:jobs?|roles?|internships?|positions?|openings?)\b/i;
    const match = cleanQuery.match(rolePattern);
    if (match && match[1]) {
      let extracted = match[1].trim();
      extracted = extracted.replace(/^(search\s+for|find|looking\s+for|show\s+me|get)\s+/i, "").trim();
      extracted = extracted.replace(/\b(remote|hybrid|on-site|onsite|latest|recent|new|urgent|full-time|part-time|contract|in|at)\b/gi, "").trim();
      if (extracted.length >= 3 && !/^(the|any|all|some|good|top|best|entry\s*level|junior|senior|internships?|jobs?)$/i.test(extracted)) {
        const canonical = extracted.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        matchedRoles.push(canonical);
      }
    }
  }

  if (matchedRoles.length === 0 && cleanQuery.length > 0) {
    // Fallback noun extraction without arbitrary 60-char length cap
    const stripped = cleanQuery
      .replace(/\b(find|search|looking for|jobs|internships|positions|openings|in|at|for|remote|hybrid|india|usa|startups|with|and|or|latest|recent|posted|within|last|\d+\s*days?)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (stripped.length > 2 && !/^\d+$/.test(stripped)) {
      const canonical = stripped.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      matchedRoles.push(canonical);
    }
  }

  // Only if the user explicitly typed tech keywords do we default to Software Engineer
  if (matchedRoles.length === 0 && /\b(tech|technology|developer|coding)\b/i.test(cleanQuery)) {
    matchedRoles.push("Software Engineer");
  }

  const primaryRole = matchedRoles[0] || undefined;

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
    const compMatch = cleanQuery.match(/\b(?:from|at|by|company|companies|watch|watching|track|tracking|monitor|monitoring)\s+([A-Za-z0-9&.-]+(?:\s+[A-Za-z0-9&.-]+)?)(?:\s+(?:for|in|roles?|jobs?|internships?|with|where|seeking|and|from|posted|last|past|within|today|yesterday|this)|$)/i);
    if (compMatch && compMatch[1]) {
      const candidateComp = compMatch[1].trim();
      const isGeneric = /^(the|any|all|remote|hybrid|on-site|an?|india|hyderabad|bengaluru|pune|mumbai|delhi|usa|uk|software|developer|engineer|intern|internship|startups?|enterprises?|faang|big\s*tech|companies?|jobs?|internships?|roles?|positions?|openings?|freshers?|graduates?|students?|\d{4})$/i.test(candidateComp);
      if (candidateComp.length >= 2 && !isGeneric && !matchedCompanies.includes(candidateComp)) {
        matchedCompanies.push(candidateComp);
      }
    }
  }

  const primaryCompany = matchedCompanies[0] || undefined;

  // 8. Natural Language Date Range & Freshness Detection (TASK-043 Enhanced)
  let isExplicitFreshness = false;
  let freshnessWindowHours = 168; // Default 7 days
  let postedWithinDays: number | undefined;
  let dateConstraint: any = undefined;
  let sortMode: "LATEST" | "RELEVANCE_THEN_FRESHNESS" = "RELEVANCE_THEN_FRESHNESS";

  // Check arbitrary relative date patterns
  // Pattern 1: X days / d (e.g., "last 15 days", "past 10 days", "within 21 days", "last 30 days", "15 days", "15d")
  const explicitDaysMatch = lower.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+)?(?:last|past|within|in)\s+(\d{1,3})\s*(?:days?|d)\b/i) ||
    lower.match(/\b(\d{1,3})\s*(?:days?|d)\s*ago\b/i) ||
    lower.match(/\bposted\s+(?:within|in|last|past)\s+(\d{1,3})\s*(?:days?|d)\b/i);

  // Pattern 2: X weeks / w (e.g., "last 2 weeks", "past 6 weeks", "last 3 weeks")
  const explicitWeeksMatch = lower.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+)?(?:last|past|within|in)\s+(\d{1,2})\s*(?:weeks?|w)\b/i) ||
    lower.match(/\b(\d{1,2})\s*(?:weeks?|w)\s*ago\b/i);

  // Pattern 3: X months / mo (e.g., "last 2 months", "past 3 months")
  const explicitMonthsMatch = lower.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+)?(?:last|past|within|in)\s+(\d{1,2})\s*(?:months?|mo)\b/i) ||
    lower.match(/\b(\d{1,2})\s*(?:months?|mo)\s*ago\b/i);

  // Pattern 4: X hours / h (e.g., "last 24 hours", "past 48 hours")
  const explicitHoursMatch = lower.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+)?(?:last|past|within|in)\s+(\d{1,3})\s*(?:hours?|hrs?|h)\b/i);

  if (explicitDaysMatch && explicitDaysMatch[1]) {
    const days = parseInt(explicitDaysMatch[1], 10);
    if (days > 0) {
      postedWithinDays = days;
      freshnessWindowHours = days * 24;
      isExplicitFreshness = true;
      sortMode = "LATEST";
      dateConstraint = {
        type: "RELATIVE",
        amount: days,
        unit: "DAY",
        cutoffDate: new Date(Date.now() - days * 24 * 3600 * 1000),
        rawText: explicitDaysMatch[0],
      };
    }
  } else if (explicitWeeksMatch && explicitWeeksMatch[1]) {
    const weeks = parseInt(explicitWeeksMatch[1], 10);
    if (weeks > 0) {
      postedWithinDays = weeks * 7;
      freshnessWindowHours = weeks * 7 * 24;
      isExplicitFreshness = true;
      sortMode = "LATEST";
      dateConstraint = {
        type: "RELATIVE",
        amount: weeks,
        unit: "WEEK",
        cutoffDate: new Date(Date.now() - weeks * 7 * 24 * 3600 * 1000),
        rawText: explicitWeeksMatch[0],
      };
    }
  } else if (explicitMonthsMatch && explicitMonthsMatch[1]) {
    const months = parseInt(explicitMonthsMatch[1], 10);
    if (months > 0) {
      postedWithinDays = months * 30;
      freshnessWindowHours = months * 30 * 24;
      isExplicitFreshness = true;
      sortMode = "LATEST";
      dateConstraint = {
        type: "RELATIVE",
        amount: months,
        unit: "MONTH",
        cutoffDate: new Date(Date.now() - months * 30 * 24 * 3600 * 1000),
        rawText: explicitMonthsMatch[0],
      };
    }
  } else if (explicitHoursMatch && explicitHoursMatch[1]) {
    const hours = parseInt(explicitHoursMatch[1], 10);
    if (hours > 0) {
      postedWithinDays = Math.max(1, Math.round(hours / 24));
      freshnessWindowHours = hours;
      isExplicitFreshness = true;
      sortMode = "LATEST";
      dateConstraint = {
        type: "RELATIVE",
        amount: hours,
        unit: "HOUR",
        cutoffDate: new Date(Date.now() - hours * 3600 * 1000),
        rawText: explicitHoursMatch[0],
      };
    }
  } else if (/\b(two weeks|past two weeks|last two weeks)\b/i.test(lower)) {
    postedWithinDays = 14;
    freshnessWindowHours = 14 * 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 14, unit: "DAY", cutoffDate: new Date(Date.now() - 14 * 24 * 3600 * 1000), rawText: "two weeks" };
  } else if (/\b(six weeks|past six weeks|last six weeks)\b/i.test(lower)) {
    postedWithinDays = 42;
    freshnessWindowHours = 42 * 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 42, unit: "DAY", cutoffDate: new Date(Date.now() - 42 * 24 * 3600 * 1000), rawText: "six weeks" };
  } else if (/\b(two months|past two months|last two months)\b/i.test(lower)) {
    postedWithinDays = 60;
    freshnessWindowHours = 60 * 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 60, unit: "DAY", cutoffDate: new Date(Date.now() - 60 * 24 * 3600 * 1000), rawText: "two months" };
  } else if (/\b(today|posted today|just now|just posted|past 24 hours?|last 24 hours?|24 hours?|24h)\b/i.test(lower)) {
    postedWithinDays = 1;
    freshnessWindowHours = 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 1, unit: "DAY", cutoffDate: new Date(Date.now() - 24 * 3600 * 1000), rawText: "today" };
  } else if (/\b(yesterday|last 48 hours?|past 48 hours?|48 hours?|48h|past 2 days|last 2 days|2 days|2d)\b/i.test(lower)) {
    postedWithinDays = 2;
    freshnessWindowHours = 48;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 2, unit: "DAY", cutoffDate: new Date(Date.now() - 48 * 3600 * 1000), rawText: "48h" };
  } else if (/\b(last 72 hours?|past 72 hours?|72 hours?|72h|last 3 days|past 3 days|3 days|3d|few days)\b/i.test(lower)) {
    postedWithinDays = 3;
    freshnessWindowHours = 72;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 3, unit: "DAY", cutoffDate: new Date(Date.now() - 72 * 3600 * 1000), rawText: "3 days" };
  } else if (/\b(last 7 days|past 7 days|7 days|7d|past week|last week|this week|1 week|week)\b/i.test(lower)) {
    postedWithinDays = 7;
    freshnessWindowHours = 168;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 7, unit: "DAY", cutoffDate: new Date(Date.now() - 7 * 24 * 3600 * 1000), rawText: "7 days" };
  } else if (/\b(latest|newest|recent|recently posted|new|fresh)\b/i.test(lower)) {
    freshnessWindowHours = 48;
    isExplicitFreshness = true;
    sortMode = "LATEST";
  }

  // Explicit user filter overrides take top priority
  if (filterOverrides?.freshnessWindowHours !== undefined) {
    freshnessWindowHours = filterOverrides.freshnessWindowHours;
    isExplicitFreshness = true;
  }
  if (filterOverrides?.isExplicitFreshness !== undefined) {
    isExplicitFreshness = filterOverrides.isExplicitFreshness;
  }
  if (filterOverrides?.postedWithinDays !== undefined) {
    postedWithinDays = filterOverrides.postedWithinDays;
  }
  if (filterOverrides?.dateConstraint !== undefined) {
    dateConstraint = filterOverrides.dateConstraint;
  }

  // 8.5. Requested Result Count Extraction (TASK-043)
  // E.g. "Give me 10 backend developer jobs", "Find 15 react roles", "10 jobs", "5 internships"
  let requestedCount: number | undefined;
  const countMatch = lower.match(/\b(?:give\s+me|find|show\s+me|get|search\s+for|list|locate|fetch|looking\s+for|look\s+for)\s+(\d{1,3})\s+/i) ||
    lower.match(/\b(?:top|first)\s+(\d{1,3})\s+(?:jobs?|openings?|roles?|positions?|internships?|opportunities)\b/i) ||
    lower.match(/\b(\d{1,3})\s+(?:[a-z/&-]+\s+){0,3}(?:openings?|positions?|roles?|jobs?|internships?)\b/i);

  if (countMatch && countMatch[1]) {
    const parsed = parseInt(countMatch[1], 10);
    if (parsed >= 1 && parsed <= 100) {
      requestedCount = parsed;
    }
  }

  // Natural-language requested count takes precedence over structured filterOverrides
  if (requestedCount === undefined && filterOverrides?.requestedCount !== undefined) {
    requestedCount = filterOverrides.requestedCount;
  }

  // 9. Minimum Relevance Expectations
  let minimumMatchScore = 65;
  if (/\b(high fit|strict match|high relevance|top fit)\b/i.test(lower)) {
    minimumMatchScore = 80;
  } else if (/\b(strict|top tier fit|at least 90|90 pts)\b/i.test(lower) || /\b90%\s*(?:match|fit|relevance|score)\b/i.test(lower)) {
    minimumMatchScore = 90;
  } else if (/\b(broad match|broad search|any fit|loose match)\b/i.test(lower)) {
    minimumMatchScore = 60;
  }
  const scoreMatch = lower.match(/\b(?:min|at least|minimum)\s+(\d{2})\s*(?:%|pts|points|score)?\b/);
  if (scoreMatch && scoreMatch[1]) {
    const parsedScore = parseInt(scoreMatch[1], 10);
    if (parsedScore >= 50 && parsedScore <= 95 && !/\b(?:budget|token|step|usage)\b/i.test(lower)) {
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
  if (/\b(greenhouse)\b/i.test(lower)) {
    matchedSources.push("Greenhouse");
  }
  if (/\b(ashby)\b/i.test(lower)) {
    matchedSources.push("Ashby");
  }
  if (/\b(lever)\b/i.test(lower)) {
    matchedSources.push("Lever");
  }
  const finalSources = matchedSources.length > 0 ? matchedSources : ["LinkedIn", "Y Combinator", "Indeed", "ATS Direct", "Company Careers"];

  // 11. Exclusion Intent
  const excludeKnown = /\b(avoid showing|already know|exclude known|hide seen|only new|genuinely new|brand new|skip seen|skip saved|only tell me when|haven't seen|havent seen|not seen before|never seen|unseen)\b/i.test(lower);

  // 12. Watch Intent Detection
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
    freshnessWindowHours: filterOverrides?.freshnessWindowHours !== undefined ? filterOverrides.freshnessWindowHours : freshnessWindowHours,
    postedWithinDays: filterOverrides?.postedWithinDays !== undefined ? filterOverrides.postedWithinDays : postedWithinDays,
    dateConstraint: filterOverrides?.dateConstraint !== undefined ? filterOverrides.dateConstraint : dateConstraint,
    requestedCount: requestedCount !== undefined ? requestedCount : filterOverrides?.requestedCount,
    isExplicitFreshness: filterOverrides?.isExplicitFreshness !== undefined ? filterOverrides.isExplicitFreshness : isExplicitFreshness,
    minimumMatchScore: filterOverrides?.minimumMatchScore || minimumMatchScore,
    sources: filterOverrides?.sources || finalSources,
    excludeKnown: filterOverrides?.excludeKnown !== undefined ? filterOverrides.excludeKnown : excludeKnown,
    watchIntent: filterOverrides?.watchIntent || watchIntent,
  };

  return intent;
}
