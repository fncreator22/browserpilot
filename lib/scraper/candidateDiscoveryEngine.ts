/**
 * §OPEN-ENDED CANDIDATE DISCOVERY ENGINE (TASK-061)
 * 
 * Replaces hardcoded tech company lists with dynamic, query-tailored discovery
 * of employers, institutions, law firms, hospitals, and career portals.
 * 
 * Architecture:
 * 1. AI Grounded / Synthesized Entity Discovery (Gemini Flash / Puter)
 * 2. Fallback to Deterministic Multi-Domain Knowledge Base when AI is unavailable
 * 3. ATS Signature Detection (Greenhouse, Lever, Ashby, Workday)
 * 4. Dispatch Routing:
 *    - Known ATS -> Instant Direct Harvester
 *    - Custom Portals -> Staged Open-Web Crawling Candidates (Logged for Playwright)
 */

import { type SearchIntent } from "./providers/baseProvider";
import { detectAtsProvider, type KnownAtsProvider } from "@/lib/discovery/company/companyIntelligence";
import {
  createGeminiClient,
  DEFAULT_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  getEffectiveGeminiApiKey,
} from "@/lib/ai/modelSelector";

export interface CandidateDiscoveredTarget {
  name: string;
  careerUrl: string;
  category: "EMPLOYER" | "RESEARCH_INSTITUTE" | "HEALTHCARE" | "LEGAL" | "JOB_BOARD" | "PORTAL" | "GENERAL";
  atsProvider: KnownAtsProvider;
  atsSlug?: string;
  dispatchRoute: "ATS_DIRECT" | "OPEN_WEB";
}

export interface CandidateDiscoveryResult {
  queryOrRole: string;
  targets: CandidateDiscoveredTarget[];
  method: "AI_SEARCH_GROUNDED" | "AI_SYNTHESIS" | "DETERMINISTIC_DOMAIN_HEURISTIC";
  groundingUnavailableReason?: string;
}

export interface CandidateDiscoveryOptions {
  apiKey?: string | null;
  puterToken?: string | null;
  userId?: string | null;
  maxTargets?: number;
  attemptSearchGrounding?: boolean;
}

// Deterministic Domain Taxonomies for 0-LLM token fallback
const DOMAIN_TAXONOMIES: Record<string, Array<{ name: string; url: string; category: CandidateDiscoveredTarget["category"] }>> = {
  cancer: [
    { name: "Memorial Sloan Kettering Cancer Center", url: "https://careers.mskcc.org", category: "RESEARCH_INSTITUTE" },
    { name: "Dana-Farber Cancer Institute", url: "https://careers.dana-farber.org", category: "RESEARCH_INSTITUTE" },
    { name: "Fred Hutchinson Cancer Center", url: "https://www.fredhutch.org/en/careers.html", category: "RESEARCH_INSTITUTE" },
    { name: "MD Anderson Cancer Center", url: "https://www.mdanderson.org/careers.html", category: "RESEARCH_INSTITUTE" },
    { name: "St. Jude Children's Research Hospital", url: "https://www.stjude.org/jobs", category: "RESEARCH_INSTITUTE" },
    { name: "Genentech", url: "https://www.gene.com/careers", category: "EMPLOYER" },
  ],
  legal: [
    { name: "U.S. Department of Justice", url: "https://www.justice.gov/legal-careers", category: "LEGAL" },
    { name: "American Civil Liberties Union (ACLU)", url: "https://www.aclu.org/careers", category: "LEGAL" },
    { name: "Latham & Watkins LLP", url: "https://www.lw.com/careers", category: "LEGAL" },
    { name: "Human Rights Watch", url: "https://www.hrw.org/careers", category: "LEGAL" },
    { name: "Baker McKenzie", url: "https://www.bakermckenzie.com/careers", category: "LEGAL" },
    { name: "The Legal Aid Society", url: "https://legalaidnyc.org/careers", category: "LEGAL" },
  ],
  ai: [
    { name: "Anthropic", url: "https://boards.greenhouse.io/anthropic", category: "EMPLOYER" },
    { name: "Scale AI", url: "https://boards.greenhouse.io/scaleai", category: "EMPLOYER" },
    { name: "Cohere", url: "https://jobs.lever.co/cohere", category: "EMPLOYER" },
    { name: "OpenAI", url: "https://openai.com/careers", category: "EMPLOYER" },
    { name: "DeepMind", url: "https://deepmind.google/about/careers", category: "RESEARCH_INSTITUTE" },
    { name: "Hugging Face", url: "https://apply.workable.com/huggingface", category: "EMPLOYER" },
  ],
  general_tech: [
    { name: "GitLab", url: "https://boards.greenhouse.io/gitlab", category: "EMPLOYER" },
    { name: "Figma", url: "https://boards.greenhouse.io/figma", category: "EMPLOYER" },
    { name: "Stripe", url: "https://boards.greenhouse.io/stripe", category: "EMPLOYER" },
    { name: "Linear", url: "https://jobs.ashbyhq.com/linear", category: "EMPLOYER" },
    { name: "Vercel", url: "https://jobs.ashbyhq.com/vercel", category: "EMPLOYER" },
  ],
};

function matchDomainTaxonomy(roleOrQuery: string): Array<{ name: string; url: string; category: CandidateDiscoveredTarget["category"] }> {
  const lower = roleOrQuery.toLowerCase();
  if (/\b(cancer|oncology|biomed|biology|pathology|genomics|lab tech|clinical research)\b/i.test(lower)) {
    return DOMAIN_TAXONOMIES.cancer;
  }
  if (/\b(legal|law|attorney|paralegal|counsel|internships? in law|litigation)\b/i.test(lower)) {
    return DOMAIN_TAXONOMIES.legal;
  }
  if (/\b(ai|artificial intelligence|machine learning|ml|llm|deep learning|nlp|computer vision)\b/i.test(lower)) {
    return DOMAIN_TAXONOMIES.ai;
  }
  return DOMAIN_TAXONOMIES.general_tech;
}

/**
 * Discover candidate sources dynamically based on search intent.
 */
export async function discoverCandidateTargets(
  intent: SearchIntent,
  options?: CandidateDiscoveryOptions
): Promise<CandidateDiscoveryResult> {
  const queryStr = intent.role || (intent.roles && intent.roles[0]) || "Opportunities";
  const limit = options?.maxTargets || 6;

  // 1. Check for Explicit Targeted Companies in Intent
  const explicitCompanies = [
    ...(intent.companies || []),
    ...(intent.company ? [intent.company] : []),
  ].filter(Boolean);

  if (explicitCompanies.length > 0) {
    const targets: CandidateDiscoveredTarget[] = explicitCompanies.slice(0, limit).map((c) => {
      const slug = c.toLowerCase().replace(/[^a-z0-9]/g, "");
      return {
        name: c,
        careerUrl: `https://job-boards.greenhouse.io/${slug}`,
        category: "EMPLOYER",
        atsProvider: "GREENHOUSE",
        atsSlug: slug,
        dispatchRoute: "ATS_DIRECT",
      };
    });

    return {
      queryOrRole: queryStr,
      targets,
      method: "DETERMINISTIC_DOMAIN_HEURISTIC",
    };
  }

  // 2. Resolve AI Credentials
  let effectiveGeminiKey: string | null = null;
  if (options?.apiKey) {
    effectiveGeminiKey = options.apiKey;
  } else if (options?.userId && typeof window === "undefined") {
    try {
      const { getUserGeminiApiKey } = await import("@/lib/db/users");
      effectiveGeminiKey = await getUserGeminiApiKey(options.userId);
    } catch {
      // ignore
    }
  }

  if (!effectiveGeminiKey) {
    effectiveGeminiKey = getEffectiveGeminiApiKey();
  }

  // 3. AI-Driven Open-Domain Synthesis
  if (effectiveGeminiKey) {
    const ai = createGeminiClient(effectiveGeminiKey);
    let rawOrgs: Array<{ name: string; careerUrl: string; category?: string }> = [];
    let method: CandidateDiscoveryResult["method"] = "AI_SYNTHESIS";
    let groundingUnavailableReason: string | undefined;

    // Check if Search Grounding was requested
    if (options?.attemptSearchGrounding) {
      try {
        const groundRes = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: `Find 5-7 real, current employers, organizations, institutions, or hiring companies for "${queryStr}". Return their official career URLs.`,
          config: {
            tools: [{ googleSearch: {} } as any],
          },
        });
        if (groundRes.text) {
          method = "AI_SEARCH_GROUNDED";
        }
      } catch (err: any) {
        // As documented, free-tier API keys return 429 RESOURCE_EXHAUSTED for googleSearch
        groundingUnavailableReason = err?.message?.includes("quota") || err?.status === 429
          ? "FREE_TIER_SEARCH_GROUNDING_QUOTA_EXHAUSTED"
          : (err?.message || "SEARCH_GROUNDING_UNAVAILABLE");
      }
    }

    // Generate tailored candidate entities via Gemini
    try {
      const prompt = `You are the Open-Domain Employer and Opportunity Source Discovery engine of BrowserPilot.
Given the following user search intent:
Role: "${intent.role || queryStr}"
Experience Level: "${intent.experienceLevel || "ANY"}"
Opportunity Type: "${intent.opportunityType || "ANY"}"
Location: "${intent.location || "ANY"}"

Generate a list of 5-8 REAL, authoritative employers, research centers, organizations, law firms, hospitals, or companies that actively hire for this exact role.
Include their real career site or public job board URLs if known (e.g. greenhouse.io, lever.co, myworkdayjobs.com, or official career domains).

Output strictly a valid JSON array:
[
  {
    "name": "Organization Name",
    "careerUrl": "https://...",
    "category": "EMPLOYER" | "RESEARCH_INSTITUTE" | "HEALTHCARE" | "LEGAL" | "JOB_BOARD" | "PORTAL"
  }
]
Do NOT default to tech startups unless the query is specifically about tech or software.`;

      let text: string | undefined;
      try {
        const res = await ai.models.generateContent({
          model: DEFAULT_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        text = res.text;
      } catch {
        // Fallback model
        const fallbackRes = await ai.models.generateContent({
          model: FALLBACK_GEMINI_MODEL,
          contents: prompt,
          config: { temperature: 0.1 },
        });
        text = fallbackRes.text;
      }

      if (text) {
        const clean = text.replace(/```json|```/gi, "").trim();
        rawOrgs = JSON.parse(clean);
      }
    } catch (err) {
      console.warn("[CandidateDiscoveryEngine] LLM entity synthesis failed, using domain taxonomy fallback:", err);
    }

    if (rawOrgs.length > 0) {
      const targets: CandidateDiscoveredTarget[] = rawOrgs.slice(0, limit).map((org) => {
        const atsMatch = detectAtsProvider(org.careerUrl || org.name);
        const atsProvider = atsMatch?.provider || "CUSTOM";
        const atsSlug = atsMatch?.atsSlug || org.name.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isKnownAts = ["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE"].includes(atsProvider) ||
          (org.careerUrl && /(greenhouse|lever\.co|ashbyhq)/i.test(org.careerUrl));

        return {
          name: org.name,
          careerUrl: org.careerUrl,
          category: (org.category as any) || "GENERAL",
          atsProvider,
          atsSlug: isKnownAts ? atsSlug : undefined,
          dispatchRoute: isKnownAts ? "ATS_DIRECT" : "OPEN_WEB",
        };
      });

      return {
        queryOrRole: queryStr,
        targets,
        method,
        groundingUnavailableReason,
      };
    }
  }

  // 4. Deterministic Multi-Domain Heuristic Fallback (0 tokens, zero failure rate)
  const matchedDomain = matchDomainTaxonomy(queryStr);
  const targets: CandidateDiscoveredTarget[] = matchedDomain.slice(0, limit).map((item) => {
    const atsMatch = detectAtsProvider(item.url);
    const atsProvider = atsMatch?.provider || "CUSTOM";
    const atsSlug = atsMatch?.atsSlug || item.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const isKnownAts = ["GREENHOUSE", "LEVER", "ASHBY", "WORKABLE"].includes(atsProvider);

    return {
      name: item.name,
      careerUrl: item.url,
      category: item.category,
      atsProvider,
      atsSlug: isKnownAts ? atsSlug : undefined,
      dispatchRoute: isKnownAts ? "ATS_DIRECT" : "OPEN_WEB",
    };
  });

  return {
    queryOrRole: queryStr,
    targets,
    method: "DETERMINISTIC_DOMAIN_HEURISTIC",
  };
}