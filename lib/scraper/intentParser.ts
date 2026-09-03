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
  // Major Indian Cities & Tech Hubs
  { canonicalName: "Hyderabad", isCity: true, regex: /\b(hyderabad|hyd)\b/i },
  { canonicalName: "Bengaluru", isCity: true, regex: /\b(bengaluru|bangalore|blr)\b/i },
  { canonicalName: "Pune", isCity: true, regex: /\b(pune)\b/i },
  { canonicalName: "Mumbai", isCity: true, regex: /\b(mumbai|bombay)\b/i },
  { canonicalName: "Delhi", isCity: true, regex: /\b(delhi|new delhi|ncr|noida|gurgaon|gurugram)\b/i },
  { canonicalName: "Chennai", isCity: true, regex: /\b(chennai|madras)\b/i },
  { canonicalName: "Kolkata", isCity: true, regex: /\b(kolkata|calcutta)\b/i },
  { canonicalName: "Agartala", isCity: true, regex: /\b(agartala)\b/i },
  { canonicalName: "Guwahati", isCity: true, regex: /\b(guwahati)\b/i },
  { canonicalName: "Shillong", isCity: true, regex: /\b(shillong)\b/i },
  { canonicalName: "Imphal", isCity: true, regex: /\b(imphal)\b/i },
  { canonicalName: "Aizawl", isCity: true, regex: /\b(aizawl)\b/i },
  { canonicalName: "Kohima", isCity: true, regex: /\b(kohima)\b/i },
  { canonicalName: "Itanagar", isCity: true, regex: /\b(itanagar)\b/i },
  { canonicalName: "Gangtok", isCity: true, regex: /\b(gangtok)\b/i },
  { canonicalName: "Bhubaneswar", isCity: true, regex: /\b(bhubaneswar)\b/i },
  { canonicalName: "Patna", isCity: true, regex: /\b(patna)\b/i },
  { canonicalName: "Ranchi", isCity: true, regex: /\b(ranchi)\b/i },
  { canonicalName: "Lucknow", isCity: true, regex: /\b(lucknow)\b/i },
  { canonicalName: "Kanpur", isCity: true, regex: /\b(kanpur)\b/i },
  { canonicalName: "Dehradun", isCity: true, regex: /\b(dehradun)\b/i },
  { canonicalName: "Shimla", isCity: true, regex: /\b(shimla)\b/i },
  { canonicalName: "Chandigarh", isCity: true, regex: /\b(chandigarh)\b/i },
  { canonicalName: "Jaipur", isCity: true, regex: /\b(jaipur)\b/i },
  { canonicalName: "Ahmedabad", isCity: true, regex: /\b(ahmedabad)\b/i },
  { canonicalName: "Surat", isCity: true, regex: /\b(surat)\b/i },
  { canonicalName: "Vadodara", isCity: true, regex: /\b(vadodara|baroda)\b/i },
  { canonicalName: "Bhopal", isCity: true, regex: /\b(bhopal)\b/i },
  { canonicalName: "Indore", isCity: true, regex: /\b(indore)\b/i },
  { canonicalName: "Raipur", isCity: true, regex: /\b(raipur)\b/i },
  { canonicalName: "Nagpur", isCity: true, regex: /\b(nagpur)\b/i },
  { canonicalName: "Kochi", isCity: true, regex: /\b(kochi|cochin)\b/i },
  { canonicalName: "Thiruvananthapuram", isCity: true, regex: /\b(thiruvananthapuram|trivandrum)\b/i },
  { canonicalName: "Coimbatore", isCity: true, regex: /\b(coimbatore)\b/i },
  { canonicalName: "Visakhapatnam", isCity: true, regex: /\b(visakhapatnam|vizag)\b/i },
  { canonicalName: "Vijayawada", isCity: true, regex: /\b(vijayawada)\b/i },

  // Indian States & Territories
  { canonicalName: "Tripura", isCity: false, regex: /\b(tripura)\b/i },
  { canonicalName: "Northeast India", isCity: false, regex: /\b(northeast\s*india|north\s*east\s*india|northeastern\s*india)\b/i },
  { canonicalName: "Assam", isCity: false, regex: /\b(assam)\b/i },
  { canonicalName: "Meghalaya", isCity: false, regex: /\b(meghalaya)\b/i },
  { canonicalName: "Manipur", isCity: false, regex: /\b(manipur)\b/i },
  { canonicalName: "Mizoram", isCity: false, regex: /\b(mizoram)\b/i },
  { canonicalName: "Nagaland", isCity: false, regex: /\b(nagaland)\b/i },
  { canonicalName: "Arunachal Pradesh", isCity: false, regex: /\b(arunachal\s*pradesh)\b/i },
  { canonicalName: "Sikkim", isCity: false, regex: /\b(sikkim)\b/i },
  { canonicalName: "West Bengal", isCity: false, regex: /\b(west\s*bengal)\b/i },
  { canonicalName: "Odisha", isCity: false, regex: /\b(odisha|orissa)\b/i },
  { canonicalName: "Bihar", isCity: false, regex: /\b(bihar)\b/i },
  { canonicalName: "Jharkhand", isCity: false, regex: /\b(jharkhand)\b/i },
  { canonicalName: "Uttar Pradesh", isCity: false, regex: /\b(uttar\s*pradesh|up)\b/i },
  { canonicalName: "Uttarakhand", isCity: false, regex: /\b(uttarakhand)\b/i },
  { canonicalName: "Himachal Pradesh", isCity: false, regex: /\b(himachal\s*pradesh|hp)\b/i },
  { canonicalName: "Punjab", isCity: false, regex: /\b(punjab)\b/i },
  { canonicalName: "Haryana", isCity: false, regex: /\b(haryana)\b/i },
  { canonicalName: "Rajasthan", isCity: false, regex: /\b(rajasthan)\b/i },
  { canonicalName: "Gujarat", isCity: false, regex: /\b(gujarat)\b/i },
  { canonicalName: "Madhya Pradesh", isCity: false, regex: /\b(madhya\s*pradesh|mp)\b/i },
  { canonicalName: "Chhattisgarh", isCity: false, regex: /\b(chhattisgarh)\b/i },
  { canonicalName: "Maharashtra", isCity: false, regex: /\b(maharashtra)\b/i },
  { canonicalName: "Goa", isCity: false, regex: /\b(goa)\b/i },
  { canonicalName: "Karnataka", isCity: false, regex: /\b(karnataka)\b/i },
  { canonicalName: "Kerala", isCity: false, regex: /\b(kerala)\b/i },
  { canonicalName: "Tamil Nadu", isCity: false, regex: /\b(tamil\s*nadu|tn)\b/i },
  { canonicalName: "Andhra Pradesh", isCity: false, regex: /\b(andhra\s*pradesh|ap)\b/i },
  { canonicalName: "Telangana", isCity: false, regex: /\b(telangana)\b/i },

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
    related: ["Machine Learning Engineer", "ML Researcher", "Data Scientist", "Applied AI Engineer", "AI/ML Intern"],
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
    related: ["Nurse", "Registered Nurse", "Clinical Pharmacist", "Medical Doctor"],
  },
];

/**
 * Extracts comprehensive, structured SearchIntent from natural language queries
 */
export function parseSearchIntent(rawQuery?: string | null, filterOverrides?: Partial<SearchIntent>): SearchIntent {
  const cleanQuery = (rawQuery || "").trim();
  const lower = cleanQuery.toLowerCase();
  let workingQuery = cleanQuery;

  // 1. Evidence Verification & Requested Evidence Requirements
  const requiresEvidenceVerification = /\b(verified|visual\s*(?:page\s*)?snapshots?|snapshots?|direct\s*application\s*links?)\b/i.test(lower);
  const requestedEvidence: string[] = [];
  if (/\btitles?\b/i.test(lower)) requestedEvidence.push("job title");
  if (/\bcompan(?:y|ies)\b/i.test(lower)) requestedEvidence.push("company");
  if (/\blocations?\b/i.test(lower)) requestedEvidence.push("location");
  if (/\b(?:salary|compensation)\b/i.test(lower)) requestedEvidence.push("compensation");
  if (/\bqualifications?\b/i.test(lower)) requestedEvidence.push("qualifications");
  if (/\b(?:direct\s*application\s*links?|apply\s*links?)\b/i.test(lower)) requestedEvidence.push("direct application URL");
  if (/\bvisual\s*(?:page\s*)?snapshots?\b/i.test(lower)) requestedEvidence.push("visual snapshot");

  // 2. Sources Extraction & Platform Clause Shielding
  const matchedSources: string[] = [];
  if (/\b(linkedin|linked in)\b/i.test(lower)) matchedSources.push("LinkedIn");
  if (/\b(y combinator|yc|workatastartup|work at a startup)\b/i.test(lower)) matchedSources.push("Y Combinator");
  if (/\b(indeed)\b/i.test(lower)) matchedSources.push("Indeed");
  if (/\b(naukri)\b/i.test(lower)) matchedSources.push("Naukri");
  if (/\b(glassdoor)\b/i.test(lower)) matchedSources.push("Glassdoor");
  if (/\b(wellfound|angellist)\b/i.test(lower)) matchedSources.push("Wellfound");
  if (/\b(hacker\s*news)\b/i.test(lower)) matchedSources.push("Hacker News");
  if (/\b(github)\b/i.test(lower)) matchedSources.push("GitHub Curated");
  if (/\b(greenhouse)\b/i.test(lower)) matchedSources.push("Greenhouse");
  if (/\b(ashby)\b/i.test(lower)) matchedSources.push("Ashby");
  if (/\b(lever)\b/i.test(lower)) matchedSources.push("Lever");

  // Mask source clause in working query (e.g. "search across linkedin, y combinator, indeed")
  workingQuery = workingQuery.replace(/\b(?:search\s+)?(?:across|on|in|via)\s+(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever)(?:\s*,\s*(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever))*(?:\s+(?:and|or)\s+(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever))?/gi, " ");

  // 3. Temporal Expressions & Date Constraint Parsing (Shielded early to prevent count/role collision)
  let isExplicitFreshness = false;
  let freshnessWindowHours = 168; // Default 7 days
  let postedWithinDays: number | undefined;
  let dateConstraint: any = undefined;
  let sortMode: "LATEST" | "RELEVANCE_THEN_FRESHNESS" = "RELEVANCE_THEN_FRESHNESS";

  // Check months (e.g. "last 2 months", "past 3 months", "2 months ago", "within 2 months")
  const explicitMonthsMatch = workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,2})\s*(?:months?|mo)\b/i) ||
    workingQuery.match(/\b(\d{1,2})\s*(?:months?|mo)\s*ago\b/i) ||
    workingQuery.match(/\b(?:two|past\s+two|last\s+two)\s+months\b/i);

  if (explicitMonthsMatch) {
    const num = explicitMonthsMatch[1] ? parseInt(explicitMonthsMatch[1], 10) : 2;
    postedWithinDays = num * 30;
    freshnessWindowHours = num * 30 * 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = {
      type: "RELATIVE",
      amount: num,
      unit: "MONTH",
      cutoffDate: new Date(Date.now() - num * 30 * 24 * 3600 * 1000),
      rawText: explicitMonthsMatch[0],
    };
    workingQuery = workingQuery.replace(explicitMonthsMatch[0], " ");
  }

  // Check days (e.g. "last 15 days", "within 30 days", "past 10 days")
  const explicitDaysMatch = workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,3})\s*(?:days?|d)\b/i) ||
    workingQuery.match(/\b(\d{1,3})\s*(?:days?|d)\s*ago\b/i) ||
    workingQuery.match(/\bposted\s+(?:within|in|last|past)\s+(\d{1,3})\s*(?:days?|d)\b/i);

  if (!explicitMonthsMatch && explicitDaysMatch && explicitDaysMatch[1]) {
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
      workingQuery = workingQuery.replace(explicitDaysMatch[0], " ");
    }
  }

  // Check weeks (e.g. "last 2 weeks", "past 3 weeks")
  const explicitWeeksMatch = workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,2})\s*(?:weeks?|w)\b/i) ||
    workingQuery.match(/\b(\d{1,2})\s*(?:weeks?|w)\s*ago\b/i);

  if (!explicitMonthsMatch && !explicitDaysMatch && explicitWeeksMatch && explicitWeeksMatch[1]) {
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
      workingQuery = workingQuery.replace(explicitWeeksMatch[0], " ");
    }
  }

  // Check hours
  const explicitHoursMatch = workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,3})\s*(?:hours?|hrs?|h)\b/i);
  if (!explicitMonthsMatch && !explicitDaysMatch && !explicitWeeksMatch && explicitHoursMatch && explicitHoursMatch[1]) {
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
      workingQuery = workingQuery.replace(explicitHoursMatch[0], " ");
    }
  } else if (!explicitMonthsMatch && /\b(today|posted today|just now|just posted|past 24 hours?|last 24 hours?|24 hours?|24h)\b/i.test(lower)) {
    postedWithinDays = 1;
    freshnessWindowHours = 24;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 1, unit: "DAY", cutoffDate: new Date(Date.now() - 24 * 3600 * 1000), rawText: "today" };
    workingQuery = workingQuery.replace(/\b(today|posted today|just now|just posted|past 24 hours?|last 24 hours?|24 hours?|24h)\b/gi, " ");
  } else if (!explicitMonthsMatch && /\b(yesterday|last 48 hours?|past 48 hours?|48 hours?|48h|past 2 days|last 2 days|2 days|2d)\b/i.test(lower)) {
    postedWithinDays = 2;
    freshnessWindowHours = 48;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 2, unit: "DAY", cutoffDate: new Date(Date.now() - 48 * 3600 * 1000), rawText: "48h" };
    workingQuery = workingQuery.replace(/\b(yesterday|last 48 hours?|past 48 hours?|48 hours?|48h|past 2 days|last 2 days|2 days|2d)\b/gi, " ");
  } else if (!explicitMonthsMatch && /\b(last 72 hours?|past 72 hours?|72 hours?|72h|last 3 days|past 3 days|3 days|3d|few days)\b/i.test(lower)) {
    postedWithinDays = 3;
    freshnessWindowHours = 72;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 3, unit: "DAY", cutoffDate: new Date(Date.now() - 72 * 3600 * 1000), rawText: "3 days" };
    workingQuery = workingQuery.replace(/\b(last 72 hours?|past 72 hours?|72 hours?|72h|last 3 days|past 3 days|3 days|3d|few days)\b/gi, " ");
  } else if (!explicitMonthsMatch && /\b(last 7 days|past 7 days|7 days|7d|past week|last week|this week|1 week|week)\b/i.test(lower)) {
    postedWithinDays = 7;
    freshnessWindowHours = 168;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    dateConstraint = { type: "RELATIVE", amount: 7, unit: "DAY", cutoffDate: new Date(Date.now() - 7 * 24 * 3600 * 1000), rawText: "7 days" };
    workingQuery = workingQuery.replace(/\b(last 7 days|past 7 days|7 days|7d|past week|last week|this week|1 week|week)\b/gi, " ");
  } else if (!explicitMonthsMatch && /\b(latest|newest|recent|recently posted|prioritize recently posted|new|fresh)\b/i.test(lower)) {
    freshnessWindowHours = 48;
    isExplicitFreshness = true;
    sortMode = "LATEST";
    workingQuery = workingQuery.replace(/\b(latest|newest|recent|recently posted|prioritize recently posted|new|fresh)\b/gi, " ");
  }

  // Filter overrides for date
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

  // 4. Requested Result Count Extraction (TASK-043 / TASK-060 Hardened)
  let requestedCount: number | undefined;
  // Pattern A: "for 10 verified ...", "search for 10 ...", "find 10 ..."
  const countPatternA = /\b(?:for|search\s+for|find|get|show\s+me|fetch|locate|give\s+me|looking\s+for)\s+(\d{1,3})\s+(?:verified\s+)?/i;
  const cMatchA = cleanQuery.match(countPatternA);
  if (cMatchA && cMatchA[1]) {
    const parsed = parseInt(cMatchA[1], 10);
    if (parsed >= 1 && parsed <= 100) {
      requestedCount = parsed;
    }
  }

  // Pattern B: Number qualifying opportunity nouns (MUST NOT be followed by temporal unit)
  if (!requestedCount) {
    const cMatchB = cleanQuery.match(/\b(\d{1,3})\s+(?:verified\s+)?(?:[a-z/&-]+\s+){0,3}(?:openings?|positions?|roles?|jobs?|internships?|opportunities|listings?)\b/i);
    if (cMatchB && cMatchB[1]) {
      const afterNum = cleanQuery.slice(cMatchB.index! + cMatchB[1].length).trim();
      if (!/^(months?|mo|weeks?|w|days?|d|hours?|hrs?|h|years?|yr|minutes?|min|pts|points|%|percent)\b/i.test(afterNum)) {
        const parsed = parseInt(cMatchB[1], 10);
        if (parsed >= 1 && parsed <= 100) {
          requestedCount = parsed;
        }
      }
    }
  }

  // Pattern C: "top 10 jobs", "first 5 positions"
  if (!requestedCount) {
    const cMatchC = cleanQuery.match(/\b(?:top|first)\s+(\d{1,3})\s+(?:jobs?|openings?|roles?|positions?|internships?|opportunities)\b/i);
    if (cMatchC && cMatchC[1]) {
      const parsed = parseInt(cMatchC[1], 10);
      if (parsed >= 1 && parsed <= 100) {
        requestedCount = parsed;
      }
    }
  }

  if (requestedCount === undefined && filterOverrides?.requestedCount !== undefined) {
    requestedCount = filterOverrides.requestedCount;
  }

  // 5. Work Mode Detection
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

  // 6. Experience Level & Opportunity Type
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

  // Target Graduation Year
  let targetGradYear: number | undefined;
  const gradMatch = lower.match(/\b(202[4-9]|203[0-5])\b/);
  if (gradMatch) {
    targetGradYear = parseInt(gradMatch[1], 10);
  }

  // Company Type (Startup vs Enterprise)
  let companyType: SearchIntent["companyType"] = "ANY";
  if (/\b(startup|startups|early stage|yc startup|seed|series a|series b)\b/i.test(workingQuery)) {
    companyType = "STARTUP";
  } else if (/\b(enterprise|enterprises|faang|big tech|fortune 500|corp|mnc)\b/i.test(workingQuery)) {
    companyType = "ENTERPRISE";
  }

  // 7. Locations Extraction (Comprehensive Indian states, territories, and cities)
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
      workingQuery = workingQuery.replace(locDef.regex, " ");
    }
  }

  matchedLocations.push(...matchedCities, ...matchedCountries);

  // Dynamic Location Fallback: "in <Location>", "around <Location>", "near <Location>"
  if (matchedLocations.length === 0) {
    const locMatch = workingQuery.match(/\b(?:in|at|near|around)\s+([A-Za-z\s]+?)(?=\s+(?:jobs?|roles?|positions?|openings?|internships?|remote|hybrid|$))/i);
    if (locMatch && locMatch[1]) {
      const candLoc = locMatch[1].trim();
      const isBlacklisted = /^(the|any|all|some|good|latest|recent|new|urgent|verified|mechanical|software|civil|electrical|chemical|process|nurse|financial|marketing)$/i.test(candLoc);
      if (candLoc.length >= 2 && !isBlacklisted) {
        const canonicalLoc = candLoc.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        matchedLocations.push(canonicalLoc);
        workingQuery = workingQuery.replace(locMatch[0], " ");
      }
    }
  }

  const primaryLocation = matchedLocations[0] || undefined;

  // 8. Skills Extraction
  const matchedSkills: string[] = [];
  for (const skillDef of KNOWN_SKILL_DEFINITIONS) {
    if (skillDef.regex.test(lower)) {
      if (!matchedSkills.includes(skillDef.canonicalName)) {
        matchedSkills.push(skillDef.canonicalName);
      }
    }
  }

  // 9. Roles Extraction
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

  // Dynamic Arbitrary Role Extraction from shielded workingQuery
  if (matchedRoles.length === 0) {
    // Strip conversational filler, prompt enhancer verbs, evidence phrases, and prepositions
    const cleanRemainder = workingQuery
      .replace(/\b(search|find|give\s+me|show\s+me|looking\s+for|look\s+for|i\s*m\s+looking\s+for|some|verified|positions?|jobs?|roles?|openings?|internships?|opportunities|listings?|extract|with|and|or|visual|snapshots?|page|direct|application|links?|core|technical|qualifications?|salary|compensation|locations?|company|names?|titles?|for|\d+)\b/gi, " ")
      .replace(/\b(in|at|around|near|on|from|to|into|across)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanRemainder.length >= 3 && !/^(the|any|all|some|good|top|best|entry\s*level|junior|senior)$/i.test(cleanRemainder)) {
      const canonical = cleanRemainder.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
      matchedRoles.push(canonical);
    }
  }

  // Only default to Software Engineer if explicit tech keywords were used
  if (matchedRoles.length === 0 && /\b(tech|technology|developer|coding)\b/i.test(cleanQuery)) {
    matchedRoles.push("Software Engineer");
  }

  const primaryRole = matchedRoles[0] || undefined;

  // 10. Target Companies Extraction
  const matchedCompanies: string[] = [];
  for (const compDef of KNOWN_COMPANY_DEFINITIONS) {
    if (compDef.regex.test(lower)) {
      if (!matchedCompanies.includes(compDef.canonicalName)) {
        matchedCompanies.push(compDef.canonicalName);
      }
    }
  }

  if (matchedCompanies.length === 0) {
    const compMatch = cleanQuery.match(/\b(?:from|at|by|company|companies|watch|watching|track|tracking|monitor|monitoring)\s+([A-Za-z0-9&.-]+(?:\s+[A-Za-z0-9&.-]+)?)(?:\s+(?:for|in|roles?|jobs?|internships?|with|where|seeking|and|from|posted|last|past|within|today|yesterday|this)|$)/i);
    if (compMatch && compMatch[1]) {
      const candidateComp = compMatch[1].trim();
      const isGeneric = /^(the|any|all|remote|hybrid|on-site|an?|india|hyderabad|bengaluru|pune|mumbai|delhi|tripura|agartala|usa|uk|software|developer|engineer|intern|internship|startups?|enterprises?|faang|big\s*tech|companies?|jobs?|internships?|roles?|positions?|openings?|freshers?|graduates?|students?|\d{4})$/i.test(candidateComp);
      if (candidateComp.length >= 2 && !isGeneric && !matchedCompanies.includes(candidateComp)) {
        matchedCompanies.push(candidateComp);
      }
    }
  }

  const primaryCompany = matchedCompanies[0] || undefined;

  // 11. Minimum Relevance Expectations
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

  // 12. Final Sources Resolution (TASK-060: Strict User Preference Preservation)
  // If user requested specific sources, use ONLY those. Never silently inject ATS or unrequested defaults.
  const defaultSources = ["LinkedIn", "Y Combinator", "Indeed"];
  const finalSources = matchedSources.length > 0 ? matchedSources : defaultSources;

  // 13. Exclusion Intent
  const excludeKnown = /\b(avoid showing|already know|exclude known|hide seen|only new|genuinely new|brand new|skip seen|skip saved|only tell me when|haven't seen|havent seen|not seen before|never seen|unseen)\b/i.test(lower);

  // 14. Watch Intent Detection
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

  // Build canonical SearchIntent
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
    requiresEvidenceVerification: filterOverrides?.requiresEvidenceVerification !== undefined ? filterOverrides.requiresEvidenceVerification : requiresEvidenceVerification,
    requestedEvidence: filterOverrides?.requestedEvidence || (requestedEvidence.length > 0 ? requestedEvidence : undefined),
  };

  return intent;
}
