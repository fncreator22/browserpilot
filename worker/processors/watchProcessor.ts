/**
 * §WATCH DISCOVERY PROCESSOR (DeepReach Phase 4)
 * Background worker processor for executing recurring multi-platform scans
 * on target companies configured in DiscoveryWatch records.
 * 
 * Features:
 * - Time budget watchdog per target company.
 * - Non-blocking multi-platform harvesting via DeepReach.
 * - Database record comparison & deduplication against CompanyContact & Opportunity.
 * - Proactive LifecycleAlert dispatch for NEW_RECRUITER_CONTACT and UNANNOUNCED_ROLE.
 * - Crash-resilient error isolation with zero unhandled rejections.
 */

import { type Job } from "bullmq";
import { prisma } from "@/lib/db/prisma";
import { executeDeepReachScan, type DeepReachResult } from "@/lib/discovery/deepreach/deepReachService";
import { 
  createRecruiterContactAlert, 
  createUnannouncedRoleAlert 
} from "@/lib/lifecycle/opportunityNotificationService";
import { getDiscoveryWatch, type DiscoveryWatchConfig } from "@/lib/db/opportunities";
import type { WatchJobPayload } from "@/lib/queue/watchQueue";

export interface WatchProcessingResult {
  success: boolean;
  watchId: string;
  userId: string;
  companiesScanned: number;
  newRecruiters: number;
  newUnannouncedRoles: number;
  alertsCreated: number;
  durationMs: number;
  errors: string[];
}

export interface WatchScanOptions {
  timeBudgetMs?: number;
  fetcher?: (url: string, timeoutMs?: number) => Promise<string | null>;
  sendEmail?: boolean;
}

const DEFAULT_COMPANY_WATCHDOG_MS = 15000;
const RATE_LIMIT_PACING_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface WatchScanTarget {
  id: string;
  userId: string;
  companies: string[] | string;
  roles?: string[] | string;
}

/**
 * Executes DeepReach scan and alert generation for a watch configuration
 */
export async function executeWatchDeepReachScan(
  watch: WatchScanTarget,
  options: WatchScanOptions = {}
): Promise<WatchProcessingResult> {
  const startedAt = Date.now();
  const errors: string[] = [];
  let companiesScanned = 0;
  let newRecruiters = 0;
  let newUnannouncedRoles = 0;
  let alertsCreated = 0;

  // 1. Parse target companies
  let targetCompanies: string[] = [];
  if (Array.isArray(watch.companies)) {
    targetCompanies = watch.companies;
  } else if (typeof watch.companies === "string") {
    try {
      const parsed = JSON.parse(watch.companies);
      if (Array.isArray(parsed)) {
        targetCompanies = parsed;
      } else if (typeof parsed === "string") {
        targetCompanies = [parsed];
      }
    } catch {
      if (watch.companies.trim()) {
        targetCompanies = [watch.companies.trim()];
      }
    }
  }

  // Filter out empty strings
  targetCompanies = targetCompanies
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  if (targetCompanies.length === 0) {
    return {
      success: true,
      watchId: watch.id,
      userId: watch.userId,
      companiesScanned: 0,
      newRecruiters: 0,
      newUnannouncedRoles: 0,
      alertsCreated: 0,
      durationMs: Date.now() - startedAt,
      errors: [],
    };
  }

  // Parse target role filter if available
  let roleTitle: string | undefined;
  if (Array.isArray(watch.roles) && watch.roles.length > 0) {
    roleTitle = watch.roles[0];
  } else if (typeof watch.roles === "string") {
    try {
      const parsedRoles = JSON.parse(watch.roles);
      if (Array.isArray(parsedRoles) && parsedRoles.length > 0) {
        roleTitle = parsedRoles[0];
      }
    } catch {
      roleTitle = watch.roles;
    }
  }

  const budgetPerCompany = options.timeBudgetMs || DEFAULT_COMPANY_WATCHDOG_MS;

  // 2. Iterate through each target company with time budget watchdog and pacing
  for (let i = 0; i < targetCompanies.length; i++) {
    const companyName = targetCompanies[i];
    companiesScanned++;

    if (i > 0) {
      await sleep(RATE_LIMIT_PACING_MS);
    }

    try {
      // Snapshot existing known contacts and opportunities BEFORE scan executes
      const normalizedCompany = companyName.toLowerCase().trim();
      let existingContacts: Array<{ fullName: string; profileUrl: string }> = [];

      try {
        existingContacts = await prisma.companyContact.findMany({
          where: { normalizedName: normalizedCompany },
          select: { fullName: true, profileUrl: true },
        });
      } catch {
        // Table may not exist yet in test environment or offline
      }

      const existingProfileUrls = new Set(
        existingContacts.map((c) => c.profileUrl.toLowerCase().trim()).filter(Boolean)
      );
      const existingNames = new Set(
        existingContacts.map((c) => c.fullName.toLowerCase().trim()).filter(Boolean)
      );

      let existingOpportunities: Array<{ primaryApplyUrl: string; title: string }> = [];
      try {
        existingOpportunities = await prisma.opportunity.findMany({
          where: {
            companyName: {
              equals: companyName,
              mode: "insensitive",
            },
          },
          select: { primaryApplyUrl: true, title: true },
        });
      } catch {
        // Safe fallback
      }

      const existingApplyUrls = new Set(
        existingOpportunities.map((o) => o.primaryApplyUrl.toLowerCase().trim()).filter(Boolean)
      );
      const existingTitles = new Set(
        existingOpportunities.map((o) => o.title.toLowerCase().trim()).filter(Boolean)
      );

      // Time budget watchdog wrapped scan
      let timeoutHandle: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutHandle = setTimeout(() => {
          resolve(null);
        }, budgetPerCompany);
      });

      const scanPromise = executeDeepReachScan({
        companyName,
        roleTitle,
        timeoutMs: budgetPerCompany,
        fetcher: options.fetcher,
      });

      const scanResult = await Promise.race([scanPromise, timeoutPromise]);
      if (timeoutHandle) clearTimeout(timeoutHandle);

      if (!scanResult) {
        errors.push(`DeepReach scan for ${companyName} timed out after ${budgetPerCompany}ms watchdog limit`);
        continue;
      }

      // 3. Process Discovered Recruiters & Compare against existing CompanyContact snapshot
      for (const recruiter of scanResult.recruiters) {
        const normUrl = (recruiter.profileUrl || "").toLowerCase().trim();
        const normName = recruiter.fullName.toLowerCase().trim();

        const isAlreadyKnown = 
          (normUrl && existingProfileUrls.has(normUrl)) || 
          existingNames.has(normName);

        if (!isAlreadyKnown) {
          // Persist to database
          try {
            await prisma.companyContact.create({
              data: {
                companyName: recruiter.companyName,
                normalizedName: normalizedCompany,
                fullName: recruiter.fullName,
                roleTitle: recruiter.roleTitle,
                department: recruiter.department,
                profileUrl: recruiter.profileUrl,
                email: recruiter.email,
                sourcePlatform: recruiter.sourcePlatform || "LINKEDIN",
                isVerified: true,
              },
            }).catch(() => {});
          } catch {}

          // Create LifecycleAlert for new recruiter
          const alertRes = await createRecruiterContactAlert({
            userId: watch.userId,
            recruiter,
            companyName,
            sendEmail: options.sendEmail !== false,
          }).catch((err) => {
            errors.push(`Failed to create recruiter alert for ${recruiter.fullName}: ${err?.message || err}`);
            return { created: false, alert: null };
          });

          if (alertRes.created) {
            newRecruiters++;
            alertsCreated++;
            existingProfileUrls.add(normUrl);
            existingNames.add(normName);
          }
        }
      }

      // 4. Process Discovered Cross-Platform / Unannounced Roles against snapshot
      for (const candidate of scanResult.jobs) {
        const normApplyUrl = (candidate.applyUrl || "").toLowerCase().trim();
        const normTitle = candidate.title.toLowerCase().trim();

        const isAlreadyKnownJob =
          (normApplyUrl && existingApplyUrls.has(normApplyUrl)) ||
          existingTitles.has(normTitle);

        if (!isAlreadyKnownJob) {
          // Create LifecycleAlert for unannounced role
          const alertRes = await createUnannouncedRoleAlert({
            userId: watch.userId,
            role: candidate,
            companyName,
            sendEmail: options.sendEmail !== false,
          }).catch((err) => {
            errors.push(`Failed to create unannounced role alert for ${candidate.title}: ${err?.message || err}`);
            return { created: false, alert: null };
          });

          if (alertRes.created) {
            newUnannouncedRoles++;
            alertsCreated++;
            if (normApplyUrl) existingApplyUrls.add(normApplyUrl);
            existingTitles.add(normTitle);
          }
        }
      }
    } catch (companyScanErr: any) {
      errors.push(`Error scanning company ${companyName}: ${companyScanErr?.message || companyScanErr}`);
    }
  }

  return {
    success: errors.length === 0,
    watchId: watch.id,
    userId: watch.userId,
    companiesScanned,
    newRecruiters,
    newUnannouncedRoles,
    alertsCreated,
    durationMs: Date.now() - startedAt,
    errors,
  };
}

/**
 * BullMQ Job Processor for watch discovery jobs
 */
export async function processWatchDiscoveryJob(job: Job<WatchJobPayload>): Promise<WatchProcessingResult> {
  const { watchId, userId, companyTargets, roleTitle, timeBudgetMs, mockFetcher } = job.data;

  console.log(`[WatchProcessor] Starting watch discovery job for watch ${watchId} (user: ${userId})`);

  let watchConfig: DiscoveryWatchConfig | null = null;
  try {
    watchConfig = await getDiscoveryWatch(userId, watchId);
  } catch (getWatchErr) {
    console.warn(`[WatchProcessor] Could not load watch record from DB:`, getWatchErr);
  }

  const effectiveWatch = {
    id: watchId,
    userId,
    companies: companyTargets || watchConfig?.companies || [],
    roles: roleTitle ? [roleTitle] : watchConfig?.roles || [],
  };

  const result = await executeWatchDeepReachScan(effectiveWatch, {
    timeBudgetMs: timeBudgetMs || DEFAULT_COMPANY_WATCHDOG_MS,
    fetcher: mockFetcher,
  });

  if (typeof job.updateProgress === "function") {
    await job.updateProgress(100).catch(() => {});
  }

  console.log(
    `[WatchProcessor] Watch ${watchId} finished in ${result.durationMs}ms: ` +
    `${result.companiesScanned} companies scanned, ` +
    `${result.newRecruiters} new recruiters, ` +
    `${result.newUnannouncedRoles} new unannounced roles, ` +
    `${result.alertsCreated} alerts created`
  );

  return result;
}
