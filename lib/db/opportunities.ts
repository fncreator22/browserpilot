/**
 * §OPPORTUNITY & SEARCH DATABASE ACCESS LAYER (DAL)
 * Provides atomic, type-safe, non-destructive persistence between search discovery engines
 * and canonical Opportunity, SourceListing, Search, and SavedOpportunity entities.
 */

import { prisma } from "./prisma";
import type { Opportunity, SourceListing, Search, SearchResult, SavedOpportunity } from "@prisma/client";

export interface UpsertOpportunityInput {
  id?: string;
  canonicalHash: string;
  title: string;
  companyName: string;
  location: string;
  workMode?: "REMOTE" | "HYBRID" | "ON_SITE" | "ANY" | string;
  experienceLevel?: "INTERN" | "ENTRY_LEVEL" | "MID" | string;
  opportunityType?: "INTERNSHIP" | "FULL_TIME" | "CONTRACT" | string;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string | null;
  description: string;
  requirements?: string[] | string;
  skills?: string[] | string;
  primaryApplyUrl: string;
  status?: "ACTIVE" | "STALE" | "EXPIRED" | string;
  lastVerifiedAt?: Date;
}

export interface UpsertSourceListingInput {
  opportunityId: string;
  sourcePlatform: string;
  externalJobId?: string | null;
  sourceUrl: string;
  applyUrl: string;
  screenshotPath?: string | null;
  verificationStatus?: "VERIFIED" | "RECENTLY_SEEN" | "UNVERIFIED" | "EXPIRED" | string;
  rawSnippet?: string | null;
}

export interface CreateSearchInput {
  id?: string;
  userId?: string | null;
  rawQuery: string;
  canonicalIntentHash?: string | null;
  canonicalIntent?: string | null;
  intentType?: string;
  parsedRole?: string | null;
  parsedSkills?: string[] | string;
  parsedLocation?: string | null;
  parsedWorkMode?: string;
  targetGradYear?: number | null;
  status?: string;
  totalFound?: number;
  startedAt?: Date | null;
  completedAt?: Date | null;
  cancellationRequested?: boolean;
  stoppingReason?: string | null;
  failureReason?: string | null;
  isRecoverable?: boolean;
}

export interface AttachSearchResultInput {
  searchId: string;
  opportunityId: string;
  matchScore?: number;
  rankPosition?: number;
}

/**
 * Normalizes input arrays to JSON strings without fabricating data
 */
function serializeStringArray(val?: string[] | string | null): string {
  if (!val) return "[]";
  if (Array.isArray(val)) return JSON.stringify(val);
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch {
      return JSON.stringify([val]);
    }
  }
  return "[]";
}

/**
 * Applies safe non-destructive update merge logic on an existing Opportunity
 */
async function applySafeOpportunityUpdate(
  existing: Opportunity,
  data: UpsertOpportunityInput,
  reqString: string,
  skillsString: string,
  txPrisma: typeof prisma
): Promise<Opportunity> {
  const updatePayload: Record<string, unknown> = {
    lastVerifiedAt: new Date(),
    status: data.status || existing.status || "ACTIVE",
  };

  if (data.title && data.title.trim().length > 0) {
    updatePayload.title = data.title;
  }
  if (data.companyName && data.companyName.trim().length > 0) {
    updatePayload.companyName = data.companyName;
  }
  if (data.location && data.location.trim().length > 0) {
    updatePayload.location = data.location;
  }
  if (data.workMode && data.workMode !== "ANY") {
    updatePayload.workMode = data.workMode;
  }
  if (data.experienceLevel) {
    updatePayload.experienceLevel = data.experienceLevel;
  }
  if (data.opportunityType) {
    updatePayload.opportunityType = data.opportunityType;
  }
  if (typeof data.salaryMin === "number" && data.salaryMin > 0) {
    updatePayload.salaryMin = data.salaryMin;
  }
  if (typeof data.salaryMax === "number" && data.salaryMax > 0) {
    updatePayload.salaryMax = data.salaryMax;
  }
  if (data.salaryCurrency) {
    updatePayload.salaryCurrency = data.salaryCurrency;
  }
  if (data.description && data.description.trim().length > 0) {
    updatePayload.description = data.description;
  }
  if (reqString && reqString !== "[]") {
    updatePayload.requirements = reqString;
  }
  if (skillsString && skillsString !== "[]") {
    updatePayload.skills = skillsString;
  }
  if (data.primaryApplyUrl && data.primaryApplyUrl.trim().length > 0) {
    updatePayload.primaryApplyUrl = data.primaryApplyUrl;
  }

  return await txPrisma.opportunity.update({
    where: { id: existing.id },
    data: updatePayload,
  });
}

export const SYNTHETIC_OPPORTUNITY_PATTERNS = [
  /leading organization/i,
  /leading employer/i,
  /job_5001/i,
  /boards\.ashby\.io/i,
  /placeholder company/i,
  /mock company/i,
  /example company/i,
  /synthetic candidate/i,
  /test candidate/i,
  /sample employer/i,
  /fake company/i,
];

export function detectSyntheticOpportunity(data: {
  title?: string | null;
  companyName?: string | null;
  primaryApplyUrl?: string | null;
  description?: string | null;
  requirements?: string | string[] | null;
}): { isSynthetic: boolean; reason?: string } {
  const fields = [
    { name: "title", val: data.title },
    { name: "companyName", val: data.companyName },
    { name: "primaryApplyUrl", val: data.primaryApplyUrl },
    { name: "description", val: data.description },
  ];

  for (const { name, val } of fields) {
    if (!val) continue;
    const str = String(val).toLowerCase();
    for (const pattern of SYNTHETIC_OPPORTUNITY_PATTERNS) {
      if (pattern.test(str)) {
        return {
          isSynthetic: true,
          reason: `Opportunity ${name} matched synthetic pattern "${pattern.source}"`,
        };
      }
    }
  }

  return { isSynthetic: false };
}

/**
 * Atomic Upsert for Canonical Opportunity.
 * Employs safe merge semantics and concurrency collision protection:
 * non-empty incoming data updates mutable fields, while missing or empty values
 * preserve high-quality existing stored data.
 */
export async function upsertOpportunity(
  data: UpsertOpportunityInput,
  txPrisma: typeof prisma = prisma
): Promise<Opportunity> {
  if (!data.canonicalHash || typeof data.canonicalHash !== "string" || data.canonicalHash.trim().length === 0) {
    throw new Error("Cannot upsert opportunity without valid canonicalHash");
  }

  // TASK-064: Database Persistence Firewall
  // Hard block: Reject any opportunity containing synthetic patterns from ever being persisted.
  const syntheticCheck = detectSyntheticOpportunity(data);
  if (syntheticCheck.isSynthetic) {
    throw new Error(`Cannot upsert synthetic opportunity: ${syntheticCheck.reason}`);
  }

  const reqString = serializeStringArray(data.requirements);
  const skillsString = serializeStringArray(data.skills);

  const existing = await txPrisma.opportunity.findUnique({
    where: { canonicalHash: data.canonicalHash },
  });

  if (!existing) {
    try {
      return await txPrisma.opportunity.create({
        data: {
          id: data.id,
          canonicalHash: data.canonicalHash,
          title: data.title,
          companyName: data.companyName,
          location: data.location,
          workMode: data.workMode || "ANY",
          experienceLevel: data.experienceLevel || "ENTRY_LEVEL",
          opportunityType: data.opportunityType || "FULL_TIME",
          salaryMin: typeof data.salaryMin === "number" ? data.salaryMin : null,
          salaryMax: typeof data.salaryMax === "number" ? data.salaryMax : null,
          salaryCurrency: data.salaryCurrency || "USD",
          description: data.description || "",
          requirements: reqString,
          skills: skillsString,
          primaryApplyUrl: data.primaryApplyUrl,
          status: data.status || "ACTIVE",
          firstSeenAt: new Date(),
          lastVerifiedAt: data.lastVerifiedAt || new Date(),
        },
      });
    } catch {
      // Concurrency protection: if another concurrent thread created this record first, fall back to safe update
      const raceExisting = await prisma.opportunity.findUnique({
        where: { canonicalHash: data.canonicalHash },
      }).catch(() => null);

      if (raceExisting) {
        return await applySafeOpportunityUpdate(raceExisting, data, reqString, skillsString, prisma);
      }
    }
  }

  const targetRecord = existing || (await prisma.opportunity.findUnique({ where: { canonicalHash: data.canonicalHash } }).catch(() => null));
  if (!targetRecord) {
    // If neither exists, attempt direct create as ultimate fallback
    return await prisma.opportunity.create({
      data: {
        id: data.id,
        canonicalHash: data.canonicalHash,
        title: data.title,
        companyName: data.companyName,
        location: data.location,
        workMode: data.workMode || "ANY",
        experienceLevel: data.experienceLevel || "ENTRY_LEVEL",
        opportunityType: data.opportunityType || "FULL_TIME",
        salaryMin: typeof data.salaryMin === "number" ? data.salaryMin : null,
        salaryMax: typeof data.salaryMax === "number" ? data.salaryMax : null,
        salaryCurrency: data.salaryCurrency || "USD",
        description: data.description || "",
        requirements: reqString,
        skills: skillsString,
        primaryApplyUrl: data.primaryApplyUrl,
        status: data.status || "ACTIVE",
        firstSeenAt: new Date(),
        lastVerifiedAt: data.lastVerifiedAt || new Date(),
      },
    });
  }

  return await applySafeOpportunityUpdate(targetRecord, data, reqString, skillsString, txPrisma);
}

/**
 * Atomic Upsert for SourceListing.
 * Respects composite unique identity on [sourcePlatform, sourceUrl].
 */
export async function upsertSourceListing(
  data: UpsertSourceListingInput,
  txPrisma: typeof prisma = prisma
): Promise<SourceListing> {
  if (!data.opportunityId || !data.sourcePlatform || !data.sourceUrl) {
    throw new Error("Missing required source listing identity fields (opportunityId, sourcePlatform, sourceUrl)");
  }

  return await txPrisma.sourceListing.upsert({
    where: {
      sourcePlatform_sourceUrl: {
        sourcePlatform: data.sourcePlatform,
        sourceUrl: data.sourceUrl,
      },
    },
    update: {
      opportunityId: data.opportunityId,
      applyUrl: data.applyUrl || undefined,
      externalJobId: data.externalJobId || undefined,
      screenshotPath: data.screenshotPath || undefined,
      verificationStatus: data.verificationStatus || "VERIFIED",
      rawSnippet: data.rawSnippet || undefined,
      seenAt: new Date(),
    },
    create: {
      opportunityId: data.opportunityId,
      sourcePlatform: data.sourcePlatform,
      externalJobId: data.externalJobId || null,
      sourceUrl: data.sourceUrl,
      applyUrl: data.applyUrl,
      screenshotPath: data.screenshotPath || null,
      verificationStatus: data.verificationStatus || "VERIFIED",
      rawSnippet: data.rawSnippet || null,
      seenAt: new Date(),
    },
  });
}

/**
 * Records a discovered opportunity and attaches its source listing in a single atomic transaction.
 */
export async function recordDiscoveredOpportunity(
  opportunityData: UpsertOpportunityInput,
  sourceListingData: Omit<UpsertSourceListingInput, "opportunityId">
): Promise<{ opportunity: Opportunity; sourceListing: SourceListing }> {
  return await prisma.$transaction(async (tx) => {
    const opp = await upsertOpportunity(opportunityData, tx as typeof prisma);
    const listing = await upsertSourceListing(
      {
        ...sourceListingData,
        opportunityId: opp.id,
      },
      tx as typeof prisma
    );

    return { opportunity: opp, sourceListing: listing };
  });
}

/**
 * Creates a persistent Search session record with execution lifecycle support.
 */
export async function createSearch(data: CreateSearchInput): Promise<Search> {
  const isCancelledInProcess = Boolean(
    data.id && (
      (globalThis as any).__browserpilot_cancelled_executions?.has(data.id) ||
      (globalThis as any).__browserpilot_revoked_execution_keys?.has(data.id) ||
      (globalThis as any).__browserpilot_active_abort_controllers?.get(data.id)?.signal?.aborted
    )
  );

  let verifiedUserId: string | null = null;
  if (data.userId && !data.userId.startsWith("guest_")) {
    try {
      let existingUser = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true },
      });
      if (!existingUser && data.userId.includes("@")) {
        existingUser = await prisma.user.findUnique({
          where: { email: data.userId.toLowerCase().trim() },
          select: { id: true },
        });
      }
      if (existingUser) {
        verifiedUserId = existingUser.id;
      }
    } catch {
      verifiedUserId = null;
    }
  }

  if (data.id) {
    const existing = await prisma.search.findUnique({
      where: { id: data.id },
    });
    if (existing) {
      if (existing.status === "STOPPED" || existing.cancellationRequested || isCancelledInProcess) {
        // Return existing STOPPED record without resurrecting to QUEUED
        return existing;
      }
    }
  }

  const initialStatus = isCancelledInProcess ? "STOPPED" : (data.status || "COMPLETED");
  const cancellationRequested = isCancelledInProcess || Boolean(data.cancellationRequested);
  const stoppingReason = isCancelledInProcess ? "CANCELLED_BY_USER" : (data.stoppingReason || null);

  if (data.id) {
    return await prisma.search.upsert({
      where: { id: data.id },
      create: {
        id: data.id,
        userId: verifiedUserId,
        rawQuery: data.rawQuery,
        canonicalIntentHash: data.canonicalIntentHash || null,
        canonicalIntent: data.canonicalIntent || null,
        intentType: data.intentType || "JOB_SEARCH_GENERAL",
        parsedRole: data.parsedRole || null,
        parsedSkills: serializeStringArray(data.parsedSkills),
        parsedLocation: data.parsedLocation || null,
        parsedWorkMode: data.parsedWorkMode || "ANY",
        targetGradYear: typeof data.targetGradYear === "number" ? data.targetGradYear : null,
        status: initialStatus,
        totalFound: isCancelledInProcess ? 0 : (typeof data.totalFound === "number" ? data.totalFound : 0),
        startedAt: data.startedAt || (initialStatus === "RUNNING" ? new Date() : null),
        completedAt: initialStatus === "STOPPED" ? new Date() : (data.completedAt || null),
        cancellationRequested,
        stoppingReason,
        failureReason: data.failureReason || null,
        isRecoverable: data.isRecoverable || false,
      },
      update: {
        status: isCancelledInProcess ? "STOPPED" : undefined,
        cancellationRequested: isCancelledInProcess ? true : undefined,
        stoppingReason: isCancelledInProcess ? "CANCELLED_BY_USER" : undefined,
        totalFound: isCancelledInProcess ? 0 : undefined,
        completedAt: isCancelledInProcess ? new Date() : undefined,
      },
    });
  }

  return await prisma.search.create({
    data: {
      userId: verifiedUserId,
      rawQuery: data.rawQuery,
      canonicalIntentHash: data.canonicalIntentHash || null,
      canonicalIntent: data.canonicalIntent || null,
      intentType: data.intentType || "JOB_SEARCH_GENERAL",
      parsedRole: data.parsedRole || null,
      parsedSkills: serializeStringArray(data.parsedSkills),
      parsedLocation: data.parsedLocation || null,
      parsedWorkMode: data.parsedWorkMode || "ANY",
      targetGradYear: typeof data.targetGradYear === "number" ? data.targetGradYear : null,
      status: initialStatus,
      totalFound: typeof data.totalFound === "number" ? data.totalFound : 0,
      startedAt: data.startedAt || (initialStatus === "RUNNING" ? new Date() : null),
      completedAt: initialStatus === "STOPPED" ? new Date() : (data.completedAt || null),
      cancellationRequested,
      stoppingReason,
      failureReason: data.failureReason || null,
      isRecoverable: data.isRecoverable || false,
    },
  });
}

/**
 * Updates search status atomically using Compare-and-Swap semantics.
 * Returns true if the transition succeeded, false if current status was not in fromStatus.
 */
export async function updateSearchStatusCas(
  id: string,
  fromStatus: string | string[],
  toStatus: string,
  updates?: Partial<{
    stoppingReason: string | null;
    failureReason: string | null;
    completedAt: Date | null;
    totalFound: number;
    isRecoverable: boolean;
    cancellationRequested: boolean;
  }>
): Promise<boolean> {
  const allowedFrom = Array.isArray(fromStatus) ? fromStatus : [fromStatus];
  const result = await prisma.search.updateMany({
    where: {
      id,
      status: { in: allowedFrom },
    },
    data: {
      status: toStatus,
      updatedAt: new Date(),
      ...(updates || {}),
    },
  });
  return result.count > 0;
}

/**
 * Touches search heartbeat updatedAt timestamp to prevent stale detection.
 */
export async function touchSearchHeartbeat(id: string): Promise<void> {
  await prisma.search.updateMany({
    where: { id, status: "RUNNING" },
    data: { updatedAt: new Date() },
  });
}

/**
 * Finds an active running search for a given user and optional canonical intent hash.
 */
export async function getActiveUserSearch(
  userId: string,
  canonicalIntentHash?: string
): Promise<Search | null> {
  const whereClause: any = {
    userId,
    status: { in: ["CREATED", "QUEUED", "RUNNING"] },
  };
  if (canonicalIntentHash) {
    whereClause.canonicalIntentHash = canonicalIntentHash;
  }
  return await prisma.search.findFirst({
    where: whereClause,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Attaches an Opportunity to a Search with relevance matchScore and rankPosition.
 * Idempotent: updates ranking if the association already exists.
 */
export async function attachOpportunityToSearch(
  input: AttachSearchResultInput,
  txPrisma: typeof prisma = prisma
): Promise<SearchResult> {
  return await txPrisma.searchResult.upsert({
    where: {
      searchId_opportunityId: {
        searchId: input.searchId,
        opportunityId: input.opportunityId,
      },
    },
    update: {
      matchScore: typeof input.matchScore === "number" ? input.matchScore : 0.0,
      rankPosition: typeof input.rankPosition === "number" ? input.rankPosition : 0,
    },
    create: {
      searchId: input.searchId,
      opportunityId: input.opportunityId,
      matchScore: typeof input.matchScore === "number" ? input.matchScore : 0.0,
      rankPosition: typeof input.rankPosition === "number" ? input.rankPosition : 0,
    },
  });
}

/**
 * Saves (bookmarks) an opportunity for an authenticated user. Idempotent.
 */
export async function saveOpportunity(
  userId: string,
  opportunityId: string,
  notes?: string | null
): Promise<SavedOpportunity> {
  if (!userId || !opportunityId) {
    throw new Error("userId and opportunityId are required to save an opportunity");
  }

  return await prisma.savedOpportunity.upsert({
    where: {
      userId_opportunityId: {
        userId,
        opportunityId,
      },
    },
    update: {
      notes: notes !== undefined ? notes : undefined,
    },
    create: {
      userId,
      opportunityId,
      notes: notes || null,
    },
  });
}

/**
 * Removes (un-bookmarks) an opportunity for an authenticated user. Idempotent.
 */
export async function unsaveOpportunity(
  userId: string,
  opportunityId: string
): Promise<{ deleted: boolean }> {
  if (!userId || !opportunityId) {
    throw new Error("userId and opportunityId are required to unsave an opportunity");
  }

  try {
    const existing = await prisma.savedOpportunity.findUnique({
      where: {
        userId_opportunityId: {
          userId,
          opportunityId,
        },
      },
    });
    if (!existing) {
      return { deleted: false };
    }
    await prisma.savedOpportunity.delete({
      where: {
        userId_opportunityId: {
          userId,
          opportunityId,
        },
      },
    });
    return { deleted: true };
  } catch {
    // Record was already deleted or did not exist (idempotent success)
    return { deleted: false };
  }
}

/**
 * Checks if an opportunity is bookmarked by a user.
 */
export async function isOpportunitySaved(
  userId: string,
  opportunityId: string
): Promise<boolean> {
  if (!userId || !opportunityId) return false;
  const existing = await prisma.savedOpportunity.findUnique({
    where: {
      userId_opportunityId: {
        userId,
        opportunityId,
      },
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Retrieves all saved opportunities for an authenticated user with full metadata.
 */
export async function getSavedOpportunities(userId: string) {
  if (!userId) return [];
  return await prisma.savedOpportunity.findMany({
    where: { userId },
    include: {
      opportunity: {
        include: {
          sourceListings: {
            orderBy: { seenAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Retrieves a canonical opportunity by its unique ID.
 */
export async function getOpportunityById(id: string): Promise<Opportunity | null> {
  if (!id) return null;
  return await prisma.opportunity.findUnique({
    where: { id },
  });
}

/**
 * Retrieves a canonical opportunity by its unique canonical hash.
 */
export async function getOpportunityByCanonicalHash(canonicalHash: string): Promise<Opportunity | null> {
  if (!canonicalHash) return null;
  return await prisma.opportunity.findUnique({
    where: { canonicalHash },
  });
}

/**
 * Retrieves a canonical opportunity with all attached source listings by either ID or canonical hash.
 */
export async function getOpportunityWithSourceListings(idOrHash: string) {
  if (!idOrHash) return null;
  const byId = await prisma.opportunity.findUnique({
    where: { id: idOrHash },
    include: {
      sourceListings: {
        orderBy: { seenAt: "desc" },
      },
    },
  });
  if (byId) return byId;

  return await prisma.opportunity.findUnique({
    where: { canonicalHash: idOrHash },
    include: {
      sourceListings: {
        orderBy: { seenAt: "desc" },
      },
    },
  });
}

/**
 * Retrieves all ranked search results for a given search session.
 */
export async function getSearchResults(searchId: string) {
  if (!searchId) return [];
  return await prisma.searchResult.findMany({
    where: { searchId },
    include: {
      opportunity: {
        include: {
          sourceListings: true,
        },
      },
    },
    orderBy: { rankPosition: "asc" },
  });
}

/**
 * Updates the canonical lifecycle status and lastVerifiedAt timestamp for an opportunity.
 */
export async function updateOpportunityStatus(id: string, status: string, lastVerifiedAt: Date = new Date()) {
  if (!id) return null;
  return await prisma.opportunity.update({
    where: { id },
    data: { status, lastVerifiedAt },
  });
}

/**
 * Retrieves an authenticated user's previous search discovery history.
 */
export async function getUserSearches(userId: string, limit = 50) {
  if (!userId) return [];
  return await prisma.search.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Retrieves a historical search session with its persisted results and attached opportunities.
 * Enforces strict multi-tenant authorization check.
 */
export async function getSearchSession(searchId: string, userId?: string | null) {
  if (!searchId) return null;
  const search = await prisma.search.findUnique({
    where: { id: searchId },
    include: {
      results: {
        include: {
          opportunity: {
            include: {
              sourceListings: {
                orderBy: { seenAt: "desc" },
              },
            },
          },
        },
        orderBy: { rankPosition: "asc" },
      },
    },
  });

  if (!search) return null;

  // Enforce strict multi-tenant isolation: require ownership match
  if (!search.userId || !userId || search.userId !== userId) {
    return null;
  }

  return search;
}

/**
 * Deletes a search session and its attached search results.
 * Strictly verifies that the authenticated user owns the search.
 */
export async function deleteSearchSession(searchId: string, userId: string): Promise<{ deleted: boolean }> {
  if (!searchId || !userId) return { deleted: false };

  const existing = await prisma.search.findUnique({
    where: { id: searchId },
    select: { id: true, userId: true },
  });

  if (!existing || existing.userId !== userId) {
    return { deleted: false };
  }

  await prisma.searchResult.deleteMany({
    where: { searchId },
  });

  await prisma.search.delete({
    where: { id: searchId },
  });

  return { deleted: true };
}

/**
 * Persists a lifecycle alert with deterministic idempotency.
 * If an alert with the same idempotency key exists, it returns the existing record without creating duplicates.
 */
export async function recordLifecycleAlert(input: {
  userId: string;
  opportunityId?: string | null;
  transitionType: string;
  previousStatus: string;
  newStatus: string;
  title: string;
  companyName: string;
  message: string;
  idempotencyKey?: string;
}) {
  const oppKey = input.opportunityId || "global";
  const idempotencyKey =
    input.idempotencyKey ||
    `${input.userId}_${oppKey}_${input.transitionType}_${input.newStatus}`;

  const existing = await prisma.lifecycleAlert.findUnique({
    where: { idempotencyKey },
  });

  if (existing) {
    return { alert: existing, created: false };
  }

  try {
    const created = await prisma.lifecycleAlert.create({
      data: {
        userId: input.userId,
        opportunityId: input.opportunityId || null,
        transitionType: input.transitionType,
        previousStatus: input.previousStatus,
        newStatus: input.newStatus,
        title: input.title,
        companyName: input.companyName,
        message: input.message,
        idempotencyKey,
      },
    });
    return { alert: created, created: true };
  } catch (err: unknown) {
    // Handle race condition gracefully
    const fallback = await prisma.lifecycleAlert.findUnique({
      where: { idempotencyKey },
    });
    if (fallback) return { alert: fallback, created: false };
    throw err;
  }
}

/**
 * Retrieves lifecycle notifications/alerts for an authenticated user.
 */
export async function getUserLifecycleAlerts(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {}
) {
  if (!userId) return [];
  const limit = options.limit || 50;
  return await prisma.lifecycleAlert.findMany({
    where: {
      userId,
      ...(options.unreadOnly ? { isRead: false } : {}),
    },
    include: {
      opportunity: {
        include: {
          sourceListings: {
            orderBy: { seenAt: "desc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Marks a specific lifecycle alert as read with strict multi-tenant ownership check.
 */
export async function markAlertAsRead(alertId: string, userId: string): Promise<boolean> {
  if (!alertId || !userId) return false;
  const existing = await prisma.lifecycleAlert.findUnique({
    where: { id: alertId },
  });
  if (!existing || existing.userId !== userId) {
    return false;
  }
  await prisma.lifecycleAlert.update({
    where: { id: alertId },
    data: { isRead: true },
  });
  return true;
}

/**
 * Marks all lifecycle alerts for a user as read.
 */
export async function markAllAlertsAsRead(userId: string): Promise<number> {
  if (!userId) return 0;
  const res = await prisma.lifecycleAlert.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return res.count;
}

/**
 * Gets the count of unread alerts for a user.
 */
export async function getUnreadAlertCount(userId: string): Promise<number> {
  if (!userId) return 0;
  return await prisma.lifecycleAlert.count({
    where: { userId, isRead: false },
  });
}

export interface DiscoveryWatchConfig {
  id?: string;
  name?: string;
  enabled: boolean;
  roles: string[];
  skills: string[];
  locations: string[];
  companies: string[];
  workModes: string[];
  experienceLevels: string[];
  opportunityTypes: string[];
  preferredSources: string[];
  minimumMatchScore: number;
  latestOnly: boolean;
  freshnessWindowHours: number;
  scanIntervalHours: number;
  lastScannedAt?: Date | null;
  nextScanAt?: Date | null;
  lockedAt?: Date | null;
  lockOwner?: string | null;
}

/**
 * Robust utility to parse string arrays from Prisma JSON strings, double-encoded strings,
 * or native arrays, guaranteeing an array of strings is returned.
 */
export function safeParseStringArray(val: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(val)) {
    return val.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
  }
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  if (!trimmed || trimmed === "[]") return fallback;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
    }
    if (typeof parsed === "string") {
      try {
        const nested = JSON.parse(parsed);
        if (Array.isArray(nested)) {
          return nested.map((item) => (typeof item === "string" ? item : String(item))).filter(Boolean);
        }
      } catch {}
      return parsed ? [parsed] : fallback;
    }
  } catch {
    if (trimmed.includes(",")) {
      return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return fallback;
}

/**
 * Gets or creates the default discovery watch configuration for a user.
 */
export async function getDiscoveryWatch(userId: string, watchId?: string): Promise<DiscoveryWatchConfig> {
  if (!userId) {
    return {
      enabled: false,
      roles: [],
      skills: [],
      locations: [],
      companies: [],
      workModes: [],
      experienceLevels: [],
      opportunityTypes: [],
      preferredSources: ["LinkedIn", "Y Combinator", "Indeed"],
      minimumMatchScore: 70,
      latestOnly: false,
      freshnessWindowHours: 48,
      scanIntervalHours: 6,
      lastScannedAt: null,
      nextScanAt: null,
      lockedAt: null,
      lockOwner: null,
    };
  }

  const existing = watchId
    ? await prisma.discoveryWatch.findFirst({ where: { id: watchId, userId } })
    : await prisma.discoveryWatch.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });

  const profile = await prisma.userProfile.findUnique({ where: { userId } }).catch(() => null);
  const profileRoles = safeParseStringArray(profile?.preferredRoles);
  const profileSkills = safeParseStringArray(profile?.targetSkills);
  const profileLocations = safeParseStringArray(profile?.preferredLocations);
  const profileWorkModes = safeParseStringArray(profile?.preferredWorkModes, ["REMOTE", "HYBRID"]);

  if (existing) {
    const parsedRoles = safeParseStringArray(existing.roles);
    const parsedSkills = safeParseStringArray(existing.skills);
    const parsedLocations = safeParseStringArray(existing.locations);
    const parsedWorkModes = safeParseStringArray(existing.workModes);

    const effectiveRoles = parsedRoles.length > 0 ? parsedRoles : profileRoles;
    const effectiveSkills = parsedSkills.length > 0 ? parsedSkills : profileSkills;
    const rawLocations = parsedLocations.length > 0 ? parsedLocations : profileLocations;
    const rawWorkModes = parsedWorkModes.length > 0 ? parsedWorkModes : profileWorkModes;

    const hasRemoteInLocations = rawLocations.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
    const effectiveLocations = rawLocations.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
    const effectiveWorkModes = hasRemoteInLocations && !rawWorkModes.includes("REMOTE") ? [...rawWorkModes, "REMOTE"] : rawWorkModes;

    return {
      id: existing.id,
      name: (existing as any).name || "Autonomous Watch",
      enabled: existing.enabled,
      roles: effectiveRoles,
      skills: effectiveSkills,
      locations: effectiveLocations,
      companies: safeParseStringArray((existing as any).companies),
      workModes: effectiveWorkModes,
      experienceLevels: safeParseStringArray(existing.experienceLevels),
      opportunityTypes: safeParseStringArray(existing.opportunityTypes),
      preferredSources: safeParseStringArray(existing.preferredSources, ["Ashby", "Greenhouse", "Lever", "LinkedIn"]),
      minimumMatchScore: existing.minimumMatchScore,
      latestOnly: existing.latestOnly,
      freshnessWindowHours: existing.freshnessWindowHours,
      scanIntervalHours: existing.scanIntervalHours,
      lastScannedAt: existing.lastScannedAt,
      nextScanAt: existing.nextScanAt,
      lockedAt: existing.lockedAt,
      lockOwner: existing.lockOwner,
    };
  }

  // Verify user exists in the database before attempting to create to avoid foreign key violation
  let userExists = false;
  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    userExists = Boolean(userRecord);
  } catch (checkErr) {
    console.warn(`[getDiscoveryWatch] Failed to check user existence for ${userId}:`, checkErr);
  }

  if (!userExists) {
    return {
      id: `virtual_watch_${userId}`,
      name: "Autonomous Watch",
      enabled: true,
      roles: profileRoles,
      skills: profileSkills,
      locations: profileLocations,
      companies: [],
      workModes: profileWorkModes,
      experienceLevels: ["INTERN", "ENTRY_LEVEL"],
      opportunityTypes: ["INTERNSHIP", "FULL_TIME"],
      preferredSources: ["LinkedIn", "Y Combinator", "Indeed", "Greenhouse", "Ashby", "Lever"],
      minimumMatchScore: 70,
      latestOnly: false,
      freshnessWindowHours: 48,
      scanIntervalHours: 6,
      lastScannedAt: null,
      nextScanAt: null,
      lockedAt: null,
      lockOwner: null,
    };
  }

  // Create default watch config hydrated from Career Memory (default enabled)
  let created: any;
  try {
    created = await prisma.discoveryWatch.create({
      data: {
        userId,
        name: "Autonomous Watch",
        enabled: true,
        roles: JSON.stringify(profileRoles),
        skills: JSON.stringify(profileSkills),
        locations: JSON.stringify(profileLocations),
        companies: JSON.stringify([]),
        workModes: JSON.stringify(profileWorkModes),
        experienceLevels: JSON.stringify(["INTERN", "ENTRY_LEVEL"]),
        opportunityTypes: JSON.stringify(["INTERNSHIP", "FULL_TIME"]),
        preferredSources: JSON.stringify(["LinkedIn", "Y Combinator", "Indeed", "Greenhouse", "Ashby", "Lever"]),
        minimumMatchScore: 70,
        latestOnly: false,
        freshnessWindowHours: 48,
        scanIntervalHours: 6,
      },
    });
  } catch (createErr) {
    console.warn(`[getDiscoveryWatch] Failed to create watch record for ${userId}:`, createErr);
    return {
      id: `virtual_watch_${userId}`,
      name: "Autonomous Watch",
      enabled: true,
      roles: profileRoles,
      skills: profileSkills,
      locations: profileLocations,
      companies: [],
      workModes: profileWorkModes,
      experienceLevels: ["INTERN", "ENTRY_LEVEL"],
      opportunityTypes: ["INTERNSHIP", "FULL_TIME"],
      preferredSources: ["LinkedIn", "Y Combinator", "Indeed", "Greenhouse", "Ashby", "Lever"],
      minimumMatchScore: 70,
      latestOnly: false,
      freshnessWindowHours: 48,
      scanIntervalHours: 6,
      lastScannedAt: null,
      nextScanAt: null,
      lockedAt: null,
      lockOwner: null,
    };
  }

  return {
    id: created.id,
    name: (created as any).name || "Autonomous Watch",
    enabled: created.enabled,
    roles: safeParseStringArray(created.roles),
    skills: safeParseStringArray(created.skills),
    locations: safeParseStringArray(created.locations),
    companies: safeParseStringArray((created as any).companies),
    workModes: safeParseStringArray(created.workModes),
    experienceLevels: safeParseStringArray(created.experienceLevels),
    opportunityTypes: safeParseStringArray(created.opportunityTypes),
    preferredSources: safeParseStringArray(created.preferredSources),
    minimumMatchScore: created.minimumMatchScore,
    latestOnly: created.latestOnly,
    freshnessWindowHours: created.freshnessWindowHours,
    scanIntervalHours: created.scanIntervalHours,
    lastScannedAt: created.lastScannedAt,
    nextScanAt: created.nextScanAt,
    lockedAt: created.lockedAt,
    lockOwner: created.lockOwner,
  };
}

/**
 * Retrieves all watches configured for a user.
 */
export async function getUserDiscoveryWatches(userId: string): Promise<DiscoveryWatchConfig[]> {
  if (!userId) return [];
  const watches = await prisma.discoveryWatch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return watches.map((w) => {
    const rawLocs = safeParseStringArray(w.locations);
    const hasRemote = rawLocs.some((l) => /^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
    const cleanLocs = rawLocs.filter((l) => !/^(remote|fully\s*remote|remote-first)$/i.test(l.trim()));
    const rawWorkModes = safeParseStringArray(w.workModes);
    const cleanWorkModes = hasRemote && !rawWorkModes.includes("REMOTE") ? [...rawWorkModes, "REMOTE"] : rawWorkModes;

    return {
      id: w.id,
      name: (w as any).name || "Autonomous Watch",
      enabled: w.enabled,
      roles: safeParseStringArray(w.roles),
      skills: safeParseStringArray(w.skills),
      locations: cleanLocs,
      companies: safeParseStringArray((w as any).companies),
      workModes: cleanWorkModes,
      experienceLevels: safeParseStringArray(w.experienceLevels),
      opportunityTypes: safeParseStringArray(w.opportunityTypes),
      preferredSources: safeParseStringArray(w.preferredSources),
      minimumMatchScore: w.minimumMatchScore,
      latestOnly: w.latestOnly,
      freshnessWindowHours: w.freshnessWindowHours,
      scanIntervalHours: w.scanIntervalHours,
      lastScannedAt: w.lastScannedAt,
      nextScanAt: w.nextScanAt,
      lockedAt: w.lockedAt,
      lockOwner: w.lockOwner,
    };
  });
}

/**
 * Explicitly creates a new discovery watch for a user.
 */
export async function createDiscoveryWatch(
  userId: string,
  input: Partial<DiscoveryWatchConfig>
): Promise<DiscoveryWatchConfig> {
  const targetInterval = typeof input.scanIntervalHours === "number" ? input.scanIntervalHours : 6;
  const nextScan = input.nextScanAt !== undefined ? input.nextScanAt : new Date(Date.now() + targetInterval * 3600 * 1000);

  const created = await prisma.discoveryWatch.create({
    data: {
      userId,
      name: input.name || "Autonomous Watch",
      enabled: input.enabled ?? false,
      roles: JSON.stringify(safeParseStringArray(input.roles ?? [])),
      skills: JSON.stringify(safeParseStringArray(input.skills ?? [])),
      locations: JSON.stringify(safeParseStringArray(input.locations ?? [])),
      companies: JSON.stringify(safeParseStringArray(input.companies ?? [])),
      workModes: JSON.stringify(safeParseStringArray(input.workModes ?? ["REMOTE", "HYBRID"])),
      experienceLevels: JSON.stringify(safeParseStringArray(input.experienceLevels ?? ["ENTRY_LEVEL"])),
      opportunityTypes: JSON.stringify(safeParseStringArray(input.opportunityTypes ?? ["FULL_TIME"])),
      preferredSources: JSON.stringify(safeParseStringArray(input.preferredSources ?? [])),
      minimumMatchScore: input.minimumMatchScore ?? 70,
      latestOnly: input.latestOnly ?? false,
      freshnessWindowHours: input.freshnessWindowHours ?? 48,
      scanIntervalHours: targetInterval,
      lastScannedAt: input.lastScannedAt ?? null,
      nextScanAt: nextScan,
      lockedAt: null,
      lockOwner: null,
    },
  });

  return {
    id: created.id,
    name: (created as any).name || "Autonomous Watch",
    enabled: created.enabled,
    roles: safeParseStringArray(created.roles),
    skills: safeParseStringArray(created.skills),
    locations: safeParseStringArray(created.locations),
    companies: safeParseStringArray((created as any).companies),
    workModes: safeParseStringArray(created.workModes),
    experienceLevels: safeParseStringArray(created.experienceLevels),
    opportunityTypes: safeParseStringArray(created.opportunityTypes),
    preferredSources: safeParseStringArray(created.preferredSources),
    minimumMatchScore: created.minimumMatchScore,
    latestOnly: created.latestOnly,
    freshnessWindowHours: created.freshnessWindowHours,
    scanIntervalHours: created.scanIntervalHours,
    lastScannedAt: created.lastScannedAt,
    nextScanAt: created.nextScanAt,
    lockedAt: created.lockedAt,
    lockOwner: created.lockOwner,
  };
}

/**
 * Upserts a user's discovery watch configuration.
 * If input.id is provided, updates that specific watch.
 * If input.id is not provided, updates the existing watch or creates one if none exists.
 */
export async function upsertDiscoveryWatch(
  userId: string,
  input: Partial<DiscoveryWatchConfig>
): Promise<DiscoveryWatchConfig> {
  const targetWatch = input.id
    ? await prisma.discoveryWatch.findFirst({ where: { id: input.id, userId } })
    : await prisma.discoveryWatch.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });

  if (!targetWatch) {
    return createDiscoveryWatch(userId, input);
  }

  const targetInterval = typeof input.scanIntervalHours === "number" ? input.scanIntervalHours : targetWatch.scanIntervalHours;
  const isIntervalChanged = typeof input.scanIntervalHours === "number" && input.scanIntervalHours !== targetWatch.scanIntervalHours;

  let calculatedNextScanAt = input.nextScanAt !== undefined ? input.nextScanAt : targetWatch.nextScanAt;
  if (isIntervalChanged && input.nextScanAt === undefined) {
    const lastScan = targetWatch.lastScannedAt ? new Date(targetWatch.lastScannedAt).getTime() : Date.now();
    calculatedNextScanAt = new Date(lastScan + targetInterval * 3600 * 1000);
  }

  const updated = await prisma.discoveryWatch.update({
    where: { id: targetWatch.id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(typeof input.enabled === "boolean" ? { enabled: input.enabled } : {}),
      ...(input.roles ? { roles: JSON.stringify(safeParseStringArray(input.roles)) } : {}),
      ...(input.skills ? { skills: JSON.stringify(safeParseStringArray(input.skills)) } : {}),
      ...(input.locations ? { locations: JSON.stringify(safeParseStringArray(input.locations)) } : {}),
      ...(input.companies ? { companies: JSON.stringify(safeParseStringArray(input.companies)) } : {}),
      ...(input.workModes ? { workModes: JSON.stringify(safeParseStringArray(input.workModes)) } : {}),
      ...(input.experienceLevels ? { experienceLevels: JSON.stringify(safeParseStringArray(input.experienceLevels)) } : {}),
      ...(input.opportunityTypes ? { opportunityTypes: JSON.stringify(safeParseStringArray(input.opportunityTypes)) } : {}),
      ...(input.preferredSources !== undefined ? { preferredSources: JSON.stringify(safeParseStringArray(input.preferredSources)) } : {}),
      ...(typeof input.minimumMatchScore === "number" ? { minimumMatchScore: input.minimumMatchScore } : {}),
      ...(typeof input.latestOnly === "boolean" ? { latestOnly: input.latestOnly } : {}),
      ...(typeof input.freshnessWindowHours === "number" ? { freshnessWindowHours: input.freshnessWindowHours } : {}),
      ...(typeof input.scanIntervalHours === "number" ? { scanIntervalHours: input.scanIntervalHours } : {}),
      ...(input.lastScannedAt !== undefined ? { lastScannedAt: input.lastScannedAt } : {}),
      ...(calculatedNextScanAt !== undefined ? { nextScanAt: calculatedNextScanAt } : {}),
      ...(input.lockedAt !== undefined ? { lockedAt: input.lockedAt } : {}),
      ...(input.lockOwner !== undefined ? { lockOwner: input.lockOwner } : {}),
    },
  });

  return {
    id: updated.id,
    name: (updated as any).name || "Autonomous Watch",
    enabled: updated.enabled,
    roles: safeParseStringArray(updated.roles),
    skills: safeParseStringArray(updated.skills),
    locations: safeParseStringArray(updated.locations),
    companies: safeParseStringArray((updated as any).companies),
    workModes: safeParseStringArray(updated.workModes),
    experienceLevels: safeParseStringArray(updated.experienceLevels),
    opportunityTypes: safeParseStringArray(updated.opportunityTypes),
    preferredSources: safeParseStringArray(updated.preferredSources),
    minimumMatchScore: updated.minimumMatchScore,
    latestOnly: updated.latestOnly,
    freshnessWindowHours: updated.freshnessWindowHours,
    scanIntervalHours: updated.scanIntervalHours,
    lastScannedAt: updated.lastScannedAt,
    nextScanAt: updated.nextScanAt,
    lockedAt: updated.lockedAt,
    lockOwner: updated.lockOwner,
  };
}

/**
 * Retrieves all watches that are enabled and due for an autonomous scan,
 * excluding watches that are currently claimed with an active lease.
 */
export async function getDueDiscoveryWatches(
  limit = 10,
  maxLeaseAgeMs = 120000
): Promise<Array<{ userId: string; watch: DiscoveryWatchConfig }>> {
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - maxLeaseAgeMs);

  const watches = await prisma.discoveryWatch.findMany({
    where: {
      enabled: true,
      OR: [
        { nextScanAt: null },
        { nextScanAt: { lte: now } },
      ],
      AND: [
        {
          OR: [
            { lockedAt: null },
            { lockedAt: { lte: staleCutoff } },
          ],
        },
      ],
    },
    orderBy: [
      { nextScanAt: "asc" },
      { createdAt: "asc" },
    ],
    take: limit,
  });

  return watches.map((w) => ({
    userId: w.userId,
    watch: {
      enabled: w.enabled,
      roles: safeParseStringArray(w.roles),
      skills: safeParseStringArray(w.skills),
      locations: safeParseStringArray(w.locations),
      companies: safeParseStringArray((w as any).companies),
      workModes: safeParseStringArray(w.workModes),
      experienceLevels: safeParseStringArray(w.experienceLevels),
      opportunityTypes: safeParseStringArray(w.opportunityTypes),
      preferredSources: safeParseStringArray(w.preferredSources),
      minimumMatchScore: w.minimumMatchScore,
      latestOnly: w.latestOnly,
      freshnessWindowHours: w.freshnessWindowHours,
      scanIntervalHours: w.scanIntervalHours,
      lastScannedAt: w.lastScannedAt,
      nextScanAt: w.nextScanAt,
      lockedAt: w.lockedAt,
      lockOwner: w.lockOwner,
    },
  }));
}

/**
 * Backward-compatible alias for getUsersDueForDiscovery.
 */
export async function getUsersDueForDiscovery(limit = 10): Promise<Array<{ userId: string; watch: DiscoveryWatchConfig }>> {
  return await getDueDiscoveryWatches(limit);
}

/**
 * Atomically claims a watch for background execution with a lease timestamp.
 * Returns true if claim succeeded, false if already claimed by an active lease.
 */
export async function claimDiscoveryWatch(
  userId: string,
  lockOwner: string,
  maxLeaseAgeMs = 120000
): Promise<boolean> {
  if (!userId || !lockOwner) return false;
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - maxLeaseAgeMs);

  const res = await prisma.discoveryWatch.updateMany({
    where: {
      userId,
      enabled: true,
      OR: [
        { lockedAt: null },
        { lockedAt: { lte: staleCutoff } },
      ],
    },
    data: {
      lockedAt: now,
      lockOwner,
    },
  });

  return res.count > 0;
}

/**
 * Releases a durable watch claim lock.
 */
export async function releaseDiscoveryWatch(userId: string, lockOwner?: string): Promise<boolean> {
  if (!userId) return false;

  const res = await prisma.discoveryWatch.updateMany({
    where: {
      userId,
      ...(lockOwner ? { lockOwner } : {}),
    },
    data: {
      lockedAt: null,
      lockOwner: null,
    },
  });

  return res.count > 0;
}

/**
 * Updates the lastScannedAt and nextScanAt timestamps for a watch and clears locks.
 */
export async function updateDiscoveryWatchScanTimestamps(
  userId: string,
  lastScannedAt: Date,
  nextScanAt: Date
): Promise<void> {
  await prisma.discoveryWatch.updateMany({
    where: { userId },
    data: {
      lastScannedAt,
      nextScanAt,
      lockedAt: null,
      lockOwner: null,
    },
  });
}

/**
 * Creates an execution record for an autonomous discovery run.
 */
export async function createDiscoveryRun(
  userId: string,
  triggerType: "MANUAL" | "SCHEDULED" = "MANUAL"
) {
  let userExists = false;
  try {
    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    userExists = Boolean(userRecord);
  } catch {}

  if (!userExists) {
    return {
      id: `virtual_run_${Date.now()}`,
      userId,
      triggerType,
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
      providersAttempted: 0,
      providersSucceeded: 0,
      providersFailed: 0,
      candidatesFound: 0,
      validCandidates: 0,
      newOpportunities: 0,
      newSources: 0,
      alreadyKnown: 0,
      reposted: 0,
      notificationsCreated: 0,
      errorMessage: null,
      createdAt: new Date(),
    };
  }

  try {
    return await prisma.discoveryRun.create({
      data: {
        userId,
        triggerType,
        status: "RUNNING",
      },
    });
  } catch (err) {
    console.warn(`[createDiscoveryRun] Failed to create run record for ${userId}:`, err);
    return {
      id: `virtual_run_${Date.now()}`,
      userId,
      triggerType,
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      durationMs: null,
      providersAttempted: 0,
      providersSucceeded: 0,
      providersFailed: 0,
      candidatesFound: 0,
      validCandidates: 0,
      newOpportunities: 0,
      newSources: 0,
      alreadyKnown: 0,
      reposted: 0,
      notificationsCreated: 0,
      errorMessage: null,
      createdAt: new Date(),
    };
  }
}

/**
 * Updates a discovery run record upon completion.
 */
export async function completeDiscoveryRun(
  runId: string,
  data: {
    status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "TIMEOUT";
    durationMs?: number;
    providersAttempted?: number;
    providersSucceeded?: number;
    providersFailed?: number;
    candidatesFound?: number;
    validCandidates?: number;
    newOpportunities?: number;
    newSources?: number;
    alreadyKnown?: number;
    reposted?: number;
    notificationsCreated?: number;
    errorMessage?: string | null;
  }
) {
  if (runId.startsWith("virtual_run_") || runId.startsWith("locked_") || runId.startsWith("disabled_")) {
    return null;
  }

  try {
    return await prisma.discoveryRun.update({
      where: { id: runId },
      data: {
        status: data.status,
        completedAt: new Date(),
        durationMs: data.durationMs,
        providersAttempted: data.providersAttempted,
        providersSucceeded: data.providersSucceeded,
        providersFailed: data.providersFailed,
        candidatesFound: data.candidatesFound,
        validCandidates: data.validCandidates,
        newOpportunities: data.newOpportunities,
        newSources: data.newSources,
        alreadyKnown: data.alreadyKnown,
        reposted: data.reposted,
        notificationsCreated: data.notificationsCreated,
        errorMessage: data.errorMessage,
      },
    });
  } catch (err) {
    console.warn(`[completeDiscoveryRun] Non-fatal run update notice for ${runId}:`, err);
    return null;
  }
}

/**
 * Records an individual opportunity discovery event.
 */
export async function recordDiscoveryEvent(input: {
  runId: string;
  userId: string;
  opportunityId: string;
  classification: "NEW_OPPORTUNITY" | "NEW_SOURCE" | "ALREADY_KNOWN" | "REPOSTED" | string;
  matchScore: number;
  freshnessClass?: string;
  notificationCreated?: boolean;
}) {
  return await prisma.opportunityDiscoveryEvent.upsert({
    where: {
      userId_opportunityId_runId: {
        userId: input.userId,
        opportunityId: input.opportunityId,
        runId: input.runId,
      },
    },
    create: {
      runId: input.runId,
      userId: input.userId,
      opportunityId: input.opportunityId,
      classification: input.classification,
      matchScore: input.matchScore,
      freshnessClass: input.freshnessClass || "UNKNOWN",
      notificationCreated: input.notificationCreated ?? false,
    },
    update: {
      classification: input.classification,
      matchScore: input.matchScore,
      freshnessClass: input.freshnessClass || "UNKNOWN",
      notificationCreated: input.notificationCreated ?? false,
    },
  });
}

/**
 * Checks whether a user has already encountered/seen a canonical opportunity in their history.
 */
export async function hasUserSeenOpportunity(userId: string, opportunityId: string): Promise<boolean> {
  if (!userId || !opportunityId) return false;

  // 1. Check if user saved the opportunity
  const saved = await prisma.savedOpportunity.findUnique({
    where: { userId_opportunityId: { userId, opportunityId } },
    select: { id: true },
  });
  if (saved) return true;

  // 2. Check if user already saw it in any previous search result
  const seenInSearch = await prisma.searchResult.findFirst({
    where: {
      opportunityId,
      search: { userId },
    },
    select: { id: true },
  });
  if (seenInSearch) return true;

  // 3. Check if user previously had a discovery event for it
  const previousEvent = await prisma.opportunityDiscoveryEvent.findFirst({
    where: {
      userId,
      opportunityId,
    },
    select: { id: true },
  });
  return !!previousEvent;
}

/**
 * Retrieves paginated novel discovery events for a user with full opportunity details.
 */
export async function getUserDiscoveryEvents(
  userId: string,
  options: { limit?: number; classification?: string } = {}
) {
  if (!userId) return [];
  const limit = options.limit || 50;

  return await prisma.opportunityDiscoveryEvent.findMany({
    where: {
      userId,
      ...(options.classification ? { classification: options.classification } : {}),
    },
    include: {
      opportunity: {
        include: {
          sourceListings: {
            orderBy: { seenAt: "desc" },
          },
          companyContacts: true,
        },
      },
    },
    orderBy: { discoveredAt: "desc" },
    take: limit,
  });
}

/**
 * Retrieves past discovery runs for an authenticated user.
 */
export async function getUserDiscoveryRuns(userId: string, options: { limit?: number } = {}) {
  if (!userId) return [];
  const limit = options.limit || 20;

  return await prisma.discoveryRun.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });
}

/**
 * Automated fleet cleanup routine: pauses all currently active DiscoveryWatch rows in PostgreSQL.
 */
export async function pauseAllActiveDiscoveryWatches(): Promise<{ updatedCount: number }> {
  const result = await prisma.discoveryWatch.updateMany({
    where: { enabled: true },
    data: { enabled: false },
  });
  return { updatedCount: result.count };
}

/**
 * Automated cleanup routine: purges all legacy synthetic / placeholder company contacts from PostgreSQL (Requirement R6).
 */
export async function purgeSyntheticCompanyContacts(): Promise<{ deletedCount: number }> {
  const result = await prisma.companyContact.deleteMany({
    where: {
      OR: [
        { fullName: { in: ["Sarah Jenkins", "Alex Morgan", "Elena Rostova", "David Chen", "Marcus Vance", "Claire Beaumont", "Ananya Deshmukh", "Arun Kumar", "Sneha Rao", "Vikram Patel", "Divya Menon"] } },
        { phone: { contains: "555" } },
        { personalEmail: { contains: ".career@gmail.com" } },
        { personalEmail: { contains: ".talent@gmail.com" } },
        { personalEmail: { contains: ".tech@gmail.com" } },
        { personalEmail: { contains: ".code@gmail.com" } },
        { personalEmail: { contains: ".recruiting@gmail.com" } },
      ],
    },
  });
  return { deletedCount: result.count };
}



