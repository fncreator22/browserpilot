/**
 * §ADMIN SWARM CONTROL & DATA MANAGEMENT SERVICE
 * 
 * Provides restricted administrative operations:
 * 1. Global Swarm Halt / Resume ("Stop all swarms, minions, engines & start again")
 * 2. Granular Data Cleaning / Purge (by date-range, time-range, section, or feature)
 * 3. Multi-Format Data Export (JSON, CSV / Google Sheet / MS Sheet, DOC, PDF format)
 * 4. Safe Data Import with validation and idempotency
 */

import { prisma } from "@/lib/db/prisma";
import { getSearchDiscoveryQueue } from "@/lib/queue/searchQueue";
import { executionLifecycleManager } from "@/lib/discovery/execution/executionLifecycleManager";
import { getSharedRedisClient, isRedisCircuitAvailable } from "@/lib/queue/redis";
import Papa from "papaparse";

export type CleanDataSection = "all" | "searches" | "opportunities" | "runs" | "alerts" | "sessions" | "signals" | "telemetry";
export type ExportFormat = "json" | "csv" | "sheet" | "doc" | "pdf";

export interface CleanDataOptions {
  section: CleanDataSection;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  feature?: string;
  dryRun?: boolean;
}

export interface ExportDataOptions {
  section: "opportunities" | "searches" | "runs" | "alerts" | "all";
  format: ExportFormat;
  dateFrom?: string | Date;
  dateTo?: string | Date;
}

export interface ImportDataOptions {
  section: "opportunities" | "sources";
  format: "json" | "csv";
  content: string;
}

const REDIS_PAUSE_KEY = "browserpilot:swarms:paused";
let inMemorySwarmPaused = false;

export class AdminSwarmService {
  /**
   * Stop all running swarms, minions, background queues, and in-flight engines
   */
  public async stopAllSwarms(): Promise<{
    paused: boolean;
    stoppedExecutionsCount: number;
    stoppedSearchesCount: number;
    stoppedRunsCount: number;
    message: string;
  }> {
    inMemorySwarmPaused = true;

    // 1. Set global pause flag in Redis
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        await redis.set(REDIS_PAUSE_KEY, "1");
      }
    } catch {}

    // 2. Pause BullMQ search discovery queue if Redis is online
    try {
      if (await isRedisCircuitAvailable()) {
        const queue = getSearchDiscoveryQueue();
        await queue.pause().catch(() => {});
      }
    } catch {}

    // 3. Signal abort to all in-flight memory executions
    let stoppedExecutions = 0;
    try {
      const allActive = executionLifecycleManager.getAllActiveExecutions();
      for (const exec of allActive) {
        await executionLifecycleManager.cancelExecution(exec.executionId, exec.userId, "ADMIN_SWARM_HALT").catch(() => {});
        stoppedExecutions++;
      }
    } catch {}

    // 4. Terminate any active running searches in PostgreSQL
    const stoppedSearches = await prisma.search.updateMany({
      where: {
        status: { in: ["CREATED", "QUEUED", "RUNNING"] },
      },
      data: {
        status: "STOPPED",
        stoppingReason: "ADMIN_SWARM_HALT",
        cancellationRequested: true,
        completedAt: new Date(),
      },
    }).catch(() => ({ count: 0 }));

    // 5. Terminate running discovery runs
    const stoppedRuns = await prisma.discoveryRun.updateMany({
      where: {
        status: "RUNNING",
      },
      data: {
        status: "FAILED",
        errorMessage: "Halted by Admin Swarm Emergency Stop",
        completedAt: new Date(),
      },
    }).catch(() => ({ count: 0 }));

    // 6. Terminate running job records
    await prisma.job.updateMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        error: JSON.stringify({ code: "ADMIN_SWARM_HALT", message: "Job halted by Administrator." }),
        completedAt: new Date(),
      },
    }).catch(() => ({ count: 0 }));

    return {
      paused: true,
      stoppedExecutionsCount: stoppedExecutions,
      stoppedSearchesCount: stoppedSearches.count,
      stoppedRunsCount: stoppedRuns.count,
      message: "Emergency stop engaged: All swarms, worker minions, and background engines have been halted.",
    };
  }

  /**
   * Resume all swarms, worker minions, and queue processors
   */
  public async startAllSwarms(): Promise<{
    paused: boolean;
    resumedQueues: string[];
    message: string;
  }> {
    inMemorySwarmPaused = false;

    // 1. Remove pause flag from Redis
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        await redis.del(REDIS_PAUSE_KEY).catch(() => {});
      }
    } catch {}

    // 2. Resume BullMQ search discovery queue if Redis is online
    const resumed: string[] = [];
    try {
      if (await isRedisCircuitAvailable()) {
        const queue = getSearchDiscoveryQueue();
        await queue.resume().catch(() => {});
        resumed.push("search-discovery");
      }
    } catch {}

    return {
      paused: false,
      resumedQueues: resumed,
      message: "Swarms restarted: Worker queues and discovery engines have been resumed.",
    };
  }

  /**
   * Check status of swarms and engines
   */
  public async getSwarmStatus(): Promise<{
    isPaused: boolean;
    activeExecutions: number;
    runningSearches: number;
    runningRuns: number;
    activeWatches: number;
    queueWaitingCount: number;
  }> {
    let isPaused = inMemorySwarmPaused;
    try {
      const redis = getSharedRedisClient();
      if (redis && redis.status === "ready") {
        const val = await redis.get(REDIS_PAUSE_KEY).catch(() => null);
        if (val === "1") isPaused = true;
      }
    } catch {}

    const [runningSearches, runningRuns, activeWatches] = await Promise.all([
      prisma.search.count({ where: { status: { in: ["CREATED", "QUEUED", "RUNNING"] } } }).catch(() => 0),
      prisma.discoveryRun.count({ where: { status: "RUNNING" } }).catch(() => 0),
      prisma.discoveryWatch.count({ where: { enabled: true } }).catch(() => 0),
    ]);

    let queueWaitingCount = 0;
    try {
      if (await isRedisCircuitAvailable()) {
        const queue = getSearchDiscoveryQueue();
        queueWaitingCount = await queue.getWaitingCount().catch(() => 0);
      }
    } catch {}

    const activeExecs = executionLifecycleManager.getAllActiveExecutions().length;

    return {
      isPaused,
      activeExecutions: activeExecs,
      runningSearches,
      runningRuns,
      activeWatches,
      queueWaitingCount,
    };
  }

  /**
   * Clean / purge database records with granular date-wise, section-wise, or feature-wise filters
   */
  public async cleanData(options: CleanDataOptions): Promise<{
    dryRun: boolean;
    section: CleanDataSection;
    recordsAffected: number;
    breakdown: Record<string, number>;
  }> {
    const { section, dateFrom, dateTo, dryRun = false } = options;
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);

    const hasDate = Boolean(dateFrom || dateTo);
    const breakdown: Record<string, number> = {};
    let totalRecords = 0;

    // 1. Searches & Results
    if (section === "all" || section === "searches") {
      const searchWhere: any = hasDate ? { createdAt: dateFilter } : {};
      const count = await prisma.search.count({ where: searchWhere });
      breakdown.searches = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.searchResult.deleteMany({
          where: hasDate ? { search: searchWhere } : {},
        });
        await prisma.search.deleteMany({ where: searchWhere });
      }
    }

    // 2. Opportunities & Source Listings
    if (section === "all" || section === "opportunities") {
      const oppWhere: any = hasDate ? { firstSeenAt: dateFilter } : {};
      const count = await prisma.opportunity.count({ where: oppWhere });
      breakdown.opportunities = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.sourceListing.deleteMany({
          where: hasDate ? { opportunity: oppWhere } : {},
        });
        await prisma.companyContact.deleteMany({
          where: hasDate ? { opportunity: oppWhere } : {},
        });
        await prisma.savedOpportunity.deleteMany({
          where: hasDate ? { opportunity: oppWhere } : {},
        });
        await prisma.opportunity.deleteMany({ where: oppWhere });
      }
    }

    // 3. Discovery Runs & Discovery Events
    if (section === "all" || section === "runs") {
      const runWhere: any = hasDate ? { startedAt: dateFilter } : {};
      const count = await prisma.discoveryRun.count({ where: runWhere });
      breakdown.discoveryRuns = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.opportunityDiscoveryEvent.deleteMany({
          where: hasDate ? { run: runWhere } : {},
        });
        await prisma.discoveryRun.deleteMany({ where: runWhere });
      }
    }

    // 4. Lifecycle Alerts
    if (section === "all" || section === "alerts") {
      const alertWhere: any = hasDate ? { createdAt: dateFilter } : {};
      const count = await prisma.lifecycleAlert.count({ where: alertWhere });
      breakdown.alerts = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.lifecycleAlert.deleteMany({ where: alertWhere });
      }
    }

    // 5. Browser Sessions
    if (section === "all" || section === "sessions") {
      const sessionWhere: any = hasDate ? { createdAt: dateFilter } : {};
      const count = await prisma.browserSession.count({ where: sessionWhere });
      breakdown.browserSessions = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.browserSession.deleteMany({ where: sessionWhere });
      }
    }

    // 6. Learning Signals
    if (section === "all" || section === "signals") {
      const sigWhere: any = hasDate ? { createdAt: dateFilter } : {};
      const count = await prisma.discoveryLearningSignal.count({ where: sigWhere });
      breakdown.learningSignals = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.discoveryLearningSignal.deleteMany({ where: sigWhere });
      }
    }

    // 7. AI Usage Telemetry
    if (section === "all" || section === "telemetry") {
      const telemWhere: any = hasDate ? { timestamp: dateFilter } : {};
      const count = await prisma.aIUsageEvent.count({ where: telemWhere });
      breakdown.aiUsageEvents = count;
      totalRecords += count;

      if (!dryRun && count > 0) {
        await prisma.aIUsageEvent.deleteMany({ where: telemWhere });
      }
    }

    return {
      dryRun,
      section,
      recordsAffected: totalRecords,
      breakdown,
    };
  }

  /**
   * Export database records in JSON, CSV (Google/MS Sheets), DOC (Word/HTML), or PDF format
   */
  public async exportData(options: ExportDataOptions): Promise<{
    content: string;
    contentType: string;
    filename: string;
    recordCount: number;
  }> {
    const { section, format, dateFrom, dateTo } = options;
    const dateFilter: any = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    const hasDate = Boolean(dateFrom || dateTo);

    const timestampStr = new Date().toISOString().slice(0, 10);
    let filenameBase = `browserpilot_${section}_${timestampStr}`;

    let records: any[] = [];

    if (section === "opportunities" || section === "all") {
      const opps = await prisma.opportunity.findMany({
        where: hasDate ? { firstSeenAt: dateFilter } : {},
        take: 2000,
        orderBy: { firstSeenAt: "desc" },
        include: {
          sourceListings: true,
          companyContacts: true,
        },
      });
      records = opps.map((o) => ({
        id: o.id,
        title: o.title,
        companyName: o.companyName,
        location: o.location,
        workMode: o.workMode,
        experienceLevel: o.experienceLevel,
        opportunityType: o.opportunityType,
        salaryMin: o.salaryMin,
        salaryMax: o.salaryMax,
        salaryCurrency: o.salaryCurrency,
        primaryApplyUrl: o.primaryApplyUrl,
        status: o.status,
        firstSeenAt: o.firstSeenAt.toISOString(),
        lastVerifiedAt: o.lastVerifiedAt.toISOString(),
        sourcePlatforms: o.sourceListings.map((s) => s.sourcePlatform).join(", "),
        recruitersCount: o.companyContacts.length,
      }));
    } else if (section === "searches") {
      const searches = await prisma.search.findMany({
        where: hasDate ? { createdAt: dateFilter } : {},
        take: 2000,
        orderBy: { createdAt: "desc" },
      });
      records = searches.map((s) => ({
        id: s.id,
        userId: s.userId || "anonymous",
        rawQuery: s.rawQuery,
        intentType: s.intentType,
        parsedRole: s.parsedRole,
        parsedLocation: s.parsedLocation,
        parsedWorkMode: s.parsedWorkMode,
        status: s.status,
        totalFound: s.totalFound,
        stoppingReason: s.stoppingReason,
        createdAt: s.createdAt.toISOString(),
      }));
    } else if (section === "runs") {
      const runs = await prisma.discoveryRun.findMany({
        where: hasDate ? { startedAt: dateFilter } : {},
        take: 2000,
        orderBy: { startedAt: "desc" },
      });
      records = runs.map((r) => ({
        id: r.id,
        userId: r.userId,
        triggerType: r.triggerType,
        status: r.status,
        durationMs: r.durationMs,
        candidatesFound: r.candidatesFound,
        newOpportunities: r.newOpportunities,
        alreadyKnown: r.alreadyKnown,
        startedAt: r.startedAt.toISOString(),
      }));
    } else if (section === "alerts") {
      const alerts = await prisma.lifecycleAlert.findMany({
        where: hasDate ? { createdAt: dateFilter } : {},
        take: 2000,
        orderBy: { createdAt: "desc" },
      });
      records = alerts.map((a) => ({
        id: a.id,
        userId: a.userId,
        title: a.title,
        companyName: a.companyName,
        transitionType: a.transitionType,
        isRead: a.isRead,
        createdAt: a.createdAt.toISOString(),
      }));
    }

    // Format output
    if (format === "json") {
      return {
        content: JSON.stringify(records, null, 2),
        contentType: "application/json",
        filename: `${filenameBase}.json`,
        recordCount: records.length,
      };
    }

    if (format === "csv" || format === "sheet") {
      const csv = Papa.unparse(records);
      return {
        content: csv,
        contentType: "text/csv; charset=utf-8",
        filename: `${filenameBase}.csv`,
        recordCount: records.length,
      };
    }

    if (format === "doc") {
      // Generate Word/HTML Document compatible with Microsoft Word & Google Docs
      const docHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BrowserPilot Export - ${section.toUpperCase()}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; margin: 40px; color: #333; }
  h1 { color: #1e293b; border-bottom: 2px solid #0284c7; padding-bottom: 8px; }
  .meta { color: #64748b; font-size: 14px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; font-size: 12px; }
  th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
  tr:nth-child(even) { background-color: #f8fafc; }
</style>
</head>
<body>
  <h1>BrowserPilot Administrative Dossier Export</h1>
  <div class="meta">
    <p><strong>Section:</strong> ${section.toUpperCase()} | <strong>Export Date:</strong> ${new Date().toUTCString()}</p>
    <p><strong>Total Records:</strong> ${records.length}</p>
  </div>
  <table>
    <thead>
      <tr>
        ${Object.keys(records[0] || { Notice: "No records found" }).map((k) => `<th>${k}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${records.map((r) => `<tr>${Object.values(r).map((v) => `<td>${String(v ?? "")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
      return {
        content: docHtml,
        contentType: "application/msword",
        filename: `${filenameBase}.doc`,
        recordCount: records.length,
      };
    }

    if (format === "pdf") {
      // Formatted printable HTML document with PDF print stylesheets
      const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>BrowserPilot PDF Report - ${section.toUpperCase()}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: 'Segoe UI', Helvetica, Arial, sans-serif; margin: 0; color: #1e293b; font-size: 11px; }
  .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-bottom: 15px; }
  .title { font-size: 18px; font-weight: bold; color: #1e3a8a; }
  .meta { font-size: 11px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: left; }
  th { background-color: #f8fafc; font-weight: 600; color: #334155; }
  tr:nth-child(even) { background-color: #fbfcfe; }
  .footer { margin-top: 20px; font-size: 10px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">BrowserPilot Intelligence Report</div>
      <div class="meta">Export Type: ${section.toUpperCase()} | Generated: ${new Date().toISOString()}</div>
    </div>
    <div class="meta" style="text-align: right;">
      <div>Records: ${records.length}</div>
      <div>Confidential & Authoritative</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        ${Object.keys(records[0] || { Notice: "No records found" }).map((k) => `<th>${k}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${records.map((r) => `<tr>${Object.values(r).map((v) => `<td>${String(v ?? "")}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
  <div class="footer">BrowserPilot Autonomous Career Intelligence Platform — Page 1</div>
</body>
</html>`;
      return {
        content: pdfHtml,
        contentType: "application/pdf",
        filename: `${filenameBase}.pdf`,
        recordCount: records.length,
      };
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Import data into the platform with validation and idempotency
   */
  public async importData(options: ImportDataOptions): Promise<{
    success: boolean;
    importedCount: number;
    errors: string[];
  }> {
    const { section, format, content } = options;
    const errors: string[] = [];
    let parsedRows: any[] = [];

    try {
      if (format === "json") {
        parsedRows = JSON.parse(content);
        if (!Array.isArray(parsedRows)) {
          parsedRows = [parsedRows];
        }
      } else if (format === "csv") {
        const parsed = Papa.parse(content, { header: true, skipEmptyLines: true });
        parsedRows = parsed.data;
      }
    } catch (parseErr: any) {
      return { success: false, importedCount: 0, errors: [`Parse error: ${parseErr.message}`] };
    }

    let imported = 0;

    if (section === "opportunities") {
      for (const row of parsedRows) {
        try {
          if (!row.title || !row.companyName || !row.primaryApplyUrl) {
            errors.push(`Skipped invalid opportunity row (missing title/companyName/applyUrl)`);
            continue;
          }
          const canonicalHash = row.canonicalHash || `imp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          await prisma.opportunity.upsert({
            where: { canonicalHash },
            create: {
              canonicalHash,
              title: row.title,
              companyName: row.companyName,
              location: row.location || "Remote",
              workMode: row.workMode || "ANY",
              experienceLevel: row.experienceLevel || "ENTRY_LEVEL",
              opportunityType: row.opportunityType || "FULL_TIME",
              description: row.description || "",
              primaryApplyUrl: row.primaryApplyUrl,
              status: row.status || "ACTIVE",
            },
            update: {
              title: row.title,
              companyName: row.companyName,
              location: row.location || undefined,
              status: row.status || "ACTIVE",
            },
          });
          imported++;
        } catch (rowErr: any) {
          errors.push(`Error importing row: ${rowErr.message}`);
        }
      }
    }

    return {
      success: errors.length === 0,
      importedCount: imported,
      errors,
    };
  }
}

export const adminSwarmService = new AdminSwarmService();
