/**
 * §OPEN-WEB DISCOVERY ENGINE (TASK-063)
 * 
 * Domain-agnostic query generation, open-web source discovery,
 * domain access classification (PUBLIC, OPTIONAL_LOGIN, REQUIRED_LOGIN),
 * and truthful source execution reconciliation (distinguishing failure vs no results).
 */

import {
  type DiscoveredSource,
  type SearchDiscoveryQuery,
  type LoginAccessClassification,
  type SourceExecutionOutcome,
  type SourceTruthfulStatus,
} from "./sourceDiscoveryTypes";
import { type SearchIntent } from "@/lib/scraper/providers/baseProvider";

// Domain-aware synonyms with strict disjoint barriers
const DOMAIN_ROLE_EXPANSIONS: Record<
  string,
  {
    synonyms: string[];
    prohibitedConfusions: RegExp[];
    industryDomains: string[];
  }
> = {
  nursing: {
    synonyms: ["registered nurse", "staff nurse", "clinical nurse", "GNM nurse", "BSc nursing"],
    prohibitedConfusions: [/\bnursing assistant\b/i, /\bward boy\b/i, /\bcaregiver\b/i, /\bmedical representative\b/i],
    industryDomains: ["hospital", "healthcare", "clinical", "medical"],
  },
  doctor: {
    synonyms: ["physician", "medical officer", "resident doctor", "consultant doctor"],
    prohibitedConfusions: [/\bmedical representative\b/i, /\bpharmacist\b/i, /\blab technician\b/i],
    industryDomains: ["hospital", "clinic", "health", "healthcare"],
  },
  mechanical: {
    synonyms: ["mechanical design engineer", "manufacturing engineer", "thermal engineer", "maintenance engineer", "plant engineer"],
    prohibitedConfusions: [/\bmechanical technician\b/i, /\bfitter\b/i, /\bmachinist\b/i, /\bturner\b/i],
    industryDomains: ["manufacturing", "industrial", "engineering", "automotive"],
  },
  civil: {
    synonyms: ["structural engineer", "site engineer", "construction engineer", "geotechnical engineer"],
    prohibitedConfusions: [/\bmason\b/i, /\bsurveyor\b/i, /\bdraftsman\b/i],
    industryDomains: ["construction", "infrastructure", "engineering", "realestate"],
  },
  accounting: {
    synonyms: ["chartered accountant", "financial accountant", "statutory auditor", "tax consultant"],
    prohibitedConfusions: [/\baccounts clerk\b/i, /\bbookkeeper\b/i, /\bsales\b/i, /\bteller\b/i],
    industryDomains: ["finance", "audit", "corporate", "banking"],
  },
  software: {
    synonyms: ["software engineer", "full stack engineer", "backend engineer", "frontend engineer"],
    prohibitedConfusions: [/\btechnical support\b/i, /\bhelpdesk\b/i, /\bdata entry\b/i],
    industryDomains: ["tech", "startup", "saas", "software"],
  },
};

export class OpenWebDiscoveryEngine {
  /**
   * Generates domain-aware search engine formulations from canonical intent.
   */
  public generateDiscoveryQueries(intent: SearchIntent): SearchDiscoveryQuery[] {
    const queries: SearchDiscoveryQuery[] = [];
    const allRoles = [intent.role, ...(intent.roles || [])].filter(Boolean) as string[];
    const primaryRole = (intent.roles && intent.roles.length > 0 && intent.role === "Healthcare Professional")
      ? intent.roles[0]
      : (intent.role || intent.roles?.[0] || "opportunity");
    const role = primaryRole;
    const location = intent.location || intent.locations?.[0] || "";
    const freshness = intent.postedWithinDays;
    const isFresher =
      intent.experienceLevel === "ENTRY_LEVEL" ||
      intent.experienceLevel === "INTERN" ||
      intent.experienceLevels?.includes("ENTRY_LEVEL") ||
      intent.experienceLevels?.includes("INTERN") ||
      /freshers?|intern|entry/i.test(intent.queryHint || "") ||
      /freshers?|intern|entry/i.test(role);
    const freshnessStr = freshness ? `last ${freshness} days` : "";

    // 1. Direct Canonical Role Formulation
    queries.push({
      query: [role, "jobs", location, isFresher ? "fresher" : "", freshnessStr].filter(Boolean).join(" ").trim(),
      domainCategory: this.detectDomainCategory(role),
      role,
      location,
      focus: "DIRECT_ROLE",
    });

    // 2. Vacancies Formulation
    queries.push({
      query: [role, "vacancies", location, freshnessStr].filter(Boolean).join(" ").trim(),
      domainCategory: this.detectDomainCategory(role),
      role,
      location,
      focus: "VACANCY",
    });

    // 3. Domain-Specific Synonyms with Barrier Verification
    const roleText = allRoles.join(" ").toLowerCase();
    const categoryKey = Object.keys(DOMAIN_ROLE_EXPANSIONS).find(
      (k) =>
        roleText.includes(k) ||
        (k === "nursing" && /nurse|nursing/i.test(roleText)) ||
        (k === "doctor" && /doctor|physician/i.test(roleText)) ||
        (k === "mechanical" && /mechanical/i.test(roleText)) ||
        (k === "civil" && /civil/i.test(roleText)) ||
        (k === "accounting" && /account/i.test(roleText)) ||
        (k === "software" && /software|developer/i.test(roleText))
    );
    if (categoryKey) {
      const expansion = DOMAIN_ROLE_EXPANSIONS[categoryKey];
      for (const synonym of expansion.synonyms.slice(0, 2)) {
        queries.push({
          query: [synonym, "jobs", location, isFresher ? "fresher" : ""].filter(Boolean).join(" ").trim(),
          domainCategory: categoryKey,
          role: synonym,
          location,
          focus: "SYNONYM",
        });
      }
    }

    // 4. Industry/Target Specific Formulation
    if (intent.company || intent.companies?.length) {
      const comp = intent.company || intent.companies![0];
      queries.push({
        query: `${comp} careers ${role} ${location}`.trim(),
        domainCategory: this.detectDomainCategory(role),
        role,
        location,
        focus: "COMPANY_ATS",
      });
    }

    return queries;
  }

  /**
   * Detects the high-level professional category from role string.
   */
  public detectDomainCategory(roleTitle: string): string {
    const lower = roleTitle.toLowerCase();
    if (/nurse|nursing|doctor|physician|healthcare|medical|pharmac/i.test(lower)) return "healthcare";
    if (/mechanical|automotive|manufacturing|hvac/i.test(lower)) return "mechanical";
    if (/civil|structural|construction/i.test(lower)) return "civil";
    if (/accountant|accounting|audit|financial|cpa/i.test(lower)) return "finance";
    if (/marketing|seo|growth|content/i.test(lower)) return "marketing";
    if (/hr|human resources|recruiter|talent/i.test(lower)) return "hr";
    if (/software|developer|frontend|backend|fullstack|data science|ai|ml/i.test(lower)) return "software";
    return "general";
  }

  /**
   * Evaluates and classifies a candidate domain or URL discovered from the open web.
   */
  public classifyDiscoveredDomain(domainOrUrl: string, intent: SearchIntent): DiscoveredSource {
    let url: URL;
    try {
      url = new URL(domainOrUrl.startsWith("http") ? domainOrUrl : `https://${domainOrUrl}`);
    } catch {
      url = new URL("https://unknown-domain.com");
    }

    const hostname = url.hostname.toLowerCase();
    const roleCategory = this.detectDomainCategory(intent.role || "");

    // Classify Access & Login Model
    let loginRequired: LoginAccessClassification = "PUBLIC";
    let publicAccess = true;
    let authenticationMode = "NONE";
    let crawlability: DiscoveredSource["crawlability"] = "DIRECT_HTTP";

    // Detect known platform characteristics without hardcoding them as exclusive
    if (hostname.includes("linkedin.com")) {
      // LinkedIn allows public guest viewing of jobs/view, but deep browsing may require login
      loginRequired = "OPTIONAL_LOGIN";
      publicAccess = true;
      authenticationMode = "OPTIONAL_COOKIE_OR_GUEST";
      crawlability = "BROWSER_RENDER";
    } else if (hostname.includes("indeed.com")) {
      loginRequired = "PUBLIC";
      publicAccess = true;
      authenticationMode = "NONE";
      crawlability = "DIRECT_HTTP";
    } else if (hostname.includes("naukri.com")) {
      loginRequired = "OPTIONAL_LOGIN";
      publicAccess = true;
      authenticationMode = "NONE";
      crawlability = "DIRECT_HTTP";
    } else if (hostname.includes("unstop.com") || hostname.includes("9am.careers")) {
      loginRequired = "PUBLIC";
      publicAccess = true;
      authenticationMode = "NONE";
      crawlability = "DIRECT_HTTP";
    } else if (hostname.includes("careers.google.com")) {
      // Google Careers publicly allows browsing and applying without forced login
      loginRequired = "PUBLIC";
      publicAccess = true;
      authenticationMode = "NONE";
      crawlability = "DIRECT_HTTP";
    } else if (hostname.includes("kornferry.com")) {
      // Korn Ferry public opportunity search allows public browsing
      loginRequired = "PUBLIC";
      publicAccess = true;
      authenticationMode = "NONE";
      crawlability = "DIRECT_HTTP";
    } else if (hostname.includes("internal.") || hostname.includes("intranet.")) {
      loginRequired = "REQUIRED_LOGIN";
      publicAccess = false;
      authenticationMode = "ENTERPRISE_SSO";
      crawlability = "UNSUPPORTED";
    }

    // Determine Source Type
    let sourceType: DiscoveredSource["sourceType"] = "AGGREGATOR";
    if (hostname.includes("hospital") || hostname.includes("health") || hostname.includes("aiims") || hostname.includes("clinic")) {
      sourceType = "HOSPITAL_PORTAL";
    } else if (hostname.includes("gov") || hostname.includes("nic.in") || hostname.includes("upsc")) {
      sourceType = "GOVERNMENT_PORTAL";
    } else if (hostname.includes("greenhouse.io") || hostname.includes("lever.co") || hostname.includes("ashbyhq.com")) {
      sourceType = "ATS_PORTAL";
    } else if (hostname.includes("consultant") || hostname.includes("search") || hostname.includes("recruit")) {
      sourceType = "RECRUITMENT_AGENCY";
    } else if (hostname.includes("career") || hostname.includes("jobs.")) {
      sourceType = "COMPANY_CAREERS";
    }

    // Compute Relevance based on Intent
    let relevance = 0.8;
    if (roleCategory === "healthcare" && sourceType === "HOSPITAL_PORTAL") relevance = 0.95;
    if (roleCategory === "mechanical" && (hostname.includes("engineer") || hostname.includes("naukri"))) relevance = 0.9;
    if (roleCategory === "healthcare" && (hostname.includes("greenhouse") || hostname.includes("lever"))) relevance = 0.4; // ATS platform without healthcare target has low relevance

    return {
      sourceCandidate: hostname.replace(/^www\./, ""),
      sourceUrl: url.origin,
      sourceDomain: hostname,
      sourceType,
      discoveryMethod: "SEARCH_ENGINE",
      relevance,
      publicAccess,
      loginRequired,
      authenticationMode,
      robotsStatus: "ALLOWED",
      crawlability,
      jobSearchCapability: true,
      detailPageCapability: true,
      supportsFiltering: true,
      supportsDateInformation: true,
      supportsDirectApplication: true,
      observedAt: new Date(),
      verificationStatus: "VERIFIED",
    };
  }

  /**
   * Truthfully distinguishes Source Failure from Zero Results.
   * Section 20: Never report "No jobs exist" when the source actually failed.
   */
  public evaluateSourceExecutionStatus(
    sourceName: string,
    rawResult: {
      candidatesFound: number;
      httpStatus?: number;
      error?: Error | string | null;
      captchaDetected?: boolean;
      rateLimited?: boolean;
      authRequired?: boolean;
      parseError?: boolean;
    }
  ): SourceTruthfulStatus {
    // 1. CAPTCHA Barrier
    if (rawResult.captchaDetected) {
      return {
        sourceName,
        outcome: "CAPTCHA_DETECTED",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] is protected by CAPTCHA/bot challenge. Automated crawl suspended without bypass.`,
        isFatal: true,
      };
    }

    // 2. Authentication Required Barrier
    if (rawResult.authRequired || rawResult.httpStatus === 401) {
      return {
        sourceName,
        outcome: "AUTH_REQUIRED",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] requires user credentials or an active browser session to access opportunities.`,
        isFatal: true,
      };
    }

    // 3. Rate Limited (429)
    if (rawResult.rateLimited || rawResult.httpStatus === 429) {
      return {
        sourceName,
        outcome: "RATE_LIMITED",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] returned HTTP 429 (Too Many Requests). Crawl backed off gracefully.`,
        isFatal: false,
      };
    }

    // 4. Source Unavailable (Network failure / 5xx error)
    if (rawResult.httpStatus && rawResult.httpStatus >= 500) {
      return {
        sourceName,
        outcome: "SOURCE_UNAVAILABLE",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] server error (HTTP ${rawResult.httpStatus}). Source is temporarily unavailable.`,
        isFatal: true,
      };
    }

    if (rawResult.error && !rawResult.candidatesFound) {
      return {
        sourceName,
        outcome: "SOURCE_UNAVAILABLE",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] failed to connect: ${typeof rawResult.error === "string" ? rawResult.error : rawResult.error.message}`,
        isFatal: true,
      };
    }

    // 5. Extraction / Parse Failure
    if (rawResult.parseError) {
      return {
        sourceName,
        outcome: "EXTRACTION_FAILURE",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] markup structure could not be parsed.`,
        isFatal: false,
      };
    }

    // 6. Source Successfully Crawled with Zero Matches (Truthful Shortfall / No Results)
    if (rawResult.candidatesFound === 0) {
      return {
        sourceName,
        outcome: "SOURCE_SUCCESS_NO_MATCH",
        candidatesFound: 0,
        explanation: `Source [${sourceName}] was successfully searched, but no opportunities matched the requested criteria.`,
        isFatal: false,
      };
    }

    // 7. Source Successfully Crawled with Positive Matches
    return {
      sourceName,
      outcome: "SOURCE_SUCCESS_MATCHES",
      candidatesFound: rawResult.candidatesFound,
      explanation: `Source [${sourceName}] yielded ${rawResult.candidatesFound} candidate opportunities.`,
      isFatal: false,
    };
  }
}

export const openWebDiscoveryEngine = new OpenWebDiscoveryEngine();
