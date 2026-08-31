/**
 * §AUTONOMOUS CONTINUOUS DISCOVERY & NEW OPPORTUNITY INTELLIGENCE (TASK-014)
 * Orchestrates periodic personalized swarm discovery, novelty detection,
 * non-destructive source attachment, freshness-first filtering, 100-point ranking,
 * and idempotent lifecycle alert generation.
 */

import { type SearchProvider } from "./providers/baseProvider";
import { buildDiscoveryPlan, type DiscoveryPlan } from "./discoveryPlanner";
import { swarmDiscoveryEngine, type SwarmDiscoveryResult } from "./swarmDiscovery";
import { validateAndNormalizeExtractionBatch } from "./extractionContract";
import { deduplicateCandidates, type DeduplicatedOpportunity } from "./deduplicator";
import { rankOpportunities, type RankedOpportunity } from "./ranker";
import { isWithinFreshnessWindow } from "./freshnessExtractor";
import {
  getDiscoveryWatch,
  upsertOpportunity,
  upsertSourceListing,
  getOpportunityByCanonicalHash,
  getOpportunityWithSourceListings,
  hasUserSeenOpportunity,
  recordLifecycleAlert,
  createDiscoveryRun,
  completeDiscoveryRun,
  recordDiscoveryEvent,
  updateDiscoveryWatchScanTimestamps,
  getUsersDueForDiscovery,
  type DiscoveryWatchConfig,
} from "@/lib/db/opportunities";
import { getEmailDispatcher, type EmailProvider } from "@/lib/notifications";

export interface AutonomousDiscoveryOptions {
  customProviders?: SearchProvider[];
  customFetch?: typeof fetch;
  customEmailProvider?: EmailProvider;
  forceScan?: boolean;
  concurrencyLimit?: number;
  perProviderTimeoutMs?: number;
  totalTimeoutMs?: number;
  triggerType?: "MANUAL" | "SCHEDULED";
  skipLockCheck?: boolean;
}

export type NoveltyClassification = "NEW_OPPORTUNITY" | "NEW_SOURCE" | "ALREADY_KNOWN" | "REPOSTED";

export interface DiscoveredOpportunityResult {
  opportunity: DeduplicatedOpportunity;
  persistedId: string;
  classification: NoveltyClassification;
  matchScore: number;
  rankPosition: number;
  notificationCreated: boolean;
}

export interface AutonomousDiscoveryRunResult {
  runId: string;
  userId: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "TIMEOUT" | "SKIPPED_LOCKED" | "DISABLED";
  message?: string;
  durationMs: number;
  watchConfig: DiscoveryWatchConfig;
  discoveredOpportunities: DiscoveredOpportunityResult[];
  telemetry: {
    providersAttempted: number;
    providersSucceeded: number;
    providersFailed: number;
    candidatesFound: number;
    validCandidates: number;
    newOpportunities: number;
    newSources: number;
    alreadyKnown: number;
    reposted: number;
    notificationsCreated: number;
    notificationsDeduplicated: number;
    emailsDelivered?: number;
    emailsFailed?: number;
  };
}

export class AutonomousDiscoveryEngine {
  private userLocks = new Set<string>();

  /**
   * Runs autonomous discovery for a single user with mutex locking and complete telemetry.
   */
  public async runAutonomousDiscoveryForUser(
    userId: string,
    options: AutonomousDiscoveryOptions = {}
  ): Promise<AutonomousDiscoveryRunResult> {
    const startTime = Date.now();

    // 1. Mutex Lock Check (unless skipped by durable scheduler claim)
    if (!options.skipLockCheck && this.userLocks.has(userId)) {
      const watch = await getDiscoveryWatch(userId);
      return {
        runId: `locked_${Date.now()}`,
        userId,
        status: "SKIPPED_LOCKED",
        message: "An autonomous discovery scan is already active for this user.",
        durationMs: Date.now() - startTime,
        watchConfig: watch,
        discoveredOpportunities: [],
        telemetry: {
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
          notificationsDeduplicated: 0,
        },
      };
    }

    if (!options.skipLockCheck) {
      this.userLocks.add(userId);
    }

    let runRecordId = `run_${Date.now()}`;
    let watch: DiscoveryWatchConfig | undefined;

    try {
      // 2. Retrieve Discovery Watch Configuration
      watch = await getDiscoveryWatch(userId);
      if (!watch.enabled && !options.forceScan) {
        return {
          runId: `disabled_${Date.now()}`,
          userId,
          status: "DISABLED",
          message: "Discovery watch is disabled for this user.",
          durationMs: Date.now() - startTime,
          watchConfig: watch,
          discoveredOpportunities: [],
          telemetry: {
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
            notificationsDeduplicated: 0,
          },
        };
      }

      // 3. Create Execution Run Record
      const createdRun = await createDiscoveryRun(userId, options.triggerType || "MANUAL");
      runRecordId = createdRun.id;

      // 4. Build Discovery Plan from Watch Configuration
      const plan = buildDiscoveryPlan(
        watch.roles.join(" ") || "Software Developer",
        {
          role: watch.roles[0],
          roles: watch.roles,
          skills: watch.skills,
          location: watch.locations[0],
          locations: watch.locations,
          companies: watch.companies,
          company: watch.companies[0],
          workMode: watch.workModes[0] as any,
          workModes: watch.workModes as any,
          opportunityType: watch.opportunityTypes[0] as any,
          opportunityTypes: watch.opportunityTypes as any,
          experienceLevel: watch.experienceLevels[0] as any,
          experienceLevels: watch.experienceLevels as any,
          minimumMatchScore: watch.minimumMatchScore,
          isExplicitFreshness: Boolean(watch.latestOnly),
          freshnessWindowHours: watch.freshnessWindowHours,
        },
        {
          targetRoles: watch.roles,
          skills: watch.skills,
          preferredLocations: watch.locations,
          targetCompanies: watch.companies,
          preferredWorkMode: watch.workModes[0] as any,
          preferredOpportunityType: watch.opportunityTypes[0],
          experienceLevel: watch.experienceLevels[0],
          freshnessWindowHours: watch.freshnessWindowHours,
          isExplicitFreshness: Boolean(watch.latestOnly),
          sortMode: watch.latestOnly ? "LATEST" : "RELEVANCE_THEN_FRESHNESS",
          minimumMatchScore: watch.minimumMatchScore,
        }
      );

      // 5. Execute Multi-Source Swarm Discovery (TASK-013)
      const swarmResult: SwarmDiscoveryResult = await swarmDiscoveryEngine.executeSwarm(plan, {
        customProviders: options.customProviders,
        customFetch: options.customFetch,
        concurrencyLimit: options.concurrencyLimit,
        perProviderTimeoutMs: options.perProviderTimeoutMs,
        totalTimeoutMs: options.totalTimeoutMs,
      });

      // 6. Upstream Extraction Validation (TASK-012)
      const batchVal = validateAndNormalizeExtractionBatch(swarmResult.candidates, { allowLocalForTests: true });
      const validExtractions = [...batchVal.valid, ...batchVal.partial];

      const cleanCandidates = validExtractions.map((ext) => ({
        sourcePlatform: ext.sourcePlatform || "Web",
        sourceUrl: ext.sourceUrl,
        applyUrl: ext.applyUrl || ext.sourceUrl,
        externalJobId: ext.externalJobId || undefined,
        title: ext.title,
        companyName: ext.companyName || ext.company,
        location: ext.location,
        workMode: ext.workMode,
        experienceLevel: ext.experienceLevel,
        opportunityType: ext.opportunityType,
        salaryText: ext.salaryMin && ext.salaryMax ? `$${ext.salaryMin} - $${ext.salaryMax}` : undefined,
        description: ext.description,
        rawSnippet: ext.rawSnippet || undefined,
        discoveredAt: new Date(ext.extractedAt || Date.now()),
        postedAt: (ext as any).postedAt || null,
        postedAgoText: (ext as any).postedAgoText || null,
      }));

      // Filter by watch freshness window as a hard constraint when latestOnly is active (TASK-027)
      const isExplicitWatchFreshness = Boolean(watch?.latestOnly);
      const validFreshCandidates = isExplicitWatchFreshness
        ? cleanCandidates.filter((c) =>
            isWithinFreshnessWindow(c.postedAt, watch?.freshnessWindowHours || 48, true, new Date(startTime))
          )
        : cleanCandidates;

      // 7. 3-Tier Multi-Source Deduplication (TASK-004)
      const deduplicatedOpps = deduplicateCandidates(validFreshCandidates as any);

      // 8. 100-Point Personalized Relevance Ranking (TASK-004 & TASK-013)
      const intent = swarmDiscoveryEngine.planToIntent(plan);
      const rankedOpps = rankOpportunities(deduplicatedOpps, intent, {
        sortMode: plan.sortMode,
      });

      // 9. Novelty Detection, Persistence & Alert Generation
      let newOpportunitiesCount = 0;
      let newSourcesCount = 0;
      let alreadyKnownCount = 0;
      let repostedCount = 0;
      let notificationsCreatedCount = 0;
      let notificationsDeduplicatedCount = 0;
      let emailsDeliveredCount = 0;
      let emailsFailedCount = 0;

      const discoveredResults: DiscoveredOpportunityResult[] = [];

      for (const rankedItem of rankedOpps) {
        const opp = rankedItem.opportunity;
        const matchScore = rankedItem.totalScore;

        // Check if opportunity exists in canonical DB
        const existingCanonical = await getOpportunityWithSourceListings(opp.canonicalHash);

        let classification: NoveltyClassification = "NEW_OPPORTUNITY";

        if (!existingCanonical) {
          classification = "NEW_OPPORTUNITY";
          newOpportunitiesCount++;
        } else {
          // Check for new source platform/URL
          const hasNewSource = opp.sourceListings.some(
            (incomingListing) =>
              !existingCanonical.sourceListings.some(
                (existingListing) =>
                  existingListing.sourcePlatform === incomingListing.sourcePlatform &&
                  existingListing.sourceUrl === incomingListing.sourceUrl
              )
          );

          if (hasNewSource) {
            classification = "NEW_SOURCE";
            newSourcesCount++;
          } else if (
            opp.postedAt &&
            ((existingCanonical as any).postedAt || existingCanonical.firstSeenAt) &&
            new Date(opp.postedAt).getTime() >
              new Date((existingCanonical as any).postedAt || existingCanonical.firstSeenAt).getTime() + 24 * 3600 * 1000
          ) {
            classification = "REPOSTED";
            repostedCount++;
          } else {
            const seenByUser = await hasUserSeenOpportunity(userId, existingCanonical.id);
            if (seenByUser) {
              classification = "ALREADY_KNOWN";
              alreadyKnownCount++;
            } else {
              classification = "NEW_OPPORTUNITY";
              newOpportunitiesCount++;
            }
          }
        }

        // Upsert canonical opportunity
        const persistedOpp = await upsertOpportunity({
          canonicalHash: opp.canonicalHash,
          title: opp.title,
          companyName: opp.companyName,
          location: opp.location,
          workMode: opp.workMode,
          experienceLevel: opp.experienceLevel,
          opportunityType: opp.opportunityType,
          salaryMin: opp.salaryMin,
          salaryMax: opp.salaryMax,
          salaryCurrency: opp.salaryCurrency,
          description: opp.description,
          requirements: opp.requirements,
          skills: opp.skills,
          primaryApplyUrl: opp.primaryApplyUrl,
          status: opp.status,
          lastVerifiedAt: new Date(),
        });

        // Upsert all attached source listings non-destructively
        for (const listing of opp.sourceListings) {
          await upsertSourceListing({
            opportunityId: persistedOpp.id,
            sourcePlatform: listing.sourcePlatform,
            externalJobId: listing.externalJobId,
            sourceUrl: listing.sourceUrl,
            applyUrl: listing.applyUrl,
            rawSnippet: listing.rawSnippet,
            verificationStatus: listing.verificationStatus,
            screenshotPath: listing.screenshotPath,
          });
        }

        // 10. Alert Generation with Deterministic Idempotency
        let notificationCreated = false;
        const qualifiesForAlert =
          (classification === "NEW_OPPORTUNITY" || classification === "NEW_SOURCE" || classification === "REPOSTED") &&
          matchScore >= watch.minimumMatchScore;

        if (qualifiesForAlert) {
          // Idempotency key covers user + opportunity + classification + date stamp
          const dateStamp = new Date().toISOString().split("T")[0];
          const idempotencyKey = `${userId}_${persistedOpp.id}_${classification}_${dateStamp}`;

          const alertMessage =
            classification === "NEW_OPPORTUNITY"
              ? `New opportunity matching your profile: ${persistedOpp.title} at ${persistedOpp.companyName} (${Math.round(matchScore)} pts)`
              : classification === "NEW_SOURCE"
              ? `New source available for ${persistedOpp.title} at ${persistedOpp.companyName}`
              : `Reposted opening: ${persistedOpp.title} at ${persistedOpp.companyName}`;

          const alertRes = await recordLifecycleAlert({
            userId,
            opportunityId: persistedOpp.id,
            transitionType: classification,
            previousStatus: existingCanonical?.status || "NEW",
            newStatus: persistedOpp.status,
            title: persistedOpp.title,
            companyName: persistedOpp.companyName,
            message: alertMessage,
            idempotencyKey,
          });

          if (alertRes.created) {
            notificationsCreatedCount++;
            notificationCreated = true;

            // Outbound Email Dispatcher Integration (TASK-020)
            if (["NEW_OPPORTUNITY", "REPOSTED", "NEW_SOURCE"].includes(classification)) {
              try {
                const emailRes = await getEmailDispatcher().dispatchLifecycleAlertEmail(
                  alertRes.alert,
                  {
                    id: persistedOpp.id,
                    title: persistedOpp.title,
                    companyName: persistedOpp.companyName,
                    location: persistedOpp.location,
                    workMode: persistedOpp.workMode,
                    opportunityType: persistedOpp.opportunityType,
                    matchScore,
                    postedAgoText: (opp as any).postedAgoText || null,
                    postedAt: opp.postedAt || null,
                    matchReason: rankedItem.breakdown
                      ? `Match score ${Math.round(matchScore)}%: Role(${rankedItem.breakdown.role}), Skills(${rankedItem.breakdown.skills}), WorkMode(${rankedItem.breakdown.workMode}), Freshness(${rankedItem.breakdown.freshness})`
                      : null,
                    primaryApplyUrl: persistedOpp.primaryApplyUrl,
                    skills: persistedOpp.skills,
                    description: persistedOpp.description,
                  },
                  { customProvider: options.customEmailProvider }
                );

                if (emailRes.success) {
                  emailsDeliveredCount++;
                } else {
                  emailsFailedCount++;
                }
              } catch (emailErr) {
                console.warn(
                  `[OutboundEmail] Non-fatal delivery failure for alert ${alertRes.alert.id}:`,
                  (emailErr as Error).message
                );
                emailsFailedCount++;
              }
            }
          } else {
            notificationsDeduplicatedCount++;
          }
        }

        // 11. Record Discovery Event
        await recordDiscoveryEvent({
          runId: runRecordId,
          userId,
          opportunityId: persistedOpp.id,
          classification,
          matchScore,
          freshnessClass: (opp as any).freshnessClass || "UNKNOWN",
          notificationCreated,
        });

        discoveredResults.push({
          opportunity: opp,
          persistedId: persistedOpp.id,
          classification,
          matchScore,
          rankPosition: rankedItem.rankPosition,
          notificationCreated,
        });
      }

      const durationMs = Date.now() - startTime;
      const finalStatus =
        swarmResult.status === "FAILED"
          ? "FAILED"
          : swarmResult.status === "PARTIAL_SUCCESS"
          ? "PARTIAL_SUCCESS"
          : "SUCCESS";

      // 12. Complete Execution Run Record
      await completeDiscoveryRun(runRecordId, {
        status: finalStatus,
        durationMs,
        providersAttempted: swarmResult.swarmTelemetry.sourcesRequested,
        providersSucceeded: swarmResult.swarmTelemetry.sourcesCompleted,
        providersFailed: swarmResult.swarmTelemetry.sourcesFailed,
        candidatesFound: cleanCandidates.length,
        validCandidates: deduplicatedOpps.length,
        newOpportunities: newOpportunitiesCount,
        newSources: newSourcesCount,
        alreadyKnown: alreadyKnownCount,
        reposted: repostedCount,
        notificationsCreated: notificationsCreatedCount,
      });

      // 13. Update Watch Timestamps
      const now = new Date();
      const intervalHours = watch.scanIntervalHours || 6;
      const baseTime = watch.nextScanAt && watch.nextScanAt.getTime() > now.getTime() - intervalHours * 3600 * 1000
        ? watch.nextScanAt.getTime()
        : now.getTime();
      let calculatedNext = new Date(baseTime + intervalHours * 3600 * 1000);
      if (calculatedNext.getTime() <= now.getTime()) {
        calculatedNext = new Date(now.getTime() + intervalHours * 3600 * 1000);
      }
      await updateDiscoveryWatchScanTimestamps(userId, now, calculatedNext);

      return {
        runId: runRecordId,
        userId,
        status: finalStatus,
        durationMs,
        watchConfig: watch,
        discoveredOpportunities: discoveredResults,
        telemetry: {
          providersAttempted: swarmResult.swarmTelemetry.sourcesRequested,
          providersSucceeded: swarmResult.swarmTelemetry.sourcesCompleted,
          providersFailed: swarmResult.swarmTelemetry.sourcesFailed,
          candidatesFound: cleanCandidates.length,
          validCandidates: deduplicatedOpps.length,
          newOpportunities: newOpportunitiesCount,
          newSources: newSourcesCount,
          alreadyKnown: alreadyKnownCount,
          reposted: repostedCount,
          notificationsCreated: notificationsCreatedCount,
          notificationsDeduplicated: notificationsDeduplicatedCount,
          emailsDelivered: emailsDeliveredCount,
          emailsFailed: emailsFailedCount,
        },
      };
    } catch (err: unknown) {
      const durationMs = Date.now() - startTime;
      const errorMessage = (err as Error).message || "Discovery run failed";

      await completeDiscoveryRun(runRecordId, {
        status: "FAILED",
        durationMs,
        errorMessage,
      }).catch(() => null);

      return {
        runId: runRecordId,
        userId,
        status: "FAILED",
        message: errorMessage,
        durationMs,
        watchConfig: watch || (await getDiscoveryWatch(userId)),
        discoveredOpportunities: [],
        telemetry: {
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
          notificationsDeduplicated: 0,
        },
      };
    } finally {
      this.userLocks.delete(userId);
    }
  }

  /**
   * Executes scheduled autonomous discovery for all users due for a scan.
   * Concurrency across users is strictly bounded (max 2 parallel users).
   */
  public async runAutonomousDiscoveryForAllUsers(
    options: AutonomousDiscoveryOptions = {}
  ): Promise<{
    usersProcessed: number;
    successfulRuns: number;
    partialRuns: number;
    failedRuns: number;
    totalNotificationsCreated: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    const dueUsers = await getUsersDueForDiscovery(10);

    let successfulRuns = 0;
    let partialRuns = 0;
    let failedRuns = 0;
    let totalNotificationsCreated = 0;

    // Process users in bounded batches of 2
    const batchSize = 2;
    for (let i = 0; i < dueUsers.length; i += batchSize) {
      const batch = dueUsers.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map((u) => this.runAutonomousDiscoveryForUser(u.userId, options))
      );

      for (const res of results) {
        if (res.status === "SUCCESS") successfulRuns++;
        else if (res.status === "PARTIAL_SUCCESS") partialRuns++;
        else if (res.status === "FAILED") failedRuns++;

        totalNotificationsCreated += res.telemetry.notificationsCreated;
      }
    }

    return {
      usersProcessed: dueUsers.length,
      successfulRuns,
      partialRuns,
      failedRuns,
      totalNotificationsCreated,
      durationMs: Date.now() - startTime,
    };
  }
}

export const autonomousDiscoveryEngine = new AutonomousDiscoveryEngine();
