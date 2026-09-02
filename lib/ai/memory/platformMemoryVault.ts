/**
 * §PLATFORM MEMORY VAULT (TASK-047)
 * 
 * Stores compressed, high-value engineering knowledge, architectural facts, component
 * boundaries, active constraints, and task provenance (TASK-001 through TASK-047).
 * 
 * Prevents AI coding agents from repeatedly scanning the entire repository.
 * Zero User Data — Engineering & Platform state only.
 */

import {
  type PlatformMemoryItem,
  type PlatformMemoryType,
  type PlatformMemoryStatus,
} from "./memoryTypes";

const CANONICAL_PLATFORM_MEMORIES: PlatformMemoryItem[] = [
  {
    id: "mem_plat_001",
    memoryId: "ARCH-DISCOVERY-ENGINE",
    type: "ARCHITECTURE",
    title: "Multi-Source Swarm & Discovery Execution Service",
    summary: "Coordinates parallel discovery across LinkedIn, Indeed, Greenhouse, Ashby, Lever, YC, and company career pages with deterministic timeouts and telemetry.",
    status: "ACTIVE",
    sourceTask: "TASK-041",
    relatedFiles: [
      "lib/discovery/execution/discoveryExecutionService.ts",
      "lib/scraper/swarmDiscovery.ts",
      "lib/scraper/searchPipeline.ts",
    ],
    relatedComponents: ["DiscoveryExecutionService", "SwarmDiscoveryEngine", "SearchPipeline"],
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date("2026-08-30"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_002",
    memoryId: "ARCH-SEARCH-QUALITY-GATE",
    type: "ARCHITECTURE",
    title: "Authoritative Search Result Quality Gate",
    summary: "Single server-authoritative eligibility gate validating identifiable title/company, exact job detail URLs, 15d/48h date window, role relevance, and seniority alignment before deduplication and ranking.",
    status: "ACTIVE",
    sourceTask: "TASK-044",
    relatedFiles: [
      "lib/scraper/searchQualityGate.ts",
      "lib/scraper/normalizer.ts",
      "lib/scraper/freshnessExtractor.ts",
    ],
    relatedComponents: ["evaluateCandidateQualityGate", "classifyJobUrl", "parsePostingDate"],
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_003",
    memoryId: "ARCH-URL-CLASSIFIER",
    type: "COMPONENT",
    title: "Deterministic Job URL Classification",
    summary: "Classifies URLs into JOB_DETAIL, COMPANY_CAREER_ROOT, ATS_COMPANY_ROOT, SEARCH_RESULTS, SOURCE_HOME, or UNKNOWN, preventing generic portals from being returned as job links.",
    status: "ACTIVE",
    sourceTask: "TASK-044",
    relatedFiles: ["lib/scraper/normalizer.ts"],
    relatedComponents: ["classifyJobUrl", "isGenericCareerHomepage"],
    importance: 0.95,
    confidence: 1.0,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_004",
    memoryId: "ARCH-SOURCE-RELIABILITY-MANAGER",
    type: "COMPONENT",
    title: "Source Failure Classification & Circuit Breaker",
    summary: "11-category deterministic failure classifier (AUTH_REQUIRED, RATE_LIMITED, CAPTCHA, TEMPORARY_FAILURE, etc.), bounded transient retries, 60s cooldown circuit breaker, and automatic recovery.",
    status: "ACTIVE",
    sourceTask: "TASK-046",
    relatedFiles: [
      "lib/discovery/execution/sourceReliabilityManager.ts",
      "lib/scraper/swarmDiscovery.ts",
    ],
    relatedComponents: ["sourceReliabilityManager", "classifySourceError", "isTransientFailure"],
    importance: 0.95,
    confidence: 1.0,
    createdAt: new Date("2026-09-02"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_005",
    memoryId: "ARCH-CONCURRENCY-CONTROLLER",
    type: "COMPONENT",
    title: "Browser Concurrency Controller & Capacity Governance",
    summary: "Enforces max concurrent browser contexts (10), per-source limits (4), per-user limits (8), and strict resource release in finally blocks across all crash/abort paths.",
    status: "ACTIVE",
    sourceTask: "TASK-041",
    relatedFiles: ["lib/discovery/execution/browserConcurrencyController.ts"],
    relatedComponents: ["browserConcurrencyController"],
    importance: 0.9,
    confidence: 1.0,
    createdAt: new Date("2026-08-30"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_006",
    memoryId: "SEC-TENANT-ISOLATION",
    type: "SECURITY_RULE",
    title: "Strict Tenant Isolation & Zero Secret Logging",
    summary: "User data, browser sessions, credentials, and memories are strictly partitioned by userId. Telemetry payloads sanitize all keys matching passwords, secrets, tokens, and cookies.",
    status: "ACTIVE",
    sourceTask: "TASK-034",
    relatedFiles: [
      "lib/discovery/browser/browserSessionManager.ts",
      "lib/discovery/execution/sourceReliabilityManager.ts",
    ],
    relatedComponents: ["sanitizeTelemetryPayload", "BrowserSessionManager"],
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date("2026-08-28"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_007",
    memoryId: "SEC-PROMPT-INJECTION-GUARD",
    type: "SECURITY_RULE",
    title: "Prompt Injection Protection & Passive Data Delimiters",
    summary: "All external scraped web data and user memory items are wrapped inside untrusted passive delimiters (<untrusted_web_content>, <user_preferences>) and cannot override system instructions.",
    status: "ACTIVE",
    sourceTask: "TASK-006",
    relatedFiles: ["lib/ai/synthesizer.ts"],
    relatedComponents: ["synthesizeFinalAnswerWithMetadata"],
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date("2026-08-20"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_008",
    memoryId: "CONSTRAINT-AWS-LOCK",
    type: "CONSTRAINT",
    title: "Active AWS Deployment Lock",
    summary: "Strict prohibition on AWS cloud provisioning, mutation, or deployment commands. All features must be locally testable and PostgreSQL/SQLite compatible.",
    status: "ACTIVE",
    sourceTask: "TASK-035",
    relatedFiles: ["package.json", "prisma/schema.prisma"],
    relatedComponents: ["EnvironmentContract"],
    importance: 1.0,
    confidence: 1.0,
    createdAt: new Date("2026-08-29"),
    updatedAt: new Date("2026-09-02"),
  },
  {
    id: "mem_plat_009",
    memoryId: "DATA-OPPORTUNITY-DAL",
    type: "DATA_MODEL",
    title: "Canonical Opportunity Schema & 3-Tier Deduplication",
    summary: "Opportunities identified by SHA-256 canonicalHash (title + company + location), with multi-source listings, 48-hour freshness tracking, and lifecycle status transitions.",
    status: "ACTIVE",
    sourceTask: "TASK-004",
    relatedFiles: ["lib/db/opportunities.ts", "lib/scraper/deduplicator.ts"],
    relatedComponents: ["upsertOpportunity", "deduplicateCandidates"],
    importance: 0.95,
    confidence: 1.0,
    createdAt: new Date("2026-08-19"),
    updatedAt: new Date("2026-09-02"),
  },
];

export class PlatformMemoryVault {
  private memories = new Map<string, PlatformMemoryItem>();

  constructor() {
    for (const item of CANONICAL_PLATFORM_MEMORIES) {
      this.memories.set(item.memoryId, item);
    }
  }

  /**
   * Queries platform engineering knowledge by keyword, type, or source task.
   */
  public queryKnowledge(options: {
    query?: string;
    type?: PlatformMemoryType;
    status?: PlatformMemoryStatus;
    sourceTask?: string;
    limit?: number;
  } = {}): PlatformMemoryItem[] {
    const { query, type, status = "ACTIVE", sourceTask, limit = 10 } = options;
    const qLower = (query || "").toLowerCase();

    const matches = Array.from(this.memories.values()).filter((item) => {
      if (status && item.status !== status) return false;
      if (type && item.type !== type) return false;
      if (sourceTask && item.sourceTask.toLowerCase() !== sourceTask.toLowerCase()) return false;

      if (qLower) {
        const fullText = `${item.memoryId} ${item.title} ${item.summary} ${item.relatedComponents.join(" ")}`.toLowerCase();
        const matchesQuery = qLower.split(/\s+/).some((token) => fullText.includes(token));
        if (!matchesQuery) return false;
      }
      return true;
    });

    matches.sort((a, b) => b.importance - a.importance);
    return matches.slice(0, limit);
  }

  /**
   * Retrieves a specific platform memory item by ID.
   */
  public getMemory(memoryId: string): PlatformMemoryItem | undefined {
    return this.memories.get(memoryId);
  }

  /**
   * Adds or updates a platform memory item (superseding older versions).
   */
  public recordMemory(item: Omit<PlatformMemoryItem, "id" | "createdAt" | "updatedAt">): PlatformMemoryItem {
    const existing = this.memories.get(item.memoryId);
    const now = new Date();

    const memoryItem: PlatformMemoryItem = {
      ...item,
      id: existing ? existing.id : `plat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };

    this.memories.set(item.memoryId, memoryItem);
    return memoryItem;
  }

  /**
   * Returns all active platform memory items.
   */
  public getAllActive(): PlatformMemoryItem[] {
    return Array.from(this.memories.values()).filter((m) => m.status === "ACTIVE");
  }
}

export const platformMemoryVault = new PlatformMemoryVault();
