/**
 * §DETERMINISTIC NATURAL-LANGUAGE SEARCH INTENT PARSER (TASK-018)
 * Translates natural-language user requests into structured, deterministic SearchIntent
 * and DiscoveryPlan configuration without requiring any external LLM calls or network latency.
 * 
 * 100% deterministic - Zero token overhead ($0).
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
    /\b(jobs?|internships?|interns?|co-?op|coops?|openings?|hiring|vacanc(?:y|ies)|careers?|positions?|roles?|opportunities|fellowships?|fellows?|gigs?|freelance|contract(?:s)?|apprenticeship(?:s)?|job-search|job search|employment|entry-level|fresher|freshers|reposted|reposts?|job postings?)\b/i.test(lower);

  // 3. Job Monitoring / Watch Phrases
  const hasWatchJobKeywords =
    /\b(keep watching for|watch for|monitor|track|alert me when|notify me when)\b.*\b(jobs?|internships?|roles?|opportunities|openings?|postings?|reposts?|matches?)\b/i.test(lower) ||
    /\b(keep watching for (?:these|new|genuinely new|reposts?|opportunities|openings?))\b/i.test(lower);

  // 4. Tech Role with Discovery Verbs (e.g. "Find React developer in Hyderabad", "Looking for AI engineers")
  const hasDiscoveryVerb = /\b(find|search|looking for|seek|seeking|show me|discover|get|locate|list)\b/i.test(lower);
  const hasTechRole = /\b(software engineer|software development|swe|sde|software developer|developer|frontend|front-end|backend|back-end|fullstack|full-stack|ai engineer|ml engineer|data scientist|data engineer|data analyst|business analyst|bi analyst|devops|product manager|qa engineer|programmer)\b/i.test(lower);

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
  { canonicalName: "robotics", regex: /\b(robotics|ros|ros2|mechatronics)\b/i },
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
  { canonicalName: "Y Combinator", regex: /\b(y\s*combinator|yc|workatastartup)\b/i },
  { canonicalName: "Tesla", regex: /\b(tesla)\b/i },
  { canonicalName: "SpaceX", regex: /\b(spacex)\b/i },
  { canonicalName: "Rivian", regex: /\b(rivian)\b/i },
  { canonicalName: "BBC", regex: /\b(bbc)\b/i },
  { canonicalName: "Reuters", regex: /\b(reuters)\b/i },
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
  { canonicalName: "Tokyo", isCity: true, regex: /\b(tokyo)\b/i },
  { canonicalName: "Toronto", isCity: true, regex: /\b(toronto)\b/i },
  { canonicalName: "Singapore", isCity: true, regex: /\b(singapore)\b/i },
  { canonicalName: "Sydney", isCity: true, regex: /\b(sydney)\b/i },
  { canonicalName: "Paris", isCity: true, regex: /\b(paris)\b/i },
  { canonicalName: "Amsterdam", isCity: true, regex: /\b(amsterdam)\b/i },
  { canonicalName: "Dublin", isCity: true, regex: /\b(dublin)\b/i },
  { canonicalName: "Zurich", isCity: true, regex: /\b(zurich)\b/i },
  { canonicalName: "Seattle", isCity: true, regex: /\b(seattle)\b/i },
  { canonicalName: "Austin", isCity: true, regex: /\b(austin)\b/i },
  { canonicalName: "Boston", isCity: true, regex: /\b(boston)\b/i },

  // Countries
  { canonicalName: "India", isCity: false, regex: /\b(india)\b/i },
  { canonicalName: "United States", isCity: false, regex: /\b(united states|usa|us)\b/i },
  { canonicalName: "United Kingdom", isCity: false, regex: /\b(united kingdom|uk)\b/i },
  { canonicalName: "Canada", isCity: false, regex: /\b(canada)\b/i },
  { canonicalName: "Germany", isCity: false, regex: /\b(germany)\b/i },
  { canonicalName: "Japan", isCity: false, regex: /\b(japan)\b/i },
  { canonicalName: "France", isCity: false, regex: /\b(france)\b/i },
  { canonicalName: "Netherlands", isCity: false, regex: /\b(netherlands)\b/i },
  { canonicalName: "Ireland", isCity: false, regex: /\b(ireland)\b/i },
  { canonicalName: "Switzerland", isCity: false, regex: /\b(switzerland)\b/i },
  { canonicalName: "Australia", isCity: false, regex: /\b(australia)\b/i },
  { canonicalName: "Europe", isCity: false, regex: /\b(europe|european\s*union|eu)\b/i },
  { canonicalName: "Africa", isCity: false, regex: /\b(africa)\b/i },
  { canonicalName: "Southeast Asia", isCity: false, regex: /\b(southeast\s*asia|se\s*asia|asean)\b/i },
  { canonicalName: "Midwest", isCity: false, regex: /\b(midwest|midwestern(?:\s*us)?)\b/i },
  { canonicalName: "Dubai", isCity: true, regex: /\b(dubai|uae|united\s*arab\s*emirates)\b/i },
  { canonicalName: "Chicago", isCity: true, regex: /\b(chicago)\b/i },
  { canonicalName: "Texas", isCity: false, regex: /\b(texas|tx)\b/i },
];

export interface KnownRoleDefinition {
  canonicalName: string;
  regex: RegExp;
  related: string[];
}

export const KNOWN_ROLE_DEFINITIONS: KnownRoleDefinition[] = [
  {
    canonicalName: "Founding Engineer",
    regex: /\b(founding\s*engineer|founding\s*developer|founding\s*member)\b/i,
    related: ["Staff Software Engineer", "Lead Engineer", "Principal Engineer"],
  },
  {
    canonicalName: "Robotics Engineer",
    regex: /\b(robotics\s*(?:engineer(?:ing)?)?|roboticist|automation\s*robotics|ros|mechatronics)\b/i,
    related: ["Robotics Software Engineer", "Mechatronics Engineer", "Autonomous Systems Engineer"],
  },
  {
    canonicalName: "AI Engineer",
    regex: /\b(ai|artificial intelligence|machine learning|ml|deep learning|llm|nlp|genai)\b/i,
    related: ["Machine Learning Engineer", "ML Researcher", "Data Scientist", "Applied AI Engineer", "AI/ML Intern"],
  },
  {
    canonicalName: "Data Scientist",
    regex: /\b(data\s*scien(?:tist|ce)|applied\s*scien(?:tist|ce)|research\s*scien(?:tist|ce)|quantitative\s*researcher)\b/i,
    related: ["Machine Learning Engineer", "Data Analyst", "Data Engineer", "AI Researcher", "Data Science Intern"],
  },
  {
    canonicalName: "Machine Learning Engineer",
    regex: /\b(machine\s*learning\s*engineer|ml\s*engineer|deep\s*learning\s*engineer|mlops|ai\s*engineer)\b/i,
    related: ["Data Scientist", "AI Engineer", "MLOps Engineer", "Data Engineer", "ML Research Intern"],
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
    regex: /\b(software\s*(?:engineer(?:ing)?|developer|development|dev)|swe|sde|developer roles?|programmer)\b/i,
    related: ["Software Developer", "Junior Software Engineer", "Full Stack Developer", "Full Stack Engineer", "SDE Intern"],
  },
  {
    canonicalName: "Data Analyst",
    regex: /\b(data analyst|business analyst|bi analyst|business intelligence analyst|analytics analyst|product analyst)\b/i,
    related: ["Business Intelligence Analyst", "Analytics Specialist", "Junior Data Analyst", "Data Analytics Intern"],
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
    regex: /\b(product\s*manag(?:er|ement)|pm|associate\s*product\s*manager|apm)\b/i,
    related: ["APM Intern", "Technical Product Manager", "Product Specialist"],
  },
  {
    canonicalName: "QA Engineer",
    regex: /\b(qa engineer|quality assurance|sdet|test engineer|automation engineer)\b/i,
    related: ["SDET Intern", "Automation Test Engineer", "QA Analyst"],
  },
  {
    canonicalName: "Mechanical Engineer",
    regex: /\b(m[ea]chanical\s*(?:engineering|engineer)?|mech\s*eng|cad\s*designer|solidworks|hvac\s*engineer)\b/i,
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
    regex: /\b(ui\/ux|ux\s*design(?:er)?|ui\s*design(?:er)?|product\s*design(?:er)?|graphic\s*design(?:er)?)\b/i,
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
    regex: /\b(financial\s*analyst|accountant|accounting|auditor|finance\s*manager|investment\s*banking|finance)\b/i,
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
  {
    canonicalName: "Cybersecurity Engineer",
    regex: /\b(cybersecurity|cyber\s*security|infosec|information\s*security|security\s*engineer|soc\s*analyst|penetration\s*tester)\b/i,
    related: ["Security Engineer", "Information Security Analyst", "Cybersecurity Specialist"],
  },
  {
    canonicalName: "Customer Support Specialist",
    regex: /\b(customer\s*support|customer\s*service|client\s*support|support\s*specialist|customer\s*success)\b/i,
    related: ["Customer Support Representative", "Customer Success Manager", "Client Services Associate"],
  },
  {
    canonicalName: "Public Health Researcher",
    regex: /\b(public\s*health|epidemiolog(?:y|ist)|health\s*policy|global\s*health)\b/i,
    related: ["Public Health Analyst", "Epidemiologist", "Health Policy Fellow"],
  },
  {
    canonicalName: "Journalist",
    regex: /\b(journalis(?:m|t)|reporter|news\s*writer|investigative\s*reporter|editor)\b/i,
    related: ["Staff Writer", "News Reporter", "Journalism Intern", "Editorial Assistant"],
  },
  {
    canonicalName: "Teaching Fellow",
    regex: /\b(teach(?:ing|er)?|instructor|lecturer|educator|faculty|professorship)\b/i,
    related: ["Teaching Fellow", "Lecturer", "Instructor", "Education Specialist"],
  },
  {
    canonicalName: "Legal Specialist",
    regex: /\b(legal|law\s*firm|lawyer|attorney|paralegal|counsel|corporate\s*counsel)\b/i,
    related: ["Legal Intern", "Paralegal", "Associate Counsel", "Law Clerk"],
  },
  {
    canonicalName: "Climate Policy Analyst",
    regex: /\b(climate\s*policy|environmental\s*policy|sustainability\s*specialist|climate\s*fellow(?:ship)?|esg\s*analyst)\b/i,
    related: ["Climate Policy Fellow", "Sustainability Consultant", "Environmental Researcher"],
  },
  {
    canonicalName: "Agricultural Scientist",
    regex: /\b(agricultural\s*science|agronom(?:y|ist)|agritech|agriculture\s*specialist)\b/i,
    related: ["Agronomist", "Agricultural Researcher", "Crop Scientist"],
  },
  {
    canonicalName: "Physics Researcher",
    regex: /\b(physic(?:s|ist)|theoretical\s*physic(?:s|ist)|condensed\s*matter|quantum\s*physic(?:s|ist))\b/i,
    related: ["Research Fellow", "Postdoctoral Researcher", "Physics Fellow"],
  },
  {
    canonicalName: "Hospitality Manager",
    regex: /\b(hospitality|hotel\s*management|hotel\s*manager|resort\s*manager|guest\s*relations)\b/i,
    related: ["Hotel General Manager", "Hospitality Operations Specialist", "Front Desk Manager"],
  },
];

export const KNOWN_CURRENCY_CODES = new Set([
  "usd", "eur", "gbp", "inr", "cad", "aud", "jpy", "chf", "sgd", "hkd", "nzd", "sek", "nok", "cny", "brl", "mxn",
  "dollars", "dollar", "euros", "euro", "pounds", "pound", "rupees", "rupee", "rs", "lpa", "ctc", "k", "stipend"
]);

export const CONVERSATIONAL_PREAMBLES = [
  /^i\s+(?:need|want|would\s+like)\s+to\s+(?:know|find|see|check|discover|get|search|look)\s+(?:what|which|if\s+there\s+are|about)?\s*/i,
  /^(?:can|could|would)\s+you\s+(?:please\s+)?(?:tell|show|find|give|get|help)\s+(?:me\s+)?(?:what|which|about)?\s*/i,
  /^(?:please\s+)?(?:tell|show|give|find|get)\s+me\s+(?:what|which|about)?\s*/i,
  /^what\s+(?:are\s+the\s+)?(?:companies|startups|employers|places)\s+(?:that\s+are\s+|which\s+are\s+|are\s+)?/i,
  /^(?:who\s+is|who's)\s+hiring\s+(?:for|in)?\s*/i,
  /^(?:tell\s+me\s+about|looking\s+to\s+(?:know|find)|search\s+for|find\s+me(?:\s+some)?)\s*/i,
];

/**
 * Extracts comprehensive, structured SearchIntent from natural language queries
 */
export function parseSearchIntent(rawQuery?: string | null, filterOverrides?: Partial<SearchIntent>): SearchIntent {
  let workingQuery = (rawQuery || "").trim();

  // 0. Conversational Preamble & Inquiry Stripping
  for (const preamble of CONVERSATIONAL_PREAMBLES) {
    if (preamble.test(workingQuery)) {
      workingQuery = workingQuery.replace(preamble, " ").trim();
      break;
    }
  }

  // Common Typo Normalization (TASK-R5 Typo Tolerance & Autonomous Broadening)
  workingQuery = workingQuery
    .replace(/\bremort\b/gi, "remote")
    .replace(/\bremot\b/gi, "remote")
    .replace(/\bremotee\b/gi, "remote")
    .replace(/\binter\b/gi, "intern")
    .replace(/\binternn\b/gi, "intern")
    .replace(/\bintrn\b/gi, "intern")
    .replace(/\binternhip\b/gi, "internship")
    .replace(/\bintership\b/gi, "internship")
    .replace(/\bintrnship\b/gi, "internship")
    .replace(/\bmachanic(?:al)?\b/gi, "mechanical")
    .replace(/\bmecanic(?:al)?\b/gi, "mechanical")
    .replace(/\benginer\b/gi, "engineer")
    .replace(/\benginering\b/gi, "engineering")
    .replace(/\bsoftare\b/gi, "software")
    .replace(/\bsoftwear\b/gi, "software")
    .replace(/\bsoftwre\b/gi, "software")
    .replace(/\bdevelopr\b/gi, "developer")
    .replace(/\banalist\b/gi, "analyst")
    .replace(/\bfron-end\b/gi, "frontend")
    .replace(/\bfrontendd\b/gi, "frontend")
    .replace(/\bbckend\b/gi, "backend")
    .replace(/\bbackendd\b/gi, "backend")
    .replace(/\bfullstackk\b/gi, "fullstack");

  const cleanQuery = workingQuery;
  const lower = cleanQuery.toLowerCase();

  // Strip remuneration clauses early so "paying in USD" does not append "paying" to roles
  workingQuery = workingQuery.replace(/\b(?:paying|paid|salary|salaries|compensation|comp|stipend|package)\s+(?:in|of|around|at)\s+[A-Za-z0-9$€£₹]+\b/gi, " ");
  workingQuery = workingQuery.replace(/\b(?:in|of)\s+(?:usd|eur|gbp|inr|cad|aud|dollars?|euros?|pounds?|rupees?|lpa|ctc)\b/gi, " ");

  // Strip conversational inquiry connectors (e.g. "what companies in India are working on robotics and hiring right now")
  workingQuery = workingQuery.replace(/\b(?:what\s+)?companies\s+(?:in|at|near|around)\s+/gi, "in ");
  workingQuery = workingQuery.replace(/\b(?:are\s+)?working\s+on\b/gi, " ");
  workingQuery = workingQuery.replace(/\b(?:and\s+)?hiring(?:\s+right\s+now|\s+now)?\b/gi, " ");
  workingQuery = workingQuery.replace(/\bright\s+now\b/gi, " ");

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
  if (/\b(ats|direct|company\s+careers?)\b/i.test(lower)) matchedSources.push("ATS Direct");

  // Mask source clause in working query (e.g. "search across linkedin, y combinator, indeed")
  workingQuery = workingQuery.replace(/\b(?:search\s+)?(?:across|on|in|via)\s+(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever|ats|direct)(?:\s*,\s*(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever|ats|direct))*(?:\s+(?:and|or)\s+(?:linkedin|y\s*combinator|yc|indeed|naukri|glassdoor|wellfound|github|hacker\s*news|greenhouse|ashby|lever|ats|direct))?/gi, " ");

  // Mask memory & profile references so they are not captured as role or company clauses
  workingQuery = workingQuery.replace(/\b(?:based\s+on\s+)?(?:my\s+)?(?:saved\s+roles?|saved\s+preferences?)(?:\s+(?:on|in|from)\s+(?:the\s+)?(?:memory(?:\s+vault)?|profile))?\b/gi, " ");
  workingQuery = workingQuery.replace(/\b(?:on|in|from)\s+(?:the\s+)?(?:memory(?:\s+vault)?|profile)\b/gi, " ");

  // Mask startup funding phrases early so "startups which are recently raise fund" sets companyType and doesn't pollute role titles or trigger false 48h freshness
  const hasStartupFundingPhrase =
    /\b(?:in\s+)?(?:startups?|companies?)\s+(?:which\s+(?:are|have)\s+|that\s+(?:are|have)\s+|who\s+(?:are|have)\s+)?(?:recently\s+)?(?:raised?|raising|raise)\s+(?:funds?|funding|seed|series\s+[a-z])(?:\s+as\s+a|\s+as)?\b/i.test(workingQuery) ||
    /\b(?:startups?\s+which\s+are\s+recently\s+raise\s+fund(?:\s+as\s+a|\s+as)?)\b/i.test(workingQuery) ||
    /\b(?:recently\s+)?(?:raised?|raising|raise)\s+(?:funds?|funding|seed|series\s+[a-z])\b/i.test(workingQuery);

  if (hasStartupFundingPhrase) {
    workingQuery = workingQuery
      .replace(/\b(?:in\s+)?(?:startups?|companies?)\s+(?:which\s+(?:are|have)\s+|that\s+(?:are|have)\s+|who\s+(?:are|have)\s+)?(?:recently\s+)?(?:raised?|raising|raise)\s+(?:funds?|funding|seed|series\s+[a-z])(?:\s+as\s+a|\s+as)?\b/gi, " ")
      .replace(/\b(?:startups?\s+which\s+are\s+recently\s+raise\s+fund(?:\s+as\s+a|\s+as)?)\b/gi, " ")
      .replace(/\b(?:recently\s+)?(?:raised?|raising|raise)\s+(?:funds?|funding|seed|series\s+[a-z])\b/gi, " ");
  }

  // 3. Temporal Expressions & Date Constraint Parsing (Shielded early to prevent count/role collision)
  let isExplicitFreshness = false;
  let freshnessWindowHours = 168; // Default 7 days
  let postedWithinDays: number | undefined;
  let dateConstraint: any = undefined;
  let sortMode: "LATEST" | "RELEVANCE_THEN_FRESHNESS" = "RELEVANCE_THEN_FRESHNESS";

  // Check months (e.g. "last 2 months", "past 3 months", "2 months ago", "within 2 months", "this month", "more than a month ago")
  const moreThanMonthMatch = workingQuery.match(/\b(?:posted\s+)?(?:more\s+than\s+(?:a|\d+)\s+months?\s+ago)\b/i);
  if (moreThanMonthMatch) {
    postedWithinDays = 60;
    freshnessWindowHours = 60 * 24;
    isExplicitFreshness = true;
    sortMode = "RELEVANCE_THEN_FRESHNESS";
    dateConstraint = {
      type: "RELATIVE",
      amount: 30,
      unit: "MONTH",
      cutoffDate: new Date(Date.now() - 30 * 24 * 3600 * 1000),
      rawText: moreThanMonthMatch[0],
    };
    workingQuery = workingQuery.replace(moreThanMonthMatch[0], " ");
  }

  const explicitMonthsMatch = !moreThanMonthMatch && (
    workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,2})\s*(?:months?|mo)\b/i) ||
    workingQuery.match(/\b(\d{1,2})\s*(?:months?|mo)\s*ago\b/i) ||
    workingQuery.match(/\b(?:two|past\s+two|last\s+two)\s+months\b/i) ||
    workingQuery.match(/\b(?:posted\s+)?this\s+month\b/i)
  );

  if (explicitMonthsMatch) {
    const num = explicitMonthsMatch[1] ? parseInt(explicitMonthsMatch[1], 10) : 1;
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

  // Check colloquial day ranges and word numbers (e.g. "which has been posted in last two or three days", "last 2 or 3 days", "past few days", "two or three days", "three days")
  const WORD_TO_DAYS: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    ten: 10,
    fourteen: 14,
    fifteen: 15,
    twenty: 20,
    thirty: 30,
    "a few": 3,
    few: 3,
    "couple of": 2,
    couple: 2,
    several: 4,
  };

  const colloquialDaysMatch = workingQuery.match(
    /\b(?:(?:that|which)\s+(?:has|have)\s+(?:been\s+)?)?(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(?:(one|two|three|four|five|six|seven|ten|fourteen|fifteen|twenty|thirty|a\s+few|few|couple\s+of|couple|several)(?:\s*(?:or|to|-)\s*(one|two|three|four|five|six|seven|ten|fourteen|fifteen|twenty|thirty|\d+))?|(\d+)\s*(?:or|to|-)\s*(\d+))\s*(?:days?|d)\b/i
  );

  if (!explicitMonthsMatch && colloquialDaysMatch) {
    let days = 3;
    const w1 = colloquialDaysMatch[1]?.toLowerCase().trim();
    const w2 = colloquialDaysMatch[2]?.toLowerCase().trim();
    const d1 = colloquialDaysMatch[3] ? parseInt(colloquialDaysMatch[3], 10) : undefined;
    const d2 = colloquialDaysMatch[4] ? parseInt(colloquialDaysMatch[4], 10) : undefined;

    if (d2 !== undefined) {
      days = d2;
    } else if (w2 !== undefined) {
      days = WORD_TO_DAYS[w2] ?? (parseInt(w2, 10) || 3);
    } else if (w1 !== undefined) {
      days = WORD_TO_DAYS[w1] ?? 3;
    } else if (d1 !== undefined) {
      days = d1;
    }

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
        rawText: colloquialDaysMatch[0],
      };
      workingQuery = workingQuery.replace(colloquialDaysMatch[0], " ");
    }
  }

  // Check days (e.g. "last 15 days", "within 30 days", "past 10 days")
  const explicitDaysMatch = !colloquialDaysMatch && (
    workingQuery.match(/\b(?:posted\s+)?(?:in\s+the\s+|within\s+the\s+|over\s+the\s+|in\s+|within\s+|past\s+|last\s+)?(\d{1,3})\s*(?:days?|d)\b/i) ||
    workingQuery.match(/\b(\d{1,3})\s*(?:days?|d)\s*ago\b/i) ||
    workingQuery.match(/\bposted\s+(?:within|in|last|past)\s+(\d{1,3})\s*(?:days?|d)\b/i)
  );

  if (!explicitMonthsMatch && !colloquialDaysMatch && explicitDaysMatch && explicitDaysMatch[1]) {
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
  const isFellowshipMentioned = /\b(fellowship|fellowships|fellow|fellows)\b/i.test(lower);
  const isContractMentioned = /\b(contract|contracts|contractor|freelance|freelancer|gigs?)\b/i.test(lower);
  const isPartTimeMentioned = /\b(part-time|part time)\b/i.test(lower);
  const isFullTimeMentioned = /\b(full-time|full time)\b/i.test(lower);
  const isEntryLevelMentioned = /\b(entry-level|entry level|entry|junior|jr|fresh|freshers?|graduates?|grads?|associate|new grad)\b/i.test(lower);
  const isSeniorMentioned = /\b(senior|sr|lead|principal|staff|director|architect|vp|mid-level|experienced)\b/i.test(lower);

  const matchedOppTypes: string[] = [];
  const matchedExpLevels: string[] = [];

  if (isFellowshipMentioned) {
    matchedOppTypes.push("FELLOWSHIP");
  }
  if (isContractMentioned) {
    matchedOppTypes.push("CONTRACT");
  }
  if (isInternshipMentioned) {
    matchedOppTypes.push("INTERNSHIP");
  }
  if (isPartTimeMentioned) {
    matchedOppTypes.push("PART_TIME");
  }
  if (isFullTimeMentioned || matchedOppTypes.length === 0 || (isInternshipMentioned && isEntryLevelMentioned)) {
    matchedOppTypes.push("FULL_TIME");
  }

  if (isInternshipMentioned && isEntryLevelMentioned) {
    matchedExpLevels.push("INTERN", "ENTRY_LEVEL");
  } else if (isInternshipMentioned) {
    matchedExpLevels.push("INTERN");
  } else if (isEntryLevelMentioned) {
    matchedExpLevels.push("ENTRY_LEVEL");
  } else if (isSeniorMentioned) {
    matchedExpLevels.push("MID", "SENIOR");
  } else {
    matchedExpLevels.push("ANY");
  }

  const primaryOpportunityType = isFellowshipMentioned
    ? "FELLOWSHIP"
    : isContractMentioned
    ? "CONTRACT"
    : isInternshipMentioned
    ? "INTERNSHIP"
    : isPartTimeMentioned
    ? "PART_TIME"
    : (matchedOppTypes[0] || "FULL_TIME");
  const primaryExperienceLevel = isInternshipMentioned ? "INTERN" : isEntryLevelMentioned ? "ENTRY_LEVEL" : isSeniorMentioned ? "SENIOR" : "ANY";

  // Target Graduation Year
  let targetGradYear: number | undefined;
  const gradMatch = lower.match(/\b(202[4-9]|203[0-5])\b/);
  if (gradMatch) {
    targetGradYear = parseInt(gradMatch[1], 10);
  }

  // Company Type (Startup vs Enterprise)
  let companyType: SearchIntent["companyType"] = "ANY";
  if (hasStartupFundingPhrase || /\b(startup|startups|early stage|yc startup|seed|series a|series b)\b/i.test(cleanQuery)) {
    companyType = "STARTUP";
  } else if (/\b(enterprise|enterprises|faang|big tech|fortune 500|corp|mnc)\b/i.test(cleanQuery)) {
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
    // Strip temporal phrases starting with in/within/past/last so "in last 3 days" is never misidentified as a location
    const temporalCleaned = workingQuery
      .replace(/\b(?:in|at|within|past|last|for)\s+(?:the\s+)?(?:last\s+|past\s+)?(?:\d{1,2}\s+)?(?:days?|hours?|hrs?|d|h|weeks?|w|months?|mo|few\s+days|today|yesterday)\b/gi, " ")
      .replace(/\b(?:in|within)\s+(?:recent|new|latest)\b/gi, " ")
      .replace(/\b(?:on|across)\s+(?:any|all|every|multiple)?\s*(?:platforms?|job\s*boards?|sites?|portals?|web)\b/gi, " ")
      .replace(/\b(?:paying|paid|salary|salaries|compensation|comp|stipend|package)\s+(?:in|of|around|at)\s+[A-Za-z0-9$€£₹]+\b/gi, " ")
      .replace(/\b(?:in|of)\s+(?:usd|eur|gbp|inr|cad|aud|dollars?|euros?|pounds?|rupees?|lpa|ctc)\b/gi, " ");

    const locMatch = temporalCleaned.match(
      /\b(?:in|at|near|around)\s+([A-Za-z\s,.-]+?)(?=\s+(?:jobs?|roles?|positions?|openings?|internships?|remote|hybrid|last|past|within|companies?|startups?|accelerators?|enterprises?|firms?|studios?|with|using|having|where|posted)|$)/i
    );
    if (locMatch && locMatch[1]) {
      let candLoc = locMatch[1].trim();
      candLoc = candLoc.replace(/[.,;]+$/g, "").trim();
      candLoc = candLoc.replace(/\s+(that\s*(?:were|are|was)|posted|funded\s*by|within|more\s*than|last|past|on\s+any|across).*$/i, "").trim();
      candLoc = candLoc.replace(/^[.,;]+|[.,;]+$/g, "").trim();

      const isWorldwideOrAnywhere =
        /^(the\s+)?(world|globe|nation|country|market|industry)$/i.test(candLoc) ||
        /^(anywhere|worldwide|global|globally|abroad)$/i.test(candLoc);

      if (isWorldwideOrAnywhere && !matchedModes.includes("REMOTE")) {
        matchedModes.push("REMOTE");
      }

      const isCurrency =
        KNOWN_CURRENCY_CODES.has(candLoc.toLowerCase()) ||
        /^(usd|eur|gbp|inr|cad|aud|dollars?|euros?|pounds?|rupees?|lpa|ctc|cash|equity|hourly|stipend)$/i.test(candLoc);

      const isRoleOrCompanyDescriptor =
        /\b(news\s*outlets?|mid-sized|non-profit|ngos?|universities|law\s*firms?|startups?|companies?|firms?|management|engineering|policy|scien(?:ce|tist)s?|research|fellowships?|developer|engineer|analyst|specialist|designer|manager|programmer|architect)\b/i.test(candLoc) ||
        KNOWN_ROLE_DEFINITIONS.some((r) => r.regex.test(candLoc));

      const isPlatformDescriptor =
        /\b(platforms?|job\s*boards?|sites?|websites?|portals?|web|internet)\b/i.test(candLoc);

      const isBlacklisted =
        isCurrency ||
        isRoleOrCompanyDescriptor ||
        isPlatformDescriptor ||
        isWorldwideOrAnywhere ||
        /^(the|a|an|any|all|some|good|latest|recent|new|urgent|verified|mechanical|software|civil|electrical|chemical|process|nurse|financial|marketing|data|frontend|backend|fullstack|engineering|developer|intern|internship|entry|senior|junior|y\s*combinator|yc|techstars|startups?|companies?|firms?|enterprises?|faang|big\s*tech|fortune\s*500)$/i.test(candLoc) ||
        /\b(scien(?:tist|ce)|engineer(?:ing)?|developer|analyst|designer|architect|programmer|coder|specialist|manager|officer|lead|executive|consultant|worker|employee)\b/i.test(candLoc) ||
        /\b(with|using|having|where|startup|startups|company|companies|accelerator|accelerators|y\s*combinator|yc|on\s+any|any\s+platform)\b/i.test(candLoc) ||
        KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(candLoc)) ||
        KNOWN_COMPANY_DEFINITIONS.some((c) => c.regex.test(candLoc)) ||
        candLoc.length > 40 ||
        candLoc.length <= 2;

      if (candLoc.length >= 3 && !isBlacklisted) {
        const canonicalLoc = candLoc.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        matchedLocations.push(canonicalLoc);
        workingQuery = workingQuery.replace(locMatch[0], " ");
      }
    }
  }

  const hasExplicitLocation = Boolean(
    (filterOverrides?.location && filterOverrides.location !== "Any" && filterOverrides.location.toLowerCase() !== "worldwide") ||
    (filterOverrides?.locations && filterOverrides.locations.length > 0) ||
    matchedLocations.length > 0
  );
  const primaryLocation = (hasExplicitLocation && matchedLocations.length > 0)
    ? matchedLocations[0]
    : (filterOverrides?.location && filterOverrides.location !== "Any" ? filterOverrides.location : undefined);

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
  let specificExtractedRole: string | undefined = undefined;

  // 9a. Explicit Targeted Role Extraction from Contextual Clauses
  // Handles phrases like: "jobs on <ROLE>", "jobs for <ROLE>", "positions in <ROLE>", "roles for <ROLE>"
  const explicitRoleClauseMatch = workingQuery.match(
    /\b(?:jobs?|roles?|positions?|openings?|internships?|opportunities)\s+(?:on|for|in|as|targeting|about)\s+([A-Za-z0-9\s/&+-]+?)(?=\s+(?:in|at|near|around|within|posted|last|past|with|salary|compensation|$))/i
  );
  if (explicitRoleClauseMatch && explicitRoleClauseMatch[1]) {
    const rawCand = explicitRoleClauseMatch[1].trim();
    const isCohortOrGrad =
      /\b(202[0-9]|203[0-9])\s*(?:graduates?|grads?|students?|cohort|batch|passouts?)\b/i.test(rawCand) ||
      /^(?:graduates?|grads?|students?|freshers?|interns?|anybody|everyone)$/i.test(rawCand);
    const isExperienceClause =
      /^(?:entry\s*level|junior|senior|interns?|internships?|freshers?|experienced|mid-level)(?:\s+(?:or|and)\s+(?:entry\s*level|junior|senior|interns?|internships?|freshers?|experienced|mid-level))?$/i.test(rawCand) ||
      /\b(or|and|as|for|in|with)$/i.test(rawCand);
    const isLocationOrModifier =
      /\b(rural\s*areas?|urban\s*areas?|metro\s*areas?|remote|hybrid|on-site|posted|recent|abroad|worldwide|europe|africa|asia|america|startups?|companies?)\b/i.test(rawCand) ||
      KNOWN_LOCATION_DEFINITIONS.some((l) => l.regex.test(rawCand));
    if (
      rawCand.length >= 3 &&
      !isCohortOrGrad &&
      !isExperienceClause &&
      !isLocationOrModifier &&
      !/^(the|a|an|any|all|some|good|latest|recent|new|urgent|verified|fresh|remote|hybrid|posted|the\s+memory|memory|saved\s+role|my\s+saved\s+role|memory\s+vault|profile)$/i.test(rawCand)
    ) {
      const matchedKnownDef = KNOWN_ROLE_DEFINITIONS.find((def) => def.regex.test(rawCand));
      if (matchedKnownDef) {
        specificExtractedRole = matchedKnownDef.canonicalName;
      } else {
        let normRole = rawCand;
        if (/engineering$/i.test(normRole)) {
          normRole = normRole.replace(/engineering$/i, "Engineer");
        }
        specificExtractedRole = normRole
          .split(/\s+/)
          .map((w) => {
            const lowerW = w.toLowerCase();
            if (["ai", "ml", "qa", "ui", "ux", "llm", "nlp", "sre", "swe", "sde", "ats", "devops"].includes(lowerW)) {
              return lowerW.toUpperCase();
            }
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
          })
          .join(" ");
      }
    }
  }

  // 9b. Match against Known Role Definitions
  for (const roleDef of KNOWN_ROLE_DEFINITIONS) {
    if (roleDef.regex.test(lower)) {
      const roleName = roleDef.canonicalName;
      if (!matchedRoles.includes(roleName)) {
        matchedRoles.push(roleName);
      }
      if (isInternshipMentioned) {
        const internVariant = roleName.endsWith("Engineer")
          ? roleName.replace(/Engineer$/, "Intern")
          : `${roleName} Intern`;
        if (!matchedRoles.includes(internVariant)) {
          matchedRoles.push(internVariant);
        }
      }
      for (const rel of roleDef.related) {
        if (!matchedRoles.includes(rel)) {
          matchedRoles.push(rel);
        }
      }
    }
  }

  // 9c. Dynamic Arbitrary Role Extraction from shielded workingQuery (only if no role identified yet)
  if (!specificExtractedRole && matchedRoles.length === 0) {
    const cleanRemainder = workingQuery
      .replace(/\b(search|find|give\s+me|show\s+me|get\s+me|find\s+me|tell\s+me|me|us|i\s*am\s*an?|i\s*am\s*a|i\s*am|i'?m\s*an?|i'?m\s*a|i'?m|am\s*an?|am\s*a|am|my|we|looking\s+for|look\s+for|i\s*m\s+looking\s+for|some|any|all|verified|positions?|jobs?|roles?|openings?|internships?|opportunities|listings?|extract|with|and|or|visual|snapshots?|page|direct|application|links?|core|technical|qualifications?|salary|compensation|locations?|company|names?|titles?|for|\d+)\b/gi, " ")
      .replace(/\b(need|want|know|what|which|who|where|when|why|how|companies|company|are|is|were|was|be|been|being|working|works|work|hiring|hires|hire|right\s+now|right|now|currently|presently|available|urgent|urgently|active|actively)\b/gi, " ")
      .replace(/\b(paying|paid|salary|salaries|compensation|comp|stipend|package|usd|eur|gbp|inr|dollars?|euros?|rupees?|lpa|ctc)\b/gi, " ")
      .replace(/\b(in|at|around|near|on|from|to|into|across|an?|the|posted|budget|percent|percentage|tokens?|usage|credits?|days?|weeks?|months?|hours?|ago|recently|recent|latest|new|fresh)\b/gi, " ")
      .replace(/[.,?;:!]/g, " ")
      .replace(/\b(more\s+than|less\s+than|funded\s+by|no\s+preference|no\s+location\s+preference|no\s+specific\s+location|at\s+law\s+firms?|at\s+universities|at\s+major\s+news\s+outlets|at\s+startups?|at\s+mid-sized\s+companies|funded\s+by\s+ngos?|this|that|which|there|are|any|next\s+year|last|past|within|abroad|worldwide|globally|around\s+the\s+world|anywhere)\b/gi, " ")
      .replace(/[%$#@!*&^~]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (cleanRemainder.length >= 3 && !/^(the|any|all|some|good|top|best|entry\s*level|junior|senior|posted|recent)$/i.test(cleanRemainder)) {
      let normRemainder = cleanRemainder;
      if (/engineering$/i.test(normRemainder)) {
        normRemainder = normRemainder.replace(/engineering$/i, "Engineer");
      }
      specificExtractedRole = normRemainder
        .split(/\s+/)
        .map((w) => {
          const lowerW = w.toLowerCase();
          if (["ai", "ml", "qa", "ui", "ux", "llm", "nlp", "sre", "swe", "sde", "ats", "devops"].includes(lowerW)) {
            return lowerW.toUpperCase();
          }
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(" ");
    }
  }

  // If a specific multi-token or specialized role was explicitly extracted, prioritize it at the top
  if (specificExtractedRole) {
    // Remove if already in list to avoid duplicates
    const existingIdx = matchedRoles.findIndex((r) => r.toLowerCase() === specificExtractedRole!.toLowerCase());
    if (existingIdx >= 0) {
      matchedRoles.splice(existingIdx, 1);
    }
    matchedRoles.unshift(specificExtractedRole);
  }

  // Only default to Software Engineer if explicit tech keywords were used and no role found
  if (matchedRoles.length === 0 && /\b(tech|technology|developer|coding)\b/i.test(cleanQuery)) {
    matchedRoles.push("Software Engineer");
  }

  const primaryRole = matchedRoles[0] || undefined;

  // 10. Target Companies Extraction
  const matchedCompanies: string[] = [];

  // Helper to check if a name was mentioned in a platform source clause e.g. "search on Y Combinator and GitHub"
  const isPlatformSourceMention = (compName: string) => {
    const esc = compName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b(?:search\\s+)?(?:across|on|in|via)\\s+(?:[a-z0-9\\s,&-]*?)?\\b${esc}\\b`, "i").test(cleanQuery);
  };

  for (const compDef of KNOWN_COMPANY_DEFINITIONS) {
    if (compDef.regex.test(lower)) {
      if (!matchedCompanies.includes(compDef.canonicalName) && !isPlatformSourceMention(compDef.canonicalName)) {
        matchedCompanies.push(compDef.canonicalName);
      }
    }
  }

  if (matchedCompanies.length === 0) {
    // Strip "companies in/at/near/around <Location>" to prevent "in" from being extracted as a company
    const companyCleaned = cleanQuery.replace(/\bcompanies\s+(?:in|at|around|near)\s+/gi, " ");
    const compMatch = companyCleaned.match(
      /\b(?:from|at|by|company|companies|watch|watching|track|tracking|monitor|monitoring)\s+([A-Za-z0-9&.-]+(?:\s+[A-Za-z0-9&.-]+)?)(?:\s+(?:for|in|roles?|jobs?|internships?|with|where|seeking|and|from|posted|last|past|within|today|yesterday|this)|$)/i
    );
    if (compMatch && compMatch[1]) {
      let candidateComp = compMatch[1].trim();
      candidateComp = candidateComp.replace(/[.,;]+$/g, "").trim();
      const isStopWord = /^(in|at|on|for|from|with|by|to|into|across|an?|the|and|or|of|is|are|were|was|be|that|which|what|who|where|working|hiring|urgent|now|right|usd|eur|gbp|inr)$/i.test(candidateComp);
      const isGenericCategory =
        /\b(startups?|law\s*firms?|universit(?:y|ies)|news\s*outlets?|ngos?|non-profits?|foundations?|institutes?|schools?|colleges?|agencies?|studios?|consultanc(?:y|ies)|companies?|enterprises?)\b/i.test(candidateComp);
      const isGeneric =
        isStopWord ||
        isGenericCategory ||
        /^(the|any|all|remote|hybrid|on-site|an?|india|hyderabad|bengaluru|pune|mumbai|delhi|tripura|agartala|usa|uk|software|developer|engineer|intern|internship|startups?|enterprises?|faang|big\s*tech|companies?|jobs?|internships?|roles?|positions?|openings?|freshers?|graduates?|students?|\d{4})$/i.test(candidateComp) ||
        /\b(with|using|having|where|for|only)\b/i.test(candidateComp) ||
        KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(candidateComp));
      if (candidateComp.length >= 2 && !isGeneric && !matchedCompanies.includes(candidateComp) && !isPlatformSourceMention(candidateComp)) {
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

  // 12. Final Sources Resolution (TASK-060: Strict User Preference Preservation & Multi-Source Balance)
  // If user requested specific sources, use ONLY those. Otherwise query all configured active harvesters.
  const defaultSources = [
    "LinkedIn",
    "ATS Direct",
    "Greenhouse",
    "Lever",
    "Ashby",
    "Y Combinator",
    "Hacker News",
    "GitHub Curated",
  ];
  const isExplicitOnly = /\b(only on|exclusively on|just on|solely on)\b/i.test(lower);
  let finalSources: string[];
  if (matchedSources.length > 0) {
    if (isExplicitOnly) {
      finalSources = matchedSources;
    } else {
      // Prioritize matched sources at the front, but keep direct ATS harvesters available
      const combined = [...matchedSources];
      for (const ds of defaultSources) {
        if (!combined.includes(ds)) {
          combined.push(ds);
        }
      }
      finalSources = combined;
    }
  } else {
    finalSources = defaultSources;
  }

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

  // Sanitize incoming or matched locations: "Remote" is a work mode, not a geographic location
  const rawLocations = filterOverrides?.locations || (matchedLocations.length > 0 ? matchedLocations : primaryLocation ? [primaryLocation] : []);
  const hasRemoteInLocations = rawLocations.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
  const sanitizedLocations = rawLocations.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
  const sanitizedPrimaryLocation = filterOverrides?.location && !/^(remote|fully\s*remote|remote-first)$/i.test(filterOverrides.location.trim())
    ? filterOverrides.location
    : (sanitizedLocations[0] || undefined);

  const initialWorkModes = filterOverrides?.workModes || (matchedModes.length > 0 ? matchedModes : [primaryWorkMode]);
  const sanitizedWorkModes = [...initialWorkModes];
  if (hasRemoteInLocations && !sanitizedWorkModes.includes("REMOTE")) {
    sanitizedWorkModes.push("REMOTE");
  }
  const sanitizedPrimaryWorkMode = filterOverrides?.workMode || (sanitizedWorkModes[0] || primaryWorkMode);

  // Build canonical SearchIntent
  const intent: SearchIntent = {
    role: filterOverrides?.role || primaryRole,
    roles: filterOverrides?.roles || (matchedRoles.length > 0 ? matchedRoles : primaryRole ? [primaryRole] : []),
    skills: filterOverrides?.skills || (matchedSkills.length > 0 ? matchedSkills : []),
    location: sanitizedPrimaryLocation,
    locations: sanitizedLocations,
    company: filterOverrides?.company || primaryCompany,
    companies: filterOverrides?.companies || (matchedCompanies.length > 0 ? matchedCompanies : primaryCompany ? [primaryCompany] : []),
    workMode: sanitizedPrimaryWorkMode,
    workModes: sanitizedWorkModes,
    experienceLevel: filterOverrides?.experienceLevel || primaryExperienceLevel,
    experienceLevels: filterOverrides?.experienceLevels || (matchedExpLevels.length > 0 ? matchedExpLevels : [primaryExperienceLevel]),
    opportunityType: filterOverrides?.opportunityType || primaryOpportunityType,
    opportunityTypes: filterOverrides?.opportunityTypes || (matchedOppTypes.length > 0 ? matchedOppTypes : [primaryOpportunityType]),
    targetGradYear: filterOverrides?.targetGradYear || targetGradYear,
    companyType: filterOverrides?.companyType || companyType,
    queryHint: cleanQuery || filterOverrides?.queryHint || primaryRole,
    sortMode: filterOverrides?.sortMode || sortMode,
    freshnessWindowHours: filterOverrides?.freshnessWindowHours !== undefined ? filterOverrides.freshnessWindowHours : freshnessWindowHours,
    postedWithinDays: filterOverrides?.postedWithinDays !== undefined ? filterOverrides.postedWithinDays : postedWithinDays,
    dateConstraint: filterOverrides?.dateConstraint !== undefined ? filterOverrides.dateConstraint : dateConstraint,
    requestedCount: requestedCount !== undefined ? requestedCount : (filterOverrides?.requestedCount !== undefined ? filterOverrides.requestedCount : 30),
    isExplicitFreshness: filterOverrides?.isExplicitFreshness !== undefined ? filterOverrides.isExplicitFreshness : isExplicitFreshness,
    isExplicitLocation: filterOverrides?.isExplicitLocation !== undefined ? filterOverrides.isExplicitLocation : hasExplicitLocation,
    minimumMatchScore: filterOverrides?.minimumMatchScore || minimumMatchScore,
    sources: filterOverrides?.sources || finalSources || [],
    excludeKnown: filterOverrides?.excludeKnown !== undefined ? filterOverrides.excludeKnown : excludeKnown,
    watchIntent: filterOverrides?.watchIntent || watchIntent,
    requiresEvidenceVerification: filterOverrides?.requiresEvidenceVerification !== undefined ? filterOverrides.requiresEvidenceVerification : requiresEvidenceVerification,
    requestedEvidence: filterOverrides?.requestedEvidence || (requestedEvidence.length > 0 ? requestedEvidence : []),
  };

  return intent;
}

export interface IntentParseAsyncOptions {
  userId?: string | null;
  apiKey?: string | null;
  puterToken?: string | null;
  provider?: string | null;
  filterOverrides?: Partial<SearchIntent>;
  signal?: AbortSignal;
}

/**
 * LLM-Backed Search Intent Parser with deterministic offline fallback.
 * Uses user's configured AI provider (Gemini BYOK, Puter, or server fallback).
 * If no AI provider is configured or an error occurs, falls back to parseSearchIntent().
 */
export async function parseSearchIntentAsync(
  rawQuery: string,
  options?: IntentParseAsyncOptions
): Promise<SearchIntent> {
  const query = (rawQuery || "").trim();
  if (!query) {
    return parseSearchIntent(query, options?.filterOverrides);
  }

  // 1. Resolve Provider Credentials
  let effectiveGeminiKey: string | null = null;
  let effectivePuterToken: string | null = null;
  let resolvedProvider: "GEMINI" | "PUTER" | "DETERMINISTIC" = "DETERMINISTIC";

  let userProfileMemories: {
    preferredRoles: string[];
    preferredLocations: string[];
    preferredWorkModes: string[];
    targetSkills: string[];
    experienceLevel?: string;
  } | null = null;

  if (options?.apiKey && options.apiKey.trim()) {
    effectiveGeminiKey = options.apiKey.trim();
    resolvedProvider = "GEMINI";
  } else if (options?.puterToken && options.puterToken.trim()) {
    effectivePuterToken = options.puterToken.trim();
    resolvedProvider = "PUTER";
  }

  if (options?.userId && typeof window === "undefined") {
    try {
      const { getUserGeminiApiKey } = await import("@/lib/db/users");
      const { getUserPuterToken } = await import("@/lib/ai/governance/providerGovernance");
      const { getUserProfile } = await import("@/lib/db/onboarding");

      if (!effectiveGeminiKey && !effectivePuterToken) {
        const userKey = await getUserGeminiApiKey(options.userId);
        if (userKey) {
          effectiveGeminiKey = userKey;
          resolvedProvider = "GEMINI";
        } else {
          const pTok = await getUserPuterToken(options.userId);
          if (pTok) {
            effectivePuterToken = pTok;
            resolvedProvider = "PUTER";
          }
        }
      }

      const profile = await getUserProfile(options.userId);
      if (profile) {
        userProfileMemories = {
          preferredRoles: profile.preferredRoles || [],
          preferredLocations: profile.preferredLocations || [],
          preferredWorkModes: profile.preferredWorkModes || [],
          targetSkills: profile.targetSkills || [],
          experienceLevel: profile.experienceLevel || undefined,
        };
      }
    } catch (err) {
      console.warn("[IntentParser] Error resolving user credentials or memory profile:", err);
    }
  }

  // Check server environment fallback for Gemini (strictly only in dev or when explicitly permitted)
  let isPlatformFallback = false;
  if (!effectiveGeminiKey && !effectivePuterToken) {
    const allowPlatform = (options as any)?.allowPlatformFallback ?? (process.env.NODE_ENV === "development");
    if (allowPlatform) {
      const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (envKey && envKey.trim() && envKey.trim() !== "your-gemini-api-key") {
        effectiveGeminiKey = envKey.trim();
        resolvedProvider = "GEMINI";
        isPlatformFallback = true;
      }
    }
  }

  // Build user memory context snippet if available
  let memoryContextString = "";
  if (userProfileMemories) {
    const lines: string[] = [];
    if (userProfileMemories.preferredRoles.length > 0) lines.push(`Saved Target Roles in Memory: ${userProfileMemories.preferredRoles.join(", ")}`);
    if (userProfileMemories.preferredLocations.length > 0) lines.push(`Saved Locations in Memory: ${userProfileMemories.preferredLocations.join(", ")}`);
    if (userProfileMemories.targetSkills.length > 0) lines.push(`Saved Skills in Memory: ${userProfileMemories.targetSkills.join(", ")}`);
    if (userProfileMemories.preferredWorkModes.length > 0) lines.push(`Saved Work Modes: ${userProfileMemories.preferredWorkModes.join(", ")}`);
    if (userProfileMemories.experienceLevel) lines.push(`Saved Experience Level: ${userProfileMemories.experienceLevel}`);
    if (lines.length > 0) {
      memoryContextString = `\nUser Memory Vault Preferences:\n${lines.join("\n")}\n`;
    }
  }

  const { sanitizeSearchTelemetry } = await import("@/lib/ai/errors/searchFailureModel");
  const sanitizedQuery = sanitizeSearchTelemetry(query);
  const sanitizedMemory = sanitizeSearchTelemetry(memoryContextString);

  // If no AI provider is available, use deterministic fallback
  if (resolvedProvider === "DETERMINISTIC" || (!effectiveGeminiKey && !effectivePuterToken)) {
    const deterministicBase = parseSearchIntent(rawQuery, options?.filterOverrides);
    if (userProfileMemories) {
      if ((!deterministicBase.role || /^(the\s+)?(memory|saved\s+role|memory\s+vault)$/i.test(deterministicBase.role)) && userProfileMemories.preferredRoles?.length) {
        deterministicBase.role = userProfileMemories.preferredRoles[0];
        deterministicBase.roles = [...userProfileMemories.preferredRoles];
      }
      if (!deterministicBase.location && userProfileMemories.preferredLocations?.length) {
        deterministicBase.location = userProfileMemories.preferredLocations[0];
        deterministicBase.locations = [...userProfileMemories.preferredLocations];
      }
      if ((!deterministicBase.workMode || deterministicBase.workMode === "ANY") && userProfileMemories.preferredWorkModes?.length) {
        deterministicBase.workMode = userProfileMemories.preferredWorkModes[0];
        deterministicBase.workModes = [...userProfileMemories.preferredWorkModes];
      }
      if (userProfileMemories.targetSkills?.length) {
        const sSet = new Set(deterministicBase.skills || []);
        for (const s of userProfileMemories.targetSkills) {
          if (sSet.size >= 6) break;
          sSet.add(s);
        }
        deterministicBase.skills = Array.from(sSet);
      }
      if ((!deterministicBase.experienceLevel || deterministicBase.experienceLevel === "ANY") && userProfileMemories.experienceLevel) {
        deterministicBase.experienceLevel = userProfileMemories.experienceLevel;
      }
    }
    return deterministicBase;
  }

  // 2. Execute via Gemini
  if (resolvedProvider === "GEMINI" && effectiveGeminiKey) {
    let modelName: string = "gemini-2.5-flash";
    try {
      const { Type } = await import("@google/genai");
      const { createGeminiClient, detectOptimalGeminiModel, DEFAULT_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, SECONDARY_FALLBACK_GEMINI_MODEL } = await import("@/lib/ai/modelSelector");

      const ai = createGeminiClient(effectiveGeminiKey);
      modelName = await detectOptimalGeminiModel(effectiveGeminiKey).catch(() => DEFAULT_GEMINI_MODEL);

      const sanitizedOverrides = sanitizeSearchTelemetry(options?.filterOverrides || {});
      const prompt = `User search query: "${sanitizedQuery}"${sanitizedMemory}\nExisting filter overrides: ${JSON.stringify(sanitizedOverrides)}`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING, description: "Primary standardized role or job title extracted holistically (e.g. 'Management', 'AI Intern', 'Full Stack Engineer')" },
          roles: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Related or alternative role titles" },
          skills: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Technical or domain skills mentioned" },
          location: { type: Type.STRING, description: "Target location, city, state, or country" },
          locations: { type: Type.ARRAY, items: { type: Type.STRING } },
          company: { type: Type.STRING, description: "Target employer or company if specified" },
          companies: { type: Type.ARRAY, items: { type: Type.STRING } },
          workMode: { type: Type.STRING, enum: ["REMOTE", "HYBRID", "ON_SITE", "ANY"] },
          experienceLevel: { type: Type.STRING, enum: ["INTERN", "ENTRY_LEVEL", "MID", "SENIOR", "ANY"] },
          opportunityType: { type: Type.STRING, enum: ["INTERNSHIP", "FULL_TIME", "CONTRACT", "ANY"] },
          companyType: { type: Type.STRING, enum: ["STARTUP", "ENTERPRISE", "ANY"] },
          requestedCount: { type: Type.INTEGER, description: "Requested number of results, default 10" },
          freshnessWindowHours: { type: Type.INTEGER, description: "Freshness window in hours, e.g. 168 for past week" },
          postedWithinDays: { type: Type.INTEGER, description: "Days filter, e.g. 7" },
          sortMode: { type: Type.STRING, enum: ["RELEVANCE", "LATEST", "RELEVANCE_THEN_FRESHNESS"] },
        },
        required: ["role", "roles", "skills", "workMode", "experienceLevel", "opportunityType"],
      };

      const systemInstruction = `You are the Search Intent Understanding subsystem of BrowserPilot.
Analyze natural language job and opportunity search queries and produce a structured JSON SearchIntent.
Rules:
- Strip conversational filler words completely ("find me jobs for Management" -> role: "Management", NOT "Me Management").
- NEVER extract meta-storage or vault phrases ("the memory", "memory", "saved role", "my saved role", "memory vault", "profile") as a job role title.
- If the user query refers to "my saved role", "saved role", or "on the memory", resolve it to the user's Saved Target Roles from their User Memory Vault Preferences (e.g. if Saved Target Roles has "Software Developer", output role: "Software Developer").
- Understand role and level phrases holistically ("AI intern" -> role: "AI Intern", experienceLevel: "INTERN", opportunityType: "INTERNSHIP").
- Extract technical and domain skills into the skills array.
- Identify work modes: REMOTE, HYBRID, ON_SITE, or ANY.
- Extract target location, city, state, or country (e.g. "in hyderabad" -> location: "Hyderabad").
- Identify requested result counts (default 10).
- If days/freshness is specified (e.g. "in last 4 days"), set postedWithinDays: 4, freshnessWindowHours: 96, sortMode: "LATEST".`;

      let response;
      let effectiveModelUsed = modelName || DEFAULT_GEMINI_MODEL;
      try {
        response = await ai.models.generateContent({
          model: effectiveModelUsed,
          contents: prompt,
          config: {
            systemInstruction,
            temperature: 0.1,
            responseMimeType: "application/json",
            responseSchema: schema,
          },
        });
      } catch (err) {
        console.warn(`[IntentParser] Primary model ${effectiveModelUsed} failed, trying fallback ${FALLBACK_GEMINI_MODEL}:`, err);
        effectiveModelUsed = FALLBACK_GEMINI_MODEL;
        try {
          response = await ai.models.generateContent({
            model: FALLBACK_GEMINI_MODEL,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          });
        } catch (fbErr) {
          console.warn(`[IntentParser] Fallback ${FALLBACK_GEMINI_MODEL} failed, trying secondary fallback ${SECONDARY_FALLBACK_GEMINI_MODEL}:`, fbErr);
          effectiveModelUsed = SECONDARY_FALLBACK_GEMINI_MODEL;
          response = await ai.models.generateContent({
            model: SECONDARY_FALLBACK_GEMINI_MODEL,
            contents: prompt,
            config: {
              systemInstruction,
              temperature: 0.1,
              responseMimeType: "application/json",
              responseSchema: schema,
            },
          });
        }
      }

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text);
        const baseIntent = parseSearchIntent(rawQuery, options?.filterOverrides);

        // Record AI Usage Event if user ID is present, running in Node, and not platform fallback
        if (options?.userId && typeof window === "undefined" && !isPlatformFallback) {
          try {
            const { recordAIUsageEvent } = await import("@/lib/ai/governance/providerGovernance");
            const totalTokens = response.usageMetadata?.totalTokenCount || 0;
            await recordAIUsageEvent({
              userId: options.userId,
              provider: "GEMINI_BYOK",
              model: effectiveModelUsed,
              operation: "INTENT_PARSING",
              inputTokens: response.usageMetadata?.promptTokenCount || 0,
              outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
              totalTokens,
              status: "SUCCESS",
            });
          } catch (recErr) {
            console.warn("[IntentParser] Failed to record AI usage event:", recErr);
          }
        }

        const isMetaRole = (r?: string) => {
          if (!r) return false;
          return /^(the\s+)?(memory|memory\s+vault|saved\s+role|my\s+saved\s+role|profile)$/i.test(r.trim());
        };

        let resolvedRole = parsed.role?.trim() || "";
        if (isMetaRole(resolvedRole) || !resolvedRole) {
          if (userProfileMemories?.preferredRoles?.length) {
            resolvedRole = userProfileMemories.preferredRoles[0];
          } else {
            resolvedRole = isMetaRole(baseIntent.role) ? "" : (baseIntent.role || "");
          }
        }

        let resolvedRoles = Array.isArray(parsed.roles) ? parsed.roles.filter((r: string) => !isMetaRole(r)) : [];
        if (baseIntent.roles && baseIntent.roles.length > 0) {
          const filteredBase = baseIntent.roles.filter((r) => !isMetaRole(r));
          resolvedRoles = Array.from(new Set([...resolvedRoles, ...filteredBase]));
        }
        if (resolvedRoles.length === 0 && userProfileMemories?.preferredRoles?.length) {
          resolvedRoles = [...userProfileMemories.preferredRoles];
        }
        if (resolvedRole && !resolvedRoles.includes(resolvedRole)) {
          resolvedRoles.unshift(resolvedRole);
        }

        const isInvalidLocation = (loc?: string) => {
          if (!loc) return true;
          const trimmed = loc.trim();
          return /^(the|a|an|any|all|some|good|latest|recent|new|urgent|verified|y\s*combinator|yc|techstars|startups?|companies?|firms?|enterprises?)$/i.test(trimmed) ||
            /\b(with|using|having|where)\b/i.test(trimmed) ||
            KNOWN_CURRENCY_CODES.has(trimmed.toLowerCase()) ||
            /^(usd|eur|gbp|inr|cad|aud|dollars?|euros?|pounds?|rupees?|lpa|ctc|cash|equity|hourly|stipend)$/i.test(trimmed) ||
            KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(trimmed)) ||
            KNOWN_COMPANY_DEFINITIONS.some((c) => c.regex.test(trimmed));
        };

        const isInvalidCompany = (comp?: string) => {
          if (!comp) return true;
          const trimmed = comp.trim();
          return /^(the|any|all|remote|hybrid|on-site|an?|software|developer|engineer|startups?|companies?|in|at|on|for|from|with|by|to|into|across|and|or|of|is|are|were|was|be|that|which|what|who|where|working|hiring|urgent|now|right|usd|eur|gbp|inr)$/i.test(trimmed) ||
            /\b(with|using|having|where)\b/i.test(trimmed) ||
            KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(trimmed));
        };

        let resolvedLocation = parsed.location || (!isInvalidLocation(baseIntent.location) ? baseIntent.location : undefined);
        let resolvedLocations = parsed.locations && parsed.locations.length > 0
          ? parsed.locations
          : (baseIntent.locations ? baseIntent.locations.filter((l) => !isInvalidLocation(l)) : undefined);

        if (!resolvedLocation && userProfileMemories?.preferredLocations?.length && /\b(?:my\s+)?(?:saved\s+location|memory|profile)\b/i.test(query)) {
          resolvedLocation = userProfileMemories.preferredLocations[0];
          resolvedLocations = [...userProfileMemories.preferredLocations];
        }

        const resolvedCompany = parsed.company || (!isInvalidCompany(baseIntent.company) ? baseIntent.company : undefined);
        const resolvedCompanies = parsed.companies && parsed.companies.length > 0
          ? parsed.companies
          : (baseIntent.companies ? baseIntent.companies.filter((c) => !isInvalidCompany(c)) : undefined);

        return {
          ...baseIntent,
          role: resolvedRole,
          roles: resolvedRoles,
          skills: parsed.skills && parsed.skills.length > 0 ? parsed.skills : baseIntent.skills,
          location: resolvedLocation,
          locations: resolvedLocations,
          company: resolvedCompany,
          companies: resolvedCompanies,
          workMode: parsed.workMode || baseIntent.workMode,
          experienceLevel: parsed.experienceLevel || baseIntent.experienceLevel,
          opportunityType: parsed.opportunityType || baseIntent.opportunityType,
          companyType: parsed.companyType || baseIntent.companyType,
          requestedCount: typeof parsed.requestedCount === "number" ? parsed.requestedCount : baseIntent.requestedCount,
          freshnessWindowHours: typeof parsed.freshnessWindowHours === "number" ? parsed.freshnessWindowHours : baseIntent.freshnessWindowHours,
          postedWithinDays: typeof parsed.postedWithinDays === "number" ? parsed.postedWithinDays : baseIntent.postedWithinDays,
          sortMode: parsed.sortMode || baseIntent.sortMode,
          ...options?.filterOverrides,
        };
      }
    } catch (llmErr: any) {
      console.warn("[IntentParser] Gemini LLM parsing error, falling back to deterministic parser:", llmErr);
      if (options?.userId && typeof window === "undefined" && !isPlatformFallback) {
        try {
          const { recordAIUsageEvent } = await import("@/lib/ai/governance/providerGovernance");
          const isQuota = llmErr?.message?.includes("quota") || llmErr?.status === 429;
          const status = isQuota ? "RATE_LIMITED" : "FAILED";
          await recordAIUsageEvent({
            userId: options.userId,
            provider: "GEMINI_BYOK",
            model: modelName || "gemini-2.0-flash",
            operation: "INTENT_PARSING",
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            status,
            errorMessage: String(llmErr?.message || llmErr).slice(0, 500),
          });
        } catch (recErr) {
          console.warn("[IntentParser] Failed to record AI usage failure:", recErr);
        }
      }
    }
  }

  // 3. Execute via Puter
  if (resolvedProvider === "PUTER" && effectivePuterToken) {
    try {
      const { callPuterChatCompletion } = await import("@/lib/ai/puterClient");
      const puterRes = await callPuterChatCompletion({
        token: effectivePuterToken,
        userId: options?.userId || undefined,
        operation: "INTENT_PARSING",
        messages: [
          {
            role: "system",
            content: `You are the Search Intent Understanding subsystem of BrowserPilot. Output strictly valid JSON matching this schema:
{"role": string, "roles": string[], "skills": string[], "location": string, "locations": string[], "company": string, "companies": string[], "workMode": "REMOTE"|"HYBRID"|"ON_SITE"|"ANY", "experienceLevel": "INTERN"|"ENTRY_LEVEL"|"MID"|"SENIOR"|"ANY", "opportunityType": "INTERNSHIP"|"FULL_TIME"|"CONTRACT"|"ANY", "requestedCount": number, "freshnessWindowHours": number, "postedWithinDays": number, "sortMode": "RELEVANCE"|"LATEST"|"RELEVANCE_THEN_FRESHNESS"}.
Strip filler words completely ("find me jobs for Management" -> role: "Management").
NEVER extract meta-words ("the memory", "memory", "saved role", "my saved role", "memory vault", "profile") as a job role title. If the user query refers to "my saved role" or "saved role on the memory", resolve it to the user's Saved Target Roles from their User Memory Vault Preferences.
"AI intern" -> role: "AI Intern", experienceLevel: "INTERN", opportunityType: "INTERNSHIP".
If days/freshness is specified (e.g. "last 4 days"), set postedWithinDays: 4, freshnessWindowHours: 96, sortMode: "LATEST".`,
          },
          { role: "user", content: `Query: "${sanitizedQuery}"${sanitizedMemory}` },
        ],
      });

      const rawContent = puterRes.content;
      const cleanJson = rawContent.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(cleanJson);
      const baseIntent = parseSearchIntent(rawQuery, options?.filterOverrides);

        const isMetaRole = (r?: string) => {
          if (!r) return false;
          return /^(the\s+)?(memory|memory\s+vault|saved\s+role|my\s+saved\s+role|profile)$/i.test(r.trim());
        };

        let resolvedRole = parsed.role?.trim() || "";
        if (isMetaRole(resolvedRole) || !resolvedRole) {
          if (userProfileMemories?.preferredRoles?.length) {
            resolvedRole = userProfileMemories.preferredRoles[0];
          } else {
            resolvedRole = isMetaRole(baseIntent.role) ? "" : (baseIntent.role || "");
          }
        }

        let resolvedRoles = Array.isArray(parsed.roles) ? parsed.roles.filter((r: string) => !isMetaRole(r)) : [];
        if (baseIntent.roles && baseIntent.roles.length > 0) {
          const filteredBase = baseIntent.roles.filter((r) => !isMetaRole(r));
          resolvedRoles = Array.from(new Set([...resolvedRoles, ...filteredBase]));
        }
        if (resolvedRoles.length === 0 && userProfileMemories?.preferredRoles?.length) {
          resolvedRoles = [...userProfileMemories.preferredRoles];
        }
        if (resolvedRole && !resolvedRoles.includes(resolvedRole)) {
          resolvedRoles.unshift(resolvedRole);
        }

        const isInvalidLocation = (loc?: string) => {
          if (!loc) return true;
          const trimmed = loc.trim();
          return /^(the|a|an|any|all|some|good|latest|recent|new|urgent|verified|y\s*combinator|yc|techstars|startups?|companies?|firms?|enterprises?)$/i.test(trimmed) ||
            /\b(with|using|having|where)\b/i.test(trimmed) ||
            KNOWN_CURRENCY_CODES.has(trimmed.toLowerCase()) ||
            /^(usd|eur|gbp|inr|cad|aud|dollars?|euros?|pounds?|rupees?|lpa|ctc|cash|equity|hourly|stipend)$/i.test(trimmed) ||
            KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(trimmed)) ||
            KNOWN_COMPANY_DEFINITIONS.some((c) => c.regex.test(trimmed));
        };

        const isInvalidCompany = (comp?: string) => {
          if (!comp) return true;
          const trimmed = comp.trim();
          return /^(the|any|all|remote|hybrid|on-site|an?|software|developer|engineer|startups?|companies?|in|at|on|for|from|with|by|to|into|across|and|or|of|is|are|were|was|be|that|which|what|who|where|working|hiring|urgent|now|right|usd|eur|gbp|inr)$/i.test(trimmed) ||
            /\b(with|using|having|where)\b/i.test(trimmed) ||
            KNOWN_SKILL_DEFINITIONS.some((s) => s.regex.test(trimmed));
        };

        let resolvedLocation = parsed.location || (!isInvalidLocation(baseIntent.location) ? baseIntent.location : undefined);
        let resolvedLocations = parsed.locations && parsed.locations.length > 0
          ? parsed.locations
          : (baseIntent.locations ? baseIntent.locations.filter((l) => !isInvalidLocation(l)) : undefined);

        if (!resolvedLocation && userProfileMemories?.preferredLocations?.length && /\b(?:my\s+)?(?:saved\s+location|memory|profile)\b/i.test(query)) {
          resolvedLocation = userProfileMemories.preferredLocations[0];
          resolvedLocations = [...userProfileMemories.preferredLocations];
        }

        const resolvedCompany = parsed.company || (!isInvalidCompany(baseIntent.company) ? baseIntent.company : undefined);
        const resolvedCompanies = parsed.companies && parsed.companies.length > 0
          ? parsed.companies
          : (baseIntent.companies ? baseIntent.companies.filter((c) => !isInvalidCompany(c)) : undefined);

        let resolvedSkills = parsed.skills && parsed.skills.length > 0 ? parsed.skills : (baseIntent.skills || []);
        if (userProfileMemories?.targetSkills?.length) {
          const sSet = new Set(resolvedSkills);
          for (const s of userProfileMemories.targetSkills) {
            if (sSet.size >= 6) break;
            sSet.add(s);
          }
          resolvedSkills = Array.from(sSet);
        }

        let resolvedWorkMode = parsed.workMode || baseIntent.workMode;
        if ((!resolvedWorkMode || resolvedWorkMode === "ANY") && userProfileMemories?.preferredWorkModes?.length) {
          resolvedWorkMode = userProfileMemories.preferredWorkModes[0];
        }

        let resolvedExpLevel = parsed.experienceLevel || baseIntent.experienceLevel;
        if ((!resolvedExpLevel || resolvedExpLevel === "ANY") && userProfileMemories?.experienceLevel) {
          resolvedExpLevel = userProfileMemories.experienceLevel;
        }

        return {
          ...baseIntent,
          role: resolvedRole,
          roles: resolvedRoles,
          skills: resolvedSkills.length > 0 ? resolvedSkills : undefined,
          location: resolvedLocation,
          locations: resolvedLocations,
          company: resolvedCompany,
          companies: resolvedCompanies,
          workMode: resolvedWorkMode,
          experienceLevel: resolvedExpLevel,
          opportunityType: parsed.opportunityType || baseIntent.opportunityType,
          companyType: parsed.companyType || baseIntent.companyType,
          requestedCount: typeof parsed.requestedCount === "number" ? parsed.requestedCount : baseIntent.requestedCount,
          freshnessWindowHours: typeof parsed.freshnessWindowHours === "number" ? parsed.freshnessWindowHours : baseIntent.freshnessWindowHours,
          postedWithinDays: typeof parsed.postedWithinDays === "number" ? parsed.postedWithinDays : baseIntent.postedWithinDays,
          sortMode: parsed.sortMode || baseIntent.sortMode,
          ...options?.filterOverrides,
        };
    } catch (puterErr) {
      console.warn("[IntentParser] Puter LLM parsing error, falling back to deterministic parser:", puterErr);
    }
  }

  // Fallback to deterministic regex parser
  const base = parseSearchIntent(rawQuery, options?.filterOverrides);
  if ((!base.role || /^(the\s+)?(memory|saved\s+role|memory\s+vault)$/i.test(base.role)) && userProfileMemories?.preferredRoles?.length) {
    base.role = userProfileMemories.preferredRoles[0];
    base.roles = [...userProfileMemories.preferredRoles];
  }
  return base;
}
