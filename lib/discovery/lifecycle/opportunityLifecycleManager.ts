/**
 * §OPPORTUNITY LIFECYCLE MANAGER & STATE MACHINE (TASK-042)
 * 
 * Manages deterministic state transitions, 48-hour freshness boundaries,
 * multi-source listing provenance, and change detection updates.
 */

import { prisma } from "@/lib/db/prisma";
import {
  type OpportunityLifecycleStatus,
  type OpportunityLifecycleRecord,
  type LifecycleTransitionResult,
  type OpportunityChangeEvent,
} from "./opportunityLifecycleTypes";
import { opportunityChangeDetector } from "./opportunityChangeDetector";
import { buildOpportunityIdentity } from "./opportunityIdentity";
import { type RawJobCandidate } from "@/lib/scraper/providers/baseProvider";
import { canonicalizeUrl } from "@/lib/scraper/normalizer";

const FRESHNESS_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 Hours

export class OpportunityLifecycleManager {
  /**
   * Reconciles a raw harvested candidate against the opportunity database.
   * Handles creation, change detection, state transition, and multi-source provenance linking.
   */
  public async reconcileCandidate(
    candidate: RawJobCandidate,
    options: { verificationStatus?: string } = {}
  ): Promise<LifecycleTransitionResult> {
    const identity = buildOpportunityIdentity(candidate);
    const now = new Date();
    const verStatus = options.verificationStatus || "VERIFIED";
    const canonSourceUrl = canonicalizeUrl(candidate.sourceUrl) || identity.primaryApplyUrl;

    // 1. Look up existing opportunity by canonicalHash or existing sourceListing
    let existing = await prisma.opportunity.findUnique({
      where: { canonicalHash: identity.canonicalHash },
      include: { sourceListings: true },
    });

    if (!existing && candidate.sourcePlatform && canonSourceUrl) {
      const listing = await prisma.sourceListing.findUnique({
        where: {
          sourcePlatform_sourceUrl: {
            sourcePlatform: candidate.sourcePlatform,
            sourceUrl: canonSourceUrl,
          },
        },
        include: { opportunity: { include: { sourceListings: true } } },
      });
      if (listing?.opportunity) {
        existing = listing.opportunity;
      }
    }

    if (!existing) {
      // Create new Opportunity in ACTIVE state (post-verification)
      const created = await prisma.opportunity.create({
        data: {
          canonicalHash: identity.canonicalHash,
          title: candidate.title.trim(),
          companyName: candidate.companyName.trim(),
          location: identity.normalizedLocation,
          workMode: identity.workMode,
          experienceLevel: candidate.experienceLevel || "ENTRY_LEVEL",
          opportunityType: candidate.opportunityType || "FULL_TIME",
          description: candidate.description || candidate.rawSnippet || `Opportunity at ${candidate.companyName}`,
          primaryApplyUrl: identity.primaryApplyUrl,
          status: "ACTIVE",
          firstSeenAt: now,
          lastVerifiedAt: now,
          sourceListings: {
            create: {
              sourcePlatform: candidate.sourcePlatform,
              sourceUrl: canonicalizeUrl(candidate.sourceUrl) || identity.primaryApplyUrl,
              applyUrl: identity.primaryApplyUrl,
              externalJobId: candidate.externalJobId || null,
              rawSnippet: candidate.rawSnippet || null,
              verificationStatus: verStatus,
              seenAt: now,
            },
          },
        },
        include: { sourceListings: true },
      });

      const record: OpportunityLifecycleRecord = {
        id: created.id,
        canonicalHash: created.canonicalHash,
        title: created.title,
        companyName: created.companyName,
        location: created.location,
        workMode: created.workMode,
        experienceLevel: created.experienceLevel,
        opportunityType: created.opportunityType,
        status: "ACTIVE",
        primaryApplyUrl: created.primaryApplyUrl,
        firstSeenAt: created.firstSeenAt,
        lastVerifiedAt: created.lastVerifiedAt,
        nextEligibleRefreshAt: new Date(created.lastVerifiedAt.getTime() + FRESHNESS_WINDOW_MS),
        sourceCount: created.sourceListings.length,
        sources: created.sourceListings.map((s) => s.sourcePlatform),
        isFresh: true,
      };

      return {
        previousStatus: "DISCOVERED",
        currentStatus: "ACTIVE",
        isStatusChanged: true,
        changesDetected: [],
        opportunity: record,
      };
    }

    // 2. Existing opportunity found: Detect changes & update state
    const previousStatus = existing.status as OpportunityLifecycleStatus;
    const changes: OpportunityChangeEvent[] = opportunityChangeDetector.detectChanges(
      {
        id: existing.id,
        canonicalHash: existing.canonicalHash,
        title: existing.title,
        companyName: existing.companyName,
        location: existing.location,
        workMode: existing.workMode,
        description: existing.description,
        primaryApplyUrl: existing.primaryApplyUrl,
        status: existing.status,
      },
      candidate
    );

    let nextStatus: OpportunityLifecycleStatus = previousStatus;
    if (changes.length > 0) {
      nextStatus = "UPDATED";
    } else if (previousStatus === "STALE" || previousStatus === "DISCOVERED") {
      nextStatus = "ACTIVE";
    }

    // 3. Upsert SourceListing for multi-source provenance
    const existingListing = existing.sourceListings.find(
      (l) => l.sourcePlatform.toLowerCase() === candidate.sourcePlatform.toLowerCase() && l.sourceUrl === canonSourceUrl
    );

    if (existingListing) {
      await prisma.sourceListing.update({
        where: { id: existingListing.id },
        data: {
          applyUrl: identity.primaryApplyUrl,
          verificationStatus: verStatus,
          seenAt: now,
          rawSnippet: candidate.rawSnippet || existingListing.rawSnippet,
        },
      });
    } else {
      await prisma.sourceListing.create({
        data: {
          opportunityId: existing.id,
          sourcePlatform: candidate.sourcePlatform,
          sourceUrl: canonSourceUrl,
          applyUrl: identity.primaryApplyUrl,
          externalJobId: candidate.externalJobId || null,
          rawSnippet: candidate.rawSnippet || null,
          verificationStatus: verStatus,
          seenAt: now,
        },
      });
      changes.push({
        opportunityId: existing.id,
        canonicalHash: existing.canonicalHash,
        changeType: "NEW_SOURCE_LISTING",
        fieldName: "sourceListings",
        previousValue: existing.sourceListings.map((s) => s.sourcePlatform),
        newValue: candidate.sourcePlatform,
        detectedAt: now,
        sourcePlatform: candidate.sourcePlatform,
      });
    }

    // 4. Update Opportunity record
    const updated = await prisma.opportunity.update({
      where: { id: existing.id },
      data: {
        lastVerifiedAt: now,
        status: nextStatus,
        title: candidate.title ? candidate.title.trim() : existing.title,
        location: identity.normalizedLocation || existing.location,
        workMode: identity.workMode !== "ANY" ? identity.workMode : existing.workMode,
        primaryApplyUrl: identity.primaryApplyUrl || existing.primaryApplyUrl,
      },
      include: { sourceListings: true },
    });

    const isFresh = now.getTime() - updated.lastVerifiedAt.getTime() < FRESHNESS_WINDOW_MS;

    const record: OpportunityLifecycleRecord = {
      id: updated.id,
      canonicalHash: updated.canonicalHash,
      title: updated.title,
      companyName: updated.companyName,
      location: updated.location,
      workMode: updated.workMode,
      experienceLevel: updated.experienceLevel,
      opportunityType: updated.opportunityType,
      status: nextStatus,
      primaryApplyUrl: updated.primaryApplyUrl,
      firstSeenAt: updated.firstSeenAt,
      lastVerifiedAt: updated.lastVerifiedAt,
      nextEligibleRefreshAt: new Date(updated.lastVerifiedAt.getTime() + FRESHNESS_WINDOW_MS),
      sourceCount: updated.sourceListings.length,
      sources: updated.sourceListings.map((s) => s.sourcePlatform),
      isFresh,
    };

    return {
      previousStatus,
      currentStatus: nextStatus,
      isStatusChanged: previousStatus !== nextStatus,
      changesDetected: changes,
      opportunity: record,
    };
  }

  /**
   * Evaluates staleness of stored opportunities and marks those older than 48 hours as STALE.
   */
  public async sweepStaleness(cutoffMs: number = FRESHNESS_WINDOW_MS): Promise<{ staleMarkedCount: number }> {
    const threshold = new Date(Date.now() - cutoffMs);

    const result = await prisma.opportunity.updateMany({
      where: {
        status: { in: ["ACTIVE", "UPDATED"] },
        lastVerifiedAt: { lt: threshold },
      },
      data: {
        status: "STALE",
      },
    });

    return { staleMarkedCount: result.count };
  }

  /**
   * Marks an opportunity as EXPIRED when verified unavailable on its primary source.
   */
  public async markOpportunityExpired(opportunityId: string, reason?: string): Promise<OpportunityLifecycleRecord | null> {
    const opp = await prisma.opportunity.update({
      where: { id: opportunityId },
      data: {
        status: "EXPIRED",
        lastVerifiedAt: new Date(),
      },
      include: { sourceListings: true },
    });

    if (!opp) return null;

    return {
      id: opp.id,
      canonicalHash: opp.canonicalHash,
      title: opp.title,
      companyName: opp.companyName,
      location: opp.location,
      workMode: opp.workMode,
      experienceLevel: opp.experienceLevel,
      opportunityType: opp.opportunityType,
      status: "EXPIRED",
      primaryApplyUrl: opp.primaryApplyUrl,
      firstSeenAt: opp.firstSeenAt,
      lastVerifiedAt: opp.lastVerifiedAt,
      nextEligibleRefreshAt: new Date(opp.lastVerifiedAt.getTime() + FRESHNESS_WINDOW_MS),
      sourceCount: opp.sourceListings.length,
      sources: opp.sourceListings.map((s) => s.sourcePlatform),
      isFresh: false,
    };
  }
}

export const opportunityLifecycleManager = new OpportunityLifecycleManager();
