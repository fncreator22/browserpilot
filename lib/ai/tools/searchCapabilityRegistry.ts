/**
 * §CANONICAL SEARCH CAPABILITY REGISTRY (TASK-050)
 * 
 * Authoritative registry of all capabilities exposed to the LLM Search Planner.
 * Governs what BrowserPilot can execute, their schemas, risk levels, and auth requirements.
 */

import { z } from "zod";
import {
  type SearchCapabilityId,
  type SearchCapabilityDefinition,
  type SearchCapabilityCategory,
} from "./searchCapabilityTypes";

export class SearchCapabilityRegistry {
  private capabilities: Map<SearchCapabilityId, SearchCapabilityDefinition<any, any>> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // -------------------------------------------------------------------------
    // 1. SEARCH PIPELINE CAPABILITIES
    // -------------------------------------------------------------------------
    this.register({
      capabilityId: "discovery.search_pipeline",
      name: "Multi-Source Swarm Search Pipeline",
      description: "Executes canonical multi-source search across active providers with quality-gate filtering and ranking.",
      category: "SEARCH",
      inputSchema: z.object({
        query: z.string().min(1),
        requestedCount: z.number().int().positive().max(50).default(10),
        targetLocations: z.array(z.string()).optional(),
        targetRoles: z.array(z.string()).optional(),
        workModes: z.array(z.string()).optional(),
        postedWithinDays: z.number().int().positive().max(90).optional(),
        freshnessWindowHours: z.number().int().positive().optional(),
        targetCompanies: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({
        harvestedCount: z.number(),
        verifiedCount: z.number(),
        results: z.array(z.any()),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 15000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "source.search",
      name: "Targeted Single Source Search",
      description: "Directly queries a specific job source or ATS provider (e.g. LinkedIn, Indeed, Greenhouse, Ashby, Lever).",
      category: "SEARCH",
      inputSchema: z.object({
        sourceName: z.string().min(1),
        query: z.string().min(1),
        maxResults: z.number().int().positive().max(30).default(10),
        postedWithinDays: z.number().int().positive().max(90).optional(),
      }),
      outputSchema: z.object({
        sourceName: z.string(),
        candidateCount: z.number(),
        results: z.array(z.any()),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 10000,
      availabilityStatus: "AVAILABLE",
    });

    // -------------------------------------------------------------------------
    // 2. COMPANY DISCOVERY CAPABILITIES
    // -------------------------------------------------------------------------
    this.register({
      capabilityId: "company.lookup",
      name: "Company Intelligence & Portal Graph",
      description: "Looks up verified career portals, ATS providers, and historical success rates for a specific company.",
      category: "COMPANY_DISCOVERY",
      inputSchema: z.object({
        companyName: z.string().min(1),
      }),
      outputSchema: z.object({
        companyName: z.string(),
        officialCareerUrl: z.string().optional(),
        atsProvider: z.string().optional(),
        atsUrl: z.string().optional(),
        reliabilityScore: z.number(),
      }),
      requiresAuth: false,
      evidenceLevel: "COMPANY_PORTAL",
      riskLevel: "LOW",
      timeoutMs: 5000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "company.ats",
      name: "Direct Company ATS Discovery",
      description: "Directly queries a company's verified ATS boards endpoint (Greenhouse, Ashby, Lever) for active listings.",
      category: "COMPANY_DISCOVERY",
      inputSchema: z.object({
        companyName: z.string().min(1),
        atsProvider: z.enum(["GREENHOUSE", "ASHBY", "LEVER", "WORKABLE"]).optional(),
      }),
      outputSchema: z.object({
        companyName: z.string(),
        atsEndpoint: z.string(),
        jobCount: z.number(),
        jobs: z.array(z.any()),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 10000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "company.careers",
      name: "Official Career Page Explorer",
      description: "Discovers and parses job openings directly hosted on an employer's official career website.",
      category: "COMPANY_DISCOVERY",
      inputSchema: z.object({
        companyName: z.string().min(1),
        careerUrl: z.string().url().optional(),
      }),
      outputSchema: z.object({
        careerUrl: z.string(),
        openingsFound: z.number(),
      }),
      requiresAuth: false,
      evidenceLevel: "COMPANY_PORTAL",
      riskLevel: "LOW",
      timeoutMs: 12000,
      availabilityStatus: "AVAILABLE",
    });

    // -------------------------------------------------------------------------
    // 3. BROWSER CAPABILITIES
    // -------------------------------------------------------------------------
    this.register({
      capabilityId: "browser.authenticated_search",
      name: "Authenticated Browser Source Search",
      description: "Executes browser discovery on a source utilizing a tenant's verified stored session state.",
      category: "BROWSER",
      inputSchema: z.object({
        sourceName: z.string().min(1),
        query: z.string().min(1),
        maxResults: z.number().int().positive().max(25).default(10),
      }),
      outputSchema: z.object({
        sourceName: z.string(),
        isAuthenticated: z.boolean(),
        candidatesHarvested: z.number(),
      }),
      requiresAuth: true,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "MEDIUM",
      timeoutMs: 20000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "browser.navigate",
      name: "Public Browser Navigation",
      description: "Navigates to a public job listing or career page to inspect availability.",
      category: "BROWSER",
      inputSchema: z.object({
        targetUrl: z.string().url(),
      }),
      outputSchema: z.object({
        finalUrl: z.string(),
        statusCode: z.number(),
        pageTitle: z.string(),
      }),
      requiresAuth: false,
      evidenceLevel: "COMPANY_PORTAL",
      riskLevel: "LOW",
      timeoutMs: 15000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "browser.extract",
      name: "Structured Page Content Extraction",
      description: "Extracts job details, requirements, and application links from an inspected page.",
      category: "BROWSER",
      inputSchema: z.object({
        targetUrl: z.string().url(),
        extractFields: z.array(z.string()).optional(),
      }),
      outputSchema: z.object({
        title: z.string().optional(),
        company: z.string().optional(),
        location: z.string().optional(),
        applyUrl: z.string().optional(),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 15000,
      availabilityStatus: "AVAILABLE",
    });

    // -------------------------------------------------------------------------
    // 4. EVIDENCE CAPABILITIES
    // -------------------------------------------------------------------------
    this.register({
      capabilityId: "evidence.verify_url",
      name: "Job Detail URL Classification & Verification",
      description: "Deterministically validates whether a URL points to an exact direct job posting vs generic portal.",
      category: "EVIDENCE",
      inputSchema: z.object({
        url: z.string().url(),
        expectedTitle: z.string().optional(),
        companyName: z.string().optional(),
      }),
      outputSchema: z.object({
        url: z.string(),
        isJobUrl: z.boolean(),
        classification: z.string(),
        reason: z.string(),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 5000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "evidence.verify_metadata",
      name: "Posting Date & Freshness Verification",
      description: "Validates posted date, freshness window, and identifiable company metadata against quality gates.",
      category: "EVIDENCE",
      inputSchema: z.object({
        url: z.string().url(),
        postedDate: z.string().optional(),
        maxAgeDays: z.number().int().positive().default(15),
      }),
      outputSchema: z.object({
        isEligible: z.boolean(),
        reasons: z.array(z.string()),
      }),
      requiresAuth: false,
      evidenceLevel: "DIRECT_JOB",
      riskLevel: "LOW",
      timeoutMs: 5000,
      availabilityStatus: "AVAILABLE",
    });

    // -------------------------------------------------------------------------
    // 5. CONTEXT & KNOWLEDGE CAPABILITIES
    // -------------------------------------------------------------------------
    this.register({
      capabilityId: "memory.retrieve",
      name: "Tenant-Isolated User Memory Retrieval",
      description: "Retrieves active user preferences and instructions for the authenticated user.",
      category: "CONTEXT",
      inputSchema: z.object({
        query: z.string().min(1),
        limit: z.number().int().positive().max(10).default(5),
      }),
      outputSchema: z.object({
        memories: z.array(z.any()),
      }),
      requiresAuth: true,
      evidenceLevel: "METADATA_SIGNAL",
      riskLevel: "LOW",
      timeoutMs: 3000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "intelligence.lookup",
      name: "Platform Knowledge & Discovery Signals",
      description: "Queries architectural knowledge facts and company-source affinity signals.",
      category: "CONTEXT",
      inputSchema: z.object({
        queryOrCompany: z.string().min(1),
      }),
      outputSchema: z.object({
        signals: z.array(z.any()),
      }),
      requiresAuth: false,
      evidenceLevel: "METADATA_SIGNAL",
      riskLevel: "LOW",
      timeoutMs: 3000,
      availabilityStatus: "AVAILABLE",
    });

    this.register({
      capabilityId: "source.reliability",
      name: "Source Circuit-Breaker & Health Telemetry",
      description: "Checks circuit breaker cooldown status and historical reliability scores for a source.",
      category: "CONTEXT",
      inputSchema: z.object({
        sourceName: z.string().min(1),
      }),
      outputSchema: z.object({
        sourceName: z.string(),
        status: z.enum(["HEALTHY", "DEGRADED", "COOLDOWN"]),
        isAvailable: z.boolean(),
        consecutiveFailures: z.number(),
      }),
      requiresAuth: false,
      evidenceLevel: "METADATA_SIGNAL",
      riskLevel: "LOW",
      timeoutMs: 1000,
      availabilityStatus: "AVAILABLE",
    });
  }

  public register(cap: SearchCapabilityDefinition<any, any>): void {
    this.capabilities.set(cap.capabilityId, cap);
  }

  public getCapability(id: SearchCapabilityId): SearchCapabilityDefinition<any, any> | null {
    return this.capabilities.get(id) || null;
  }

  public getAllCapabilities(): SearchCapabilityDefinition<any, any>[] {
    return Array.from(this.capabilities.values());
  }

  public getCapabilitiesByCategory(category: SearchCapabilityCategory): SearchCapabilityDefinition<any, any>[] {
    return this.getAllCapabilities().filter((c) => c.category === category);
  }

  public hasCapability(id: string): boolean {
    return this.capabilities.has(id as SearchCapabilityId);
  }
}

export const searchCapabilityRegistry = new SearchCapabilityRegistry();
