import { getSharedRedisClient, isRedisCircuitAvailable } from "@/lib/queue/redis";
import { prisma } from "@/lib/db/prisma";

export const MAX_OPPORTUNITY_CACHE_SIZE = 10000;
export const REDIS_OPP_DATA_KEY = "browserpilot:opps:data";
export const REDIS_OPP_ZSET_KEY = "browserpilot:opps:zset";
export const REDIS_OPP_CAT_KEY_PREFIX = "browserpilot:opps:cat:";
export const REDIS_OPP_WM_KEY_PREFIX = "browserpilot:opps:wm:";

export interface CachedOpportunityItem {
  id: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode: string;
  experienceLevel: string;
  opportunityType: string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  requirements?: string[] | string;
  skills?: string[] | string;
  primaryApplyUrl: string;
  firstSeenAt?: string | Date;
  lastVerifiedAt?: string | Date;
  status: string;
  sourceListings?: Array<{
    sourcePlatform: string;
    applyUrl: string;
    verificationStatus?: string;
    rawSnippet?: string | null;
    seenAt?: string | Date;
  }>;
  companyContacts?: Array<{
    id: string;
    fullName: string;
    roleTitle: string;
    department?: string | null;
    profileUrl?: string | null;
    email?: string | null;
    personalEmail?: string | null;
    phone?: string | null;
    isVerified?: boolean;
    sourcePlatform?: string | null;
  }>;
}

export interface OpportunityCacheQuery {
  q?: string;
  category?: string;
  role?: string;
  skills?: string[] | string;
  workMode?: string;
  experienceLevel?: string;
  postedWithinDays?: number | null;
  page?: number;
  limit?: number;
  sort?: "latest" | "salary" | "oldest" | string;
  userId?: string | null;
}

export interface OpportunityCacheQueryResult {
  items: CachedOpportunityItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  source: "redis" | "memory" | "database";
}

// In-memory sliding window cache fallback (keeps up to 10,000 items)
const inMemoryCache = new Map<string, CachedOpportunityItem>();

function safeParseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.filter((s): s is string => typeof s === "string");
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
      if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
    } catch {
      if (val.trim().length > 0) {
        return val.split(",").map((s) => s.trim()).filter(Boolean);
      }
    }
  }
  return [];
}

const CATEGORY_KEYWORDS_MAP: Record<string, string[]> = {
  AI_ML: ["AI", "Machine Learning", "LLM", "Data", "Vision", "ML", "PyTorch"],
  INFRASTRUCTURE: ["DevOps", "Cloud", "Kubernetes", "AWS", "Infrastructure", "Platform", "SRE", "Backend"],
  FRONTEND: ["Frontend", "React", "Next.js", "Full Stack", "TypeScript", "UI", "Web"],
  PRODUCT_DESIGN: ["Product Manager", "Design", "UX", "UI/UX", "Product"],
  FINTECH: ["Fintech", "Payment", "Risk", "Trading", "Banking"],
  MARKETING: ["Marketing", "Growth", "SEO", "Content", "Brand", "Campaign"],
  SALES: ["Sales", "Account Executive", "BDR", "SDR", "RevOps", "Business Development"],
  OPERATIONS: ["Operations", "Ops", "Chief of Staff", "Strategy", "Logistics", "Program Manager"],
  FINANCE: ["Finance", "Accounting", "Financial", "Fintech", "Tax", "Audit", "Treasury"],
  HEALTHCARE: ["Healthcare", "Health", "Clinical", "Biotech", "Medical", "Pharma"],
  CUSTOMER_SUCCESS: ["Customer Success", "Support", "Client Success", "Account Manager", "CX"],
  LEGAL: ["Legal", "Counsel", "Compliance", "Regulatory", "Attorney"],
  DESIGN: ["Design", "Designer", "UX", "UI", "Graphic", "Creative", "Art Director"],
};

/**
 * Normalizes an opportunity record for caching.
 */
export function normalizeOpportunityForCache(opp: any): CachedOpportunityItem {
  return {
    id: opp.id,
    canonicalHash: opp.canonicalHash,
    title: opp.title,
    companyName: opp.companyName,
    location: opp.location,
    workMode: opp.workMode || "ANY",
    experienceLevel: opp.experienceLevel || "ENTRY_LEVEL",
    opportunityType: opp.opportunityType || "FULL_TIME",
    salaryMin: typeof opp.salaryMin === "number" ? opp.salaryMin : null,
    salaryMax: typeof opp.salaryMax === "number" ? opp.salaryMax : null,
    salaryCurrency: opp.salaryCurrency || "USD",
    description: opp.description || "",
    requirements: safeParseArray(opp.requirements),
    skills: safeParseArray(opp.skills),
    primaryApplyUrl: opp.primaryApplyUrl || "",
    firstSeenAt: opp.firstSeenAt ? new Date(opp.firstSeenAt).toISOString() : new Date().toISOString(),
    lastVerifiedAt: opp.lastVerifiedAt ? new Date(opp.lastVerifiedAt).toISOString() : new Date().toISOString(),
    status: opp.status || "ACTIVE",
    sourceListings: (opp.sourceListings || []).map((s: any) => ({
      sourcePlatform: s.sourcePlatform,
      applyUrl: s.applyUrl,
      verificationStatus: s.verificationStatus || "VERIFIED",
      rawSnippet: s.rawSnippet || null,
      seenAt: s.seenAt ? new Date(s.seenAt).toISOString() : undefined,
    })),
    companyContacts: (opp.companyContacts || []).map((c: any) => ({
      id: c.id,
      fullName: c.fullName,
      roleTitle: c.roleTitle,
      department: c.department || null,
      profileUrl: c.profileUrl || null,
      email: c.email || null,
      personalEmail: c.personalEmail || null,
      phone: c.phone || null,
      isVerified: Boolean(c.isVerified),
      sourcePlatform: c.sourcePlatform || null,
    })),
  };
}

/**
 * Trims the Redis sliding window to ensure it never exceeds MAX_OPPORTUNITY_CACHE_SIZE (10,000 items).
 * Evicts the oldest items based on timestamp score (FIFO/LRU eviction).
 */
export async function trimRedisOpportunityCache(): Promise<number> {
  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return 0;

    const redis = getSharedRedisClient();
    const count = await redis.zcard(REDIS_OPP_ZSET_KEY);
    if (count <= MAX_OPPORTUNITY_CACHE_SIZE) {
      return 0;
    }

    const excess = count - MAX_OPPORTUNITY_CACHE_SIZE;
    const oldestIds = await redis.zrange(REDIS_OPP_ZSET_KEY, 0, String(excess - 1));

    if (oldestIds && oldestIds.length > 0) {
      const pipeline = redis.pipeline();
      pipeline.zremrangebyrank(REDIS_OPP_ZSET_KEY, 0, excess - 1);
      pipeline.hdel(REDIS_OPP_DATA_KEY, ...oldestIds);
      await pipeline.exec();
      return oldestIds.length;
    }
    return 0;
  } catch (err) {
    console.warn("[RedisOpportunityCache] Trim error:", err);
    return 0;
  }
}

/**
 * Updates the in-memory fallback sliding window to at most 10,000 items.
 */
function updateInMemoryCache(opp: CachedOpportunityItem): void {
  inMemoryCache.set(opp.id, opp);
  if (inMemoryCache.size > MAX_OPPORTUNITY_CACHE_SIZE) {
    const firstKey = inMemoryCache.keys().next().value;
    if (firstKey) {
      inMemoryCache.delete(firstKey);
    }
  }
}

/**
 * Synchronizes a single opportunity into the Redis sliding-window cache.
 * Called continuously as search discovery writes/updates opportunities in the database.
 */
export async function syncOpportunityToRedisCache(opportunity: any): Promise<void> {
  if (!opportunity?.id) return;
  const normalized = normalizeOpportunityForCache(opportunity);

  // Always update in-memory cache
  updateInMemoryCache(normalized);

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return;

    const redis = getSharedRedisClient();
    const score = new Date(normalized.lastVerifiedAt || normalized.firstSeenAt || Date.now()).getTime();

    const pipeline = redis.pipeline();
    pipeline.hset(REDIS_OPP_DATA_KEY, normalized.id, JSON.stringify(normalized));
    pipeline.zadd(REDIS_OPP_ZSET_KEY, score, normalized.id);
    await pipeline.exec();

    // Check and evict if cache exceeds 10,000 items
    await trimRedisOpportunityCache();
  } catch (err) {
    console.warn("[RedisOpportunityCache] Sync failure:", err);
  }
}

/**
 * Synchronizes a batch of opportunities into the Redis sliding-window cache.
 */
export async function syncBatchOpportunitiesToRedisCache(opportunities: any[]): Promise<number> {
  if (!opportunities || opportunities.length === 0) return 0;

  const validItems: CachedOpportunityItem[] = [];
  for (const opp of opportunities) {
    if (opp?.id) {
      const norm = normalizeOpportunityForCache(opp);
      validItems.push(norm);
      updateInMemoryCache(norm);
    }
  }

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!isAvailable) return validItems.length;

    const redis = getSharedRedisClient();
    const pipeline = redis.pipeline();

    for (const item of validItems) {
      const score = new Date(item.lastVerifiedAt || item.firstSeenAt || Date.now()).getTime();
      pipeline.hset(REDIS_OPP_DATA_KEY, item.id, JSON.stringify(item));
      pipeline.zadd(REDIS_OPP_ZSET_KEY, score, item.id);
    }

    await pipeline.exec();
    await trimRedisOpportunityCache();
    return validItems.length;
  } catch (err) {
    console.warn("[RedisOpportunityCache] Batch sync failure:", err);
    return validItems.length;
  }
}

/**
 * Returns current count of cached opportunities in Redis and in-memory.
 */
export async function getOpportunityCacheStats(): Promise<{
  redisCount: number;
  memoryCount: number;
  maxCapacity: number;
  isRedisConnected: boolean;
}> {
  let redisCount = 0;
  let isRedisConnected = false;

  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (isAvailable) {
      const redis = getSharedRedisClient();
      redisCount = await redis.zcard(REDIS_OPP_ZSET_KEY);
      isRedisConnected = true;
    }
  } catch {}

  return {
    redisCount,
    memoryCount: inMemoryCache.size,
    maxCapacity: MAX_OPPORTUNITY_CACHE_SIZE,
    isRedisConnected,
  };
}

/**
 * Primes the Redis sliding-window cache from PostgreSQL.
 * Fetches up to 10,000 latest active opportunities from the main database.
 */
export async function primeOpportunityCacheFromDb(force = false): Promise<number> {
  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (!force && isAvailable) {
      const redis = getSharedRedisClient();
      const existingCount = await redis.zcard(REDIS_OPP_ZSET_KEY);
      if (existingCount >= 100) {
        return existingCount;
      }
    }

    const dbOpps = await prisma.opportunity.findMany({
      where: {
        status: "ACTIVE",
      },
      orderBy: {
        lastVerifiedAt: "desc",
      },
      take: MAX_OPPORTUNITY_CACHE_SIZE,
      include: {
        sourceListings: {
          select: {
            sourcePlatform: true,
            applyUrl: true,
            verificationStatus: true,
            rawSnippet: true,
            seenAt: true,
          },
          take: 3,
        },
        companyContacts: {
          select: {
            id: true,
            fullName: true,
            roleTitle: true,
            department: true,
            profileUrl: true,
            email: true,
            personalEmail: true,
            phone: true,
            isVerified: true,
            sourcePlatform: true,
          },
          take: 5,
        },
      },
    });

    if (dbOpps && dbOpps.length > 0) {
      await syncBatchOpportunitiesToRedisCache(dbOpps);
      return dbOpps.length;
    }
    return 0;
  } catch (err) {
    console.warn("[RedisOpportunityCache] Prime from DB warning:", err);
    return 0;
  }
}

/**
 * Filters and searches cached opportunities by roles, skills, categories, keywords, and metadata.
 * Executes against Redis sliding-window cache with fallback to in-memory cache and PostgreSQL.
 */
export async function searchCachedOpportunities(
  query: OpportunityCacheQuery
): Promise<OpportunityCacheQueryResult> {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 24));
  const q = query.q?.trim().toLowerCase() || "";
  const role = query.role?.trim().toLowerCase() || "";
  const category = query.category?.trim() || "ALL";
  const workMode = query.workMode?.trim() || "ANY";
  const experienceLevel = query.experienceLevel?.trim() || "ANY";
  const postedWithinDays = query.postedWithinDays && query.postedWithinDays > 0 ? query.postedWithinDays : null;
  const sort = query.sort || "latest";

  const skillFilterTerms: string[] = [];
  if (query.skills) {
    if (Array.isArray(query.skills)) {
      skillFilterTerms.push(...query.skills.map((s) => s.toLowerCase().trim()).filter(Boolean));
    } else if (typeof query.skills === "string") {
      try {
        const parsed = JSON.parse(query.skills);
        if (Array.isArray(parsed)) {
          skillFilterTerms.push(...parsed.map((s) => String(s).toLowerCase().trim()).filter(Boolean));
        } else {
          skillFilterTerms.push(query.skills.toLowerCase().trim());
        }
      } catch {
        skillFilterTerms.push(
          ...query.skills.split(",").map((s) => s.toLowerCase().trim()).filter(Boolean)
        );
      }
    }
  }

  const matchesOpportunity = (opp: CachedOpportunityItem): boolean => {
    // 1. Synthetic or demo company filter
    const compLower = opp.companyName.toLowerCase();
    if (
      compLower.includes("acme") ||
      compLower.includes("demo") ||
      compLower.includes("test") ||
      compLower.includes("frontier") ||
      compLower.includes("placeholder") ||
      compLower.includes("example") ||
      compLower.includes("hyperscale") ||
      compLower.includes("newco")
    ) {
      return false;
    }
    if (/\d{6,}$/.test(opp.companyName.trim())) return false;

    // 2. Keyword query
    if (q) {
      const titleLower = opp.title.toLowerCase();
      const descLower = opp.description.toLowerCase();
      const skillsStr = (Array.isArray(opp.skills) ? opp.skills.join(" ") : String(opp.skills || "")).toLowerCase();

      const inTitle = titleLower.includes(q);
      const inComp = compLower.includes(q);
      const inDesc = descLower.includes(q);
      const inSkills = skillsStr.includes(q);

      if (!inTitle && !inComp && !inDesc && !inSkills) {
        return false;
      }
    }

    // 3. Role filter
    if (role) {
      const titleLower = opp.title.toLowerCase();
      if (!titleLower.includes(role)) {
        return false;
      }
    }

    // 4. Category filter
    if (category && category !== "ALL") {
      const keywords = CATEGORY_KEYWORDS_MAP[category];
      if (keywords && keywords.length > 0) {
        const titleLower = opp.title.toLowerCase();
        const matchesCategory = keywords.some((kw) => titleLower.includes(kw.toLowerCase()));
        if (!matchesCategory) {
          return false;
        }
      }
    }

    // 5. Skills filter
    if (skillFilterTerms.length > 0) {
      const oppSkillsStr = (Array.isArray(opp.skills) ? opp.skills.join(" ") : String(opp.skills || "")).toLowerCase();
      const oppDescStr = opp.description.toLowerCase();
      const matchesAnySkill = skillFilterTerms.some(
        (sk) => oppSkillsStr.includes(sk) || oppDescStr.includes(sk)
      );
      if (!matchesAnySkill) {
        return false;
      }
    }

    // 6. Work mode filter
    if (workMode && workMode !== "ANY") {
      if (opp.workMode !== workMode) {
        return false;
      }
    }

    // 7. Experience level filter
    if (experienceLevel && experienceLevel !== "ANY") {
      if (opp.experienceLevel !== experienceLevel) {
        return false;
      }
    }

    // 8. Posted date filter
    if (postedWithinDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - postedWithinDays);
      const targetDate = new Date(opp.lastVerifiedAt || opp.firstSeenAt || 0);
      if (targetDate.getTime() < cutoff.getTime()) {
        return false;
      }
    }

    return true;
  };

  // 1. Try Redis Sliding-Window Cache
  try {
    const isAvailable = await isRedisCircuitAvailable().catch(() => false);
    if (isAvailable) {
      const redis = getSharedRedisClient();
      const totalInRedis = await redis.zcard(REDIS_OPP_ZSET_KEY);

      if (totalInRedis === 0) {
        await primeOpportunityCacheFromDb();
      }

      const rawValues = await redis.hvals(REDIS_OPP_DATA_KEY);
      if (rawValues && rawValues.length > 0) {
        const candidates: CachedOpportunityItem[] = [];
        for (const raw of rawValues) {
          try {
            const parsed = JSON.parse(raw);
            if (matchesOpportunity(parsed)) {
              candidates.push(parsed);
            }
          } catch {}
        }

        candidates.sort((a, b) => {
          if (sort === "salary") {
            return (b.salaryMax || 0) - (a.salaryMax || 0);
          }
          if (sort === "oldest") {
            const timeA = new Date(a.firstSeenAt || 0).getTime();
            const timeB = new Date(b.firstSeenAt || 0).getTime();
            return timeA - timeB;
          }
          const timeA = new Date(a.lastVerifiedAt || a.firstSeenAt || 0).getTime();
          const timeB = new Date(b.lastVerifiedAt || b.firstSeenAt || 0).getTime();
          return timeB - timeA;
        });

        const total = candidates.length;
        const startIndex = (page - 1) * limit;
        const paginated = candidates.slice(startIndex, startIndex + limit);

        return {
          items: paginated,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          source: "redis",
        };
      }
    }
  } catch (redisErr) {
    console.warn("[RedisOpportunityCache] Redis query error, falling back to memory:", redisErr);
  }

  // 2. Fallback to In-Memory Sliding Window Cache
  if (inMemoryCache.size > 0) {
    const candidates: CachedOpportunityItem[] = [];
    for (const opp of inMemoryCache.values()) {
      if (matchesOpportunity(opp)) {
        candidates.push(opp);
      }
    }

    candidates.sort((a, b) => {
      if (sort === "salary") {
        return (b.salaryMax || 0) - (a.salaryMax || 0);
      }
      if (sort === "oldest") {
        return new Date(a.firstSeenAt || 0).getTime() - new Date(b.firstSeenAt || 0).getTime();
      }
      return new Date(b.lastVerifiedAt || b.firstSeenAt || 0).getTime() - new Date(a.lastVerifiedAt || a.firstSeenAt || 0).getTime();
    });

    const total = candidates.length;
    const startIndex = (page - 1) * limit;
    const paginated = candidates.slice(startIndex, startIndex + limit);

    return {
      items: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      source: "memory",
    };
  }

  // 3. Fallback to PostgreSQL Main Database
  const where: any = {
    status: "ACTIVE",
  };
  if (workMode && workMode !== "ANY") where.workMode = workMode;
  if (experienceLevel && experienceLevel !== "ANY") where.experienceLevel = experienceLevel;
  if (postedWithinDays) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - postedWithinDays);
    where.lastVerifiedAt = { gte: cutoff };
  }
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { skills: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role) {
    where.title = { contains: role, mode: "insensitive" };
  }
  if (category && category !== "ALL") {
    const keywords = CATEGORY_KEYWORDS_MAP[category];
    if (keywords && keywords.length > 0) {
      const catConditions = keywords.map((k) => ({
        title: { contains: k, mode: "insensitive" as const },
      }));
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: catConditions }];
        delete where.OR;
      } else {
        where.OR = catConditions;
      }
    }
  }

  let orderBy: any = { lastVerifiedAt: "desc" };
  if (sort === "salary") orderBy = { salaryMax: "desc" };
  else if (sort === "oldest") orderBy = { firstSeenAt: "asc" };

  const total = await prisma.opportunity.count({ where });
  const dbOpps = await prisma.opportunity.findMany({
    where,
    orderBy,
    skip: (page - 1) * limit,
    take: limit,
    include: {
      sourceListings: {
        select: {
          sourcePlatform: true,
          applyUrl: true,
          verificationStatus: true,
          rawSnippet: true,
          seenAt: true,
        },
        take: 3,
      },
      companyContacts: {
        select: {
          id: true,
          fullName: true,
          roleTitle: true,
          department: true,
          profileUrl: true,
          email: true,
          personalEmail: true,
          phone: true,
          isVerified: true,
          sourcePlatform: true,
        },
        take: 5,
      },
    },
  });

  const normalizedItems = dbOpps.map((opp) => normalizeOpportunityForCache(opp));

  syncBatchOpportunitiesToRedisCache(normalizedItems).catch(() => {});

  return {
    items: normalizedItems,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
    source: "database",
  };
}
