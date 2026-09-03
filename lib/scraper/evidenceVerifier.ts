/**
 * §AUTONOMOUS EVIDENCE VERIFIER, FRESHNESS & LIFECYCLE REVALIDATION ENGINE (TASK-006 & TASK-009)
 * Provides bounded, failure-isolated Playwright visual verification and lifecycle monitoring for job opportunities.
 * Reuses existing browserPool and artifactStorage infrastructure with zero LLM overhead.
 */

import { browserPool } from "@/worker/browser";
import { artifactStorage } from "@/lib/storage";
import { isSafePublicUrl } from "./providers/baseProvider";
import { 
  upsertSourceListing, 
  getOpportunityByCanonicalHash, 
  getOpportunityWithSourceListings, 
  updateOpportunityStatus,
  getSavedOpportunities
} from "@/lib/db/opportunities";
import type { RankedOpportunity } from "./ranker";

export type LifecycleStatus = 
  | "VERIFIED" 
  | "EXPIRED" 
  | "REMOVED" 
  | "BLOCKED" 
  | "UNVERIFIED" 
  | "TIMEOUT";

export const DEFAULT_FRESHNESS_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface VerificationOptions {
  maxCandidates?: number;
  candidateTimeoutMs?: number;
  globalTimeoutMs?: number;
  searchId?: string;
  allowedDomains?: string[];
  allowLocalForTests?: boolean;
}

export interface VerificationTelemetry {
  candidatesConsidered: number;
  candidatesVerified: number;
  candidatesRejected: number;
  candidatesTimedOut: number;
  browserExecutionMs: number;
  screenshotsCaptured: number;
}

export interface VerificationResult {
  verifiedOpportunities: RankedOpportunity[];
  telemetry: VerificationTelemetry;
}

export interface ContentValidationResult {
  isValid: boolean;
  status: LifecycleStatus;
  reason: string;
}

export interface RevalidationSummary {
  opportunityId: string;
  previousStatus: string;
  newStatus: string;
  sourcesConsidered: number;
  sourcesVerified: number;
  sourcesExpired: number;
  sourcesRemoved: number;
  sourcesBlocked: number;
  sourcesTimedOut: number;
  sourcesSkippedFresh: number;
  sources: Array<{
    platform: string;
    status: LifecycleStatus;
    reason: string;
    screenshotPath?: string | null;
  }>;
}

/**
 * Checks whether an opportunity or listing was verified recently enough to skip redundant browser execution.
 */
export function isListingFresh(
  lastVerifiedAt?: Date | string | null,
  ttlMs: number = DEFAULT_FRESHNESS_TTL_MS
): boolean {
  if (!lastVerifiedAt) return false;
  const verifiedTime = typeof lastVerifiedAt === "string" ? new Date(lastVerifiedAt).getTime() : lastVerifiedAt.getTime();
  if (isNaN(verifiedTime)) return false;
  return Date.now() - verifiedTime < ttlMs;
}

/**
 * Deterministically inspects page text, title, and status codes to classify the lifecycle state of a job page.
 * Distinguishes genuine job postings from blank pages, login walls, CAPTCHAs, 404s, and expired notices.
 */
export function validateJobPageContent(
  text: string,
  title: string,
  statusCode?: number
): ContentValidationResult {
  // 1. HTTP Status Code Evaluation
  if (statusCode) {
    if (statusCode === 404 || statusCode === 410) {
      return { isValid: false, status: "REMOVED", reason: `HTTP_STATUS_${statusCode}` };
    }
    if (statusCode === 403 || statusCode === 401) {
      return { isValid: false, status: "BLOCKED", reason: `HTTP_STATUS_${statusCode}` };
    }
    if (statusCode >= 500) {
      return { isValid: false, status: "UNVERIFIED", reason: `HTTP_STATUS_${statusCode}` };
    }
  }

  const cleanText = (text || "").trim();
  const cleanTitle = (title || "").trim().toLowerCase();
  const lowerText = cleanText.toLowerCase();

  // 2. Removed / 404 / Not Found text detection
  if (
    cleanTitle.includes("404") ||
    cleanTitle.includes("page not found") ||
    cleanTitle.includes("job not found") ||
    lowerText.includes("page not found") ||
    lowerText.includes("job not found") ||
    lowerText.includes("the job you requested was not found") ||
    lowerText.includes("the job you are looking for doesn't exist") ||
    lowerText.includes("the page you were looking for doesn't exist") ||
    lowerText.includes("404 - not found") ||
    lowerText.includes("error=true")
  ) {
    return { isValid: false, status: "REMOVED", reason: "JOB_EXPIRED_OR_NOT_FOUND" };
  }

  // 3. Expired job / closed posting detection
  if (
    lowerText.includes("job has expired") ||
    lowerText.includes("this job is no longer available") ||
    lowerText.includes("the job you are looking for is no longer open") ||
    lowerText.includes("is no longer open") ||
    lowerText.includes("position has been filled") ||
    lowerText.includes("posting closed") ||
    lowerText.includes("this position is closed") ||
    lowerText.includes("no longer accepting applications") ||
    lowerText.includes("this listing has ended") ||
    lowerText.includes("applications are now closed")
  ) {
    return { isValid: false, status: "EXPIRED", reason: "JOB_EXPIRED_OR_NOT_FOUND" };
  }

  // 4. CAPTCHA / WAF / Cloudflare Interstitial rejection (BLOCKED, NOT EXPIRED)
  if (
    lowerText.includes("verify you are human") ||
    lowerText.includes("please enable javascript and cookies") ||
    lowerText.includes("cloudflare ray id") ||
    lowerText.includes("attention required! | cloudflare") ||
    lowerText.includes("checking your browser before accessing") ||
    lowerText.includes("security check to continue")
  ) {
    return { isValid: false, status: "BLOCKED", reason: "BOT_CHALLENGE_OR_CAPTCHA_INTERSTITIAL" };
  }

  // 5. Hard Login Wall rejection (BLOCKED, NOT EXPIRED)
  const isLoginPrompt =
    cleanTitle.includes("sign in") ||
    cleanTitle.includes("login") ||
    lowerText.includes("sign in to see more") ||
    lowerText.includes("log in to continue");

  const hasJobSignals =
    /\b(responsibilities|qualifications|requirements|apply now|about the role|job description|salary|experience|internship|full-time)\b/i.test(
      lowerText
    );

  if (isLoginPrompt && !hasJobSignals) {
    return { isValid: false, status: "BLOCKED", reason: "AUTH_LOGIN_WALL_BLOCKING_CONTENT" };
  }

  // 6. Minimum body content threshold (anti-blank/white-screen protection)
  if (cleanText.length < 150) {
    return { isValid: false, status: "UNVERIFIED", reason: "BLANK_OR_INSUFFICIENT_BODY_CONTENT" };
  }

  // 7. Positive Job Content Heuristics
  if (hasJobSignals || cleanText.length > 500) {
    return { isValid: true, status: "VERIFIED", reason: "GENUINE_JOB_CONTENT_VERIFIED" };
  }

  return { isValid: false, status: "UNVERIFIED", reason: "MISSING_ACTIONABLE_JOB_SIGNALS" };
}

/**
 * Revalidates a single source listing via Playwright with SSRF guards and content heuristic classification.
 */
export async function revalidateSourceListing(
  listing: {
    id?: string;
    sourcePlatform: string;
    sourceUrl: string;
    applyUrl?: string | null;
    screenshotPath?: string | null;
    verificationStatus?: string | null;
    seenAt?: Date | string;
  },
  options: {
    timeoutMs?: number;
    force?: boolean;
    ttlMs?: number;
    allowLocalForTests?: boolean;
    searchId?: string;
  } = {}
): Promise<{
  status: LifecycleStatus;
  reason: string;
  screenshotPath?: string | null;
  verifiedAt: Date;
  skippedAsFresh?: boolean;
}> {
  const timeoutMs = options.timeoutMs || 2500;
  const searchId = options.searchId || "reval_live";

  // Check freshness policy: only skip if listing was already verified and is within TTL
  if (!options.force && listing.verificationStatus === "VERIFIED" && isListingFresh(listing.seenAt, options.ttlMs)) {
    return {
      status: "VERIFIED",
      reason: "SKIPPED_AS_FRESH",
      screenshotPath: listing.screenshotPath,
      verifiedAt: listing.seenAt ? new Date(listing.seenAt) : new Date(),
      skippedAsFresh: true,
    };
  }

  const targetUrl = listing.sourceUrl || listing.applyUrl;
  if (!targetUrl) {
    return {
      status: "UNVERIFIED",
      reason: "MISSING_TARGET_URL",
      screenshotPath: null,
      verifiedAt: new Date(),
    };
  }

  // SSRF Pre-flight check
  const allowLocal = options.allowLocalForTests ?? (process.env.IS_TEST_HARNESS === "true" || process.env.NODE_ENV === "test");
  if (!isSafePublicUrl(targetUrl, allowLocal)) {
    return {
      status: "BLOCKED",
      reason: "SSRF_GUARD_REJECTED_URL",
      screenshotPath: null,
      verifiedAt: new Date(),
    };
  }

  let session = null;
  try {
    session = await browserPool.createSession({
      jobId: `reval_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timeoutMs,
      viewport: { width: 1280, height: 800 },
    });

    let response = null;
    try {
      response = await session.page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });
    } catch (navErr) {
      const isTimeout = (navErr as Error).name === "TimeoutError" || (navErr as Error).message?.includes("Timeout");
      return {
        status: isTimeout ? "TIMEOUT" : "UNVERIFIED",
        reason: (navErr as Error).message || "NAVIGATION_ERROR",
        screenshotPath: null,
        verifiedAt: new Date(),
      };
    }

    const statusCode = response ? response.status() : 200;

    const pageEvaluation = await session.page.evaluate(() => {
      return {
        text: document.body ? document.body.innerText : "",
        title: document.title || "",
      };
    }).catch(() => ({ text: "", title: "" }));

    const validation = validateJobPageContent(pageEvaluation.text, pageEvaluation.title, statusCode);

    if (!validation.isValid) {
      return {
        status: validation.status,
        reason: validation.reason,
        screenshotPath: null,
        verifiedAt: new Date(),
      };
    }

    // Capture fresh screenshot for verified listing
    const screenshotBuffer = await session.page.screenshot({
      type: "png",
      fullPage: false,
      timeout: timeoutMs,
    });

    const filename = `evidence_reval_${Date.now()}.png`;
    await artifactStorage.saveArtifact(searchId, filename, screenshotBuffer);
    const screenshotPath = artifactStorage.getArtifactUrl(searchId, filename);

    return {
      status: "VERIFIED",
      reason: validation.reason,
      screenshotPath,
      verifiedAt: new Date(),
    };
  } catch (err) {
    return {
      status: "UNVERIFIED",
      reason: (err as Error).message || "UNEXPECTED_VERIFICATION_EXCEPTION",
      screenshotPath: null,
      verifiedAt: new Date(),
    };
  } finally {
    if (session) {
      await session.close().catch(() => {});
    }
  }
}

/**
 * Revalidates all child source listings for a canonical opportunity and derives its canonical lifecycle status.
 */
export async function revalidateOpportunity(
  opportunityId: string,
  options: {
    force?: boolean;
    timeoutMs?: number;
    ttlMs?: number;
    allowLocalForTests?: boolean;
  } = {}
): Promise<RevalidationSummary | null> {
  const opp = await getOpportunityWithSourceListings(opportunityId);
  if (!opp) return null;

  const summary: RevalidationSummary = {
    opportunityId: opp.id,
    previousStatus: opp.status,
    newStatus: opp.status,
    sourcesConsidered: opp.sourceListings.length,
    sourcesVerified: 0,
    sourcesExpired: 0,
    sourcesRemoved: 0,
    sourcesBlocked: 0,
    sourcesTimedOut: 0,
    sourcesSkippedFresh: 0,
    sources: [],
  };

  const updatedSourceStatuses: LifecycleStatus[] = [];

  for (const listing of opp.sourceListings) {
    const result = await revalidateSourceListing(
      {
        id: listing.id,
        sourcePlatform: listing.sourcePlatform,
        sourceUrl: listing.sourceUrl,
        applyUrl: listing.applyUrl,
        screenshotPath: listing.screenshotPath,
        verificationStatus: listing.verificationStatus,
        seenAt: listing.seenAt,
      },
      options
    );

    if (result.skippedAsFresh) {
      summary.sourcesSkippedFresh++;
    }

    if (result.status === "VERIFIED") summary.sourcesVerified++;
    else if (result.status === "EXPIRED") summary.sourcesExpired++;
    else if (result.status === "REMOVED") summary.sourcesRemoved++;
    else if (result.status === "BLOCKED") summary.sourcesBlocked++;
    else if (result.status === "TIMEOUT") summary.sourcesTimedOut++;

    summary.sources.push({
      platform: listing.sourcePlatform,
      status: result.status,
      reason: result.reason,
      screenshotPath: result.screenshotPath,
    });

    updatedSourceStatuses.push(result.status);

    // Persist updated source listing verification status
    if (!result.skippedAsFresh) {
      try {
        await upsertSourceListing({
          opportunityId: opp.id,
          sourcePlatform: listing.sourcePlatform,
          sourceUrl: listing.sourceUrl,
          applyUrl: listing.applyUrl,
          screenshotPath: result.screenshotPath,
          verificationStatus: result.status,
        });
      } catch (dbErr) {
        console.warn("[EvidenceVerifier] Failed to update source listing verification in DB:", (dbErr as Error).message);
      }
    }
  }

  // Derive Canonical Opportunity Status:
  // 1. If any source is active/verified -> ACTIVE
  // 2. If all sources are expired/removed -> EXPIRED
  // 3. Otherwise -> preserve previous status or ACTIVE
  let derivedStatus = opp.status;
  const hasVerifiedSource = updatedSourceStatuses.includes("VERIFIED");
  const allDead =
    updatedSourceStatuses.length > 0 &&
    updatedSourceStatuses.every((s) => s === "EXPIRED" || s === "REMOVED");

  if (allDead) {
    derivedStatus = "EXPIRED";
  } else if (hasVerifiedSource) {
    derivedStatus = "ACTIVE";
  }

  summary.newStatus = derivedStatus;

  // Persist canonical status update
  try {
    await updateOpportunityStatus(opp.id, derivedStatus, new Date());
  } catch (dbErr) {
    console.warn("[EvidenceVerifier] Failed to update opportunity canonical status in DB:", (dbErr as Error).message);
  }

  return summary;
}

/**
 * Revalidates saved opportunities for an authenticated user with strict concurrency and candidate bounds.
 */
export async function revalidateSavedOpportunities(
  userId: string,
  options: {
    maxCandidates?: number;
    force?: boolean;
    timeoutMs?: number;
    allowLocalForTests?: boolean;
  } = {}
): Promise<{
  totalSaved: number;
  revalidatedCount: number;
  summaries: RevalidationSummary[];
}> {
  const maxCandidates = Math.min(Math.max(options.maxCandidates || 5, 1), 10);
  const savedRecords = await getSavedOpportunities(userId);

  const candidatesToRevalidate = savedRecords.slice(0, maxCandidates);
  const summaries: RevalidationSummary[] = [];

  for (const record of candidatesToRevalidate) {
    const oppId = record.opportunity.id;
    if (!oppId) continue;
    const summary = await revalidateOpportunity(oppId, options);
    if (summary) {
      summaries.push(summary);
    }
  }

  return {
    totalSaved: savedRecords.length,
    revalidatedCount: summaries.length,
    summaries,
  };
}

/**
 * Executes bounded, failure-isolated evidence verification across top-ranked candidate opportunities during search discovery.
 */
export async function verifyEvidenceForOpportunities(
  rankedOpportunities: RankedOpportunity[],
  options: VerificationOptions = {}
): Promise<VerificationResult> {
  const startTime = Date.now();
  const maxCandidates = Math.min(Math.max(options.maxCandidates || 10, 1), 20);
  const candidateTimeoutMs = options.candidateTimeoutMs || 2500;
  const globalTimeoutMs = options.globalTimeoutMs || 12000;
  const searchId = options.searchId || `search_${Date.now()}`;

  const telemetry: VerificationTelemetry = {
    candidatesConsidered: 0,
    candidatesVerified: 0,
    candidatesRejected: 0,
    candidatesTimedOut: 0,
    browserExecutionMs: 0,
    screenshotsCaptured: 0,
  };

  if (!rankedOpportunities || rankedOpportunities.length === 0) {
    return {
      verifiedOpportunities: [],
      telemetry,
    };
  }

  const resultList: RankedOpportunity[] = rankedOpportunities.map((item) => ({
    ...item,
    opportunity: {
      ...item.opportunity,
      sourceListings: [...item.opportunity.sourceListings],
    },
  }));

  const candidateLimit = Math.min(resultList.length, maxCandidates);

  for (let i = 0; i < candidateLimit; i++) {
    if (Date.now() - startTime >= globalTimeoutMs) {
      console.warn(`[EvidenceVerifier] Global verification budget exhausted (${globalTimeoutMs}ms). Stopping remaining verifications.`);
      break;
    }

    const current = resultList[i];
    const opp = current.opportunity;

    const primaryListing = opp.sourceListings[0];
    if (!primaryListing) continue;

    const targetUrl = primaryListing.sourceUrl || primaryListing.applyUrl || opp.primaryApplyUrl;
    if (!targetUrl) continue;

    telemetry.candidatesConsidered++;

    const allowLocal = options.allowLocalForTests ?? (process.env.IS_TEST_HARNESS === "true" || process.env.NODE_ENV === "test");
    if (!isSafePublicUrl(targetUrl, allowLocal)) {
      primaryListing.verificationStatus = "UNVERIFIED";
      telemetry.candidatesRejected++;
      continue;
    }

    const sessionJobId = `verify_${opp.canonicalHash}_${Date.now()}`;
    let session = null;

    try {
      session = await browserPool.createSession({
        jobId: sessionJobId,
        timeoutMs: candidateTimeoutMs,
        viewport: { width: 1280, height: 800 },
        allowedDomains: options.allowedDomains,
      });

      let response = null;
      try {
        response = await session.page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: candidateTimeoutMs,
        });
      } catch (navErr) {
        if ((navErr as Error).name === "TimeoutError" || (navErr as Error).message?.includes("Timeout")) {
          telemetry.candidatesTimedOut++;
        } else {
          telemetry.candidatesRejected++;
        }
        primaryListing.verificationStatus = "UNVERIFIED";
        continue;
      }

      const statusCode = response ? response.status() : 200;

      const pageEvaluation = await session.page.evaluate(() => {
        return {
          text: document.body ? document.body.innerText : "",
          title: document.title || "",
        };
      }).catch(() => ({ text: "", title: "" }));

      const validation = validateJobPageContent(pageEvaluation.text, pageEvaluation.title, statusCode);

      if (!validation.isValid) {
        telemetry.candidatesRejected++;
        primaryListing.verificationStatus = "UNVERIFIED";
        continue;
      }

      const screenshotBuffer = await session.page.screenshot({
        type: "png",
        fullPage: false,
        timeout: candidateTimeoutMs,
      });

      const filename = `evidence_${opp.canonicalHash.slice(0, 12)}_${Date.now()}.png`;
      await artifactStorage.saveArtifact(searchId, filename, screenshotBuffer);
      const screenshotPath = artifactStorage.getArtifactUrl(searchId, filename);

      primaryListing.screenshotPath = screenshotPath;
      primaryListing.verificationStatus = "VERIFIED";
      opp.lastVerifiedAt = new Date();

      telemetry.candidatesVerified++;
      telemetry.screenshotsCaptured++;

      try {
        const dbOpp = await getOpportunityByCanonicalHash(opp.canonicalHash);
        if (dbOpp) {
          await upsertSourceListing({
            opportunityId: dbOpp.id,
            sourcePlatform: primaryListing.sourcePlatform,
            sourceUrl: primaryListing.sourceUrl,
            applyUrl: primaryListing.applyUrl,
            screenshotPath,
            verificationStatus: "VERIFIED",
          });
        }
      } catch {
        // Non-fatal
      }
    } catch (err) {
      console.warn(`[EvidenceVerifier] Verification exception on candidate #${i + 1}:`, (err as Error).message);
      primaryListing.verificationStatus = "UNVERIFIED";
      telemetry.candidatesRejected++;
    } finally {
      if (session) {
        await session.close().catch(() => {});
      }
    }
  }

  telemetry.browserExecutionMs = Date.now() - startTime;

  return {
    verifiedOpportunities: resultList,
    telemetry,
  };
}
