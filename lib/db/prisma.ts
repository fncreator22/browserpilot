import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initializedTables: boolean | undefined;
};

/**
 * Core SQL schema DDL for SQLite and Turso database instances
 */
export const SCHEMA_DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  geminiApiKey TEXT,
  role TEXT NOT NULL DEFAULT 'USER',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  userId TEXT,
  prompt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED',
  progress INTEGER NOT NULL DEFAULT 0,
  allowedDomains TEXT NOT NULL DEFAULT '[]',
  maxStepsBudget INTEGER NOT NULL DEFAULT 15,
  goal TEXT,
  confidence REAL,
  summary TEXT,
  error TEXT,
  result TEXT,
  totalDurationMs INTEGER,
  tokensUsed INTEGER,
  memoryMb REAL,
  maxDurationMs INTEGER NOT NULL DEFAULT 120000,
  startedAt DATETIME,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS job_steps (
  id TEXT PRIMARY KEY,
  jobId TEXT NOT NULL,
  stepNumber INTEGER NOT NULL,
  tool TEXT NOT NULL,
  actionPayload TEXT NOT NULL,
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jobId) REFERENCES jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  jobId TEXT NOT NULL,
  stepIndex INTEGER NOT NULL,
  tool TEXT NOT NULL,
  status TEXT NOT NULL,
  currentUrl TEXT NOT NULL,
  title TEXT NOT NULL,
  pageSummary TEXT,
  extractedData TEXT,
  screenshotPath TEXT,
  error TEXT,
  elapsedMs INTEGER NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jobId) REFERENCES jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  jobId TEXT NOT NULL,
  filename TEXT NOT NULL,
  storageKey TEXT NOT NULL,
  mimeType TEXT NOT NULL DEFAULT 'image/png',
  sizeBytes INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jobId) REFERENCES jobs (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS searches (
  id TEXT PRIMARY KEY,
  userId TEXT,
  rawQuery TEXT NOT NULL,
  intentType TEXT NOT NULL DEFAULT 'JOB_SEARCH_GENERAL',
  parsedRole TEXT,
  parsedSkills TEXT NOT NULL DEFAULT '[]',
  parsedLocation TEXT,
  parsedWorkMode TEXT NOT NULL DEFAULT 'ANY',
  targetGradYear INTEGER,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  totalFound INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  canonicalHash TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  companyName TEXT NOT NULL,
  location TEXT NOT NULL,
  workMode TEXT NOT NULL DEFAULT 'ANY',
  experienceLevel TEXT NOT NULL DEFAULT 'ENTRY_LEVEL',
  opportunityType TEXT NOT NULL DEFAULT 'FULL_TIME',
  salaryMin REAL,
  salaryMax REAL,
  salaryCurrency TEXT DEFAULT 'USD',
  description TEXT NOT NULL,
  requirements TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  primaryApplyUrl TEXT NOT NULL,
  firstSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastVerifiedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE IF NOT EXISTS source_listings (
  id TEXT PRIMARY KEY,
  opportunityId TEXT NOT NULL,
  sourcePlatform TEXT NOT NULL,
  externalJobId TEXT,
  sourceUrl TEXT NOT NULL,
  applyUrl TEXT NOT NULL,
  screenshotPath TEXT,
  verificationStatus TEXT NOT NULL DEFAULT 'VERIFIED',
  rawSnippet TEXT,
  seenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE,
  UNIQUE(sourcePlatform, sourceUrl)
);

CREATE TABLE IF NOT EXISTS search_results (
  id TEXT PRIMARY KEY,
  searchId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,
  matchScore REAL NOT NULL DEFAULT 0.0,
  rankPosition INTEGER NOT NULL DEFAULT 0,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (searchId) REFERENCES searches (id) ON DELETE CASCADE,
  FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE,
  UNIQUE(searchId, opportunityId)
);

CREATE TABLE IF NOT EXISTS saved_opportunities (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,
  notes TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE,
  UNIQUE(userId, opportunityId)
);

CREATE TABLE IF NOT EXISTS lifecycle_alerts (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,
  transitionType TEXT NOT NULL,
  previousStatus TEXT NOT NULL,
  newStatus TEXT NOT NULL,
  title TEXT NOT NULL,
  companyName TEXT NOT NULL,
  message TEXT NOT NULL,
  isRead BOOLEAN NOT NULL DEFAULT 0,
  idempotencyKey TEXT UNIQUE NOT NULL,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discovery_watches (
  id TEXT PRIMARY KEY,
  userId TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT 1,
  roles TEXT NOT NULL DEFAULT '[]',
  skills TEXT NOT NULL DEFAULT '[]',
  locations TEXT NOT NULL DEFAULT '[]',
  companies TEXT NOT NULL DEFAULT '[]',
  workModes TEXT NOT NULL DEFAULT '[]',
  experienceLevels TEXT NOT NULL DEFAULT '[]',
  opportunityTypes TEXT NOT NULL DEFAULT '[]',
  preferredSources TEXT NOT NULL DEFAULT '[]',
  minimumMatchScore REAL NOT NULL DEFAULT 70.0,
  latestOnly BOOLEAN NOT NULL DEFAULT 0,
  freshnessWindowHours INTEGER NOT NULL DEFAULT 48,
  scanIntervalHours INTEGER NOT NULL DEFAULT 6,
  lastScannedAt DATETIME,
  nextScanAt DATETIME,
  lockedAt DATETIME,
  lockOwner TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  triggerType TEXT NOT NULL DEFAULT 'MANUAL',
  status TEXT NOT NULL DEFAULT 'RUNNING',
  startedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completedAt DATETIME,
  durationMs INTEGER,
  providersAttempted INTEGER NOT NULL DEFAULT 0,
  providersSucceeded INTEGER NOT NULL DEFAULT 0,
  providersFailed INTEGER NOT NULL DEFAULT 0,
  candidatesFound INTEGER NOT NULL DEFAULT 0,
  validCandidates INTEGER NOT NULL DEFAULT 0,
  newOpportunities INTEGER NOT NULL DEFAULT 0,
  newSources INTEGER NOT NULL DEFAULT 0,
  alreadyKnown INTEGER NOT NULL DEFAULT 0,
  reposted INTEGER NOT NULL DEFAULT 0,
  notificationsCreated INTEGER NOT NULL DEFAULT 0,
  errorMessage TEXT,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS opportunity_discovery_events (
  id TEXT PRIMARY KEY,
  runId TEXT NOT NULL,
  userId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,
  classification TEXT NOT NULL,
  matchScore REAL NOT NULL DEFAULT 0.0,
  freshnessClass TEXT NOT NULL DEFAULT 'UNKNOWN',
  notificationCreated BOOLEAN NOT NULL DEFAULT 0,
  discoveredAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (runId) REFERENCES discovery_runs (id) ON DELETE CASCADE,
  FOREIGN KEY (opportunityId) REFERENCES opportunities (id) ON DELETE CASCADE,
  UNIQUE(userId, opportunityId, runId)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  userId TEXT UNIQUE NOT NULL,
  onboardingCompleted BOOLEAN NOT NULL DEFAULT 0,
  onboardingVersion INTEGER NOT NULL DEFAULT 1,
  acquisitionSource TEXT,
  userCategory TEXT,
  usageContext TEXT,
  experienceLevel TEXT,
  preferredRoles TEXT NOT NULL DEFAULT '[]',
  preferredLocations TEXT NOT NULL DEFAULT '[]',
  preferredWorkModes TEXT NOT NULL DEFAULT '[]',
  targetSkills TEXT NOT NULL DEFAULT '[]',
  organizationName TEXT,
  organizationSize TEXT,
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,
  connectionMethod TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONNECTED',
  providerUsername TEXT,
  maskedCredential TEXT,
  encryptedCredential TEXT,
  lastVerifiedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lastVerificationStatus TEXT NOT NULL DEFAULT 'VALID',
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(userId, provider)
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  operation TEXT NOT NULL,
  inputTokens INTEGER NOT NULL DEFAULT 0,
  outputTokens INTEGER NOT NULL DEFAULT 0,
  totalTokens INTEGER NOT NULL DEFAULT 0,
  durationMs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'SUCCESS',
  errorMessage TEXT,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT 1,
  priceMonthly REAL NOT NULL DEFAULT 0.0,
  priceYearly REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'USD',
  maxWatches INTEGER NOT NULL DEFAULT 1,
  maxDailyDiscoveries INTEGER NOT NULL DEFAULT 10,
  maxMonthlyAIOperations INTEGER NOT NULL DEFAULT 100,
  allowedIntervals TEXT NOT NULL DEFAULT '["TWENTY_FOUR_HOURS"]',
  supportsCompanyTargeting BOOLEAN NOT NULL DEFAULT 0,
  supportsAdvancedFilters BOOLEAN NOT NULL DEFAULT 0,
  supportsPuterPremium BOOLEAN NOT NULL DEFAULT 0,
  supportsPriorityExecution BOOLEAN NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  planId TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  billingInterval TEXT NOT NULL DEFAULT 'MONTHLY',
  currentPeriodStart DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  currentPeriodEnd DATETIME,
  cancelAtPeriodEnd BOOLEAN NOT NULL DEFAULT 0,
  cancelledAt DATETIME,
  paymentProvider TEXT,
  providerSubscriptionId TEXT,
  providerCustomerId TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (planId) REFERENCES plans (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discountType TEXT NOT NULL DEFAULT 'PERCENTAGE',
  discountValue REAL NOT NULL DEFAULT 0.0,
  targetPlanId TEXT,
  maxRedemptions INTEGER NOT NULL DEFAULT 100,
  redemptionCount INTEGER NOT NULL DEFAULT 0,
  validFrom DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validUntil DATETIME,
  active BOOLEAN NOT NULL DEFAULT 1,
  createdById TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (targetPlanId) REFERENCES plans (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id TEXT PRIMARY KEY,
  couponId TEXT NOT NULL,
  userId TEXT NOT NULL,
  redeemedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discountGranted REAL NOT NULL DEFAULT 0.0,
  metadata TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY (couponId) REFERENCES coupons (id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(couponId, userId)
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  subscriptionId TEXT,
  planId TEXT,
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  provider TEXT NOT NULL DEFAULT 'RAZORPAY',
  providerOrderId TEXT,
  providerPaymentId TEXT,
  providerSignature TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  failureReason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_createdAt ON jobs (createdAt);
CREATE INDEX IF NOT EXISTS idx_job_steps_jobId_stepNumber ON job_steps (jobId, stepNumber);
CREATE INDEX IF NOT EXISTS idx_observations_jobId_stepIndex ON observations (jobId, stepIndex);
CREATE INDEX IF NOT EXISTS idx_artifacts_jobId ON artifacts (jobId);
CREATE INDEX IF NOT EXISTS idx_searches_userId ON searches (userId);
CREATE INDEX IF NOT EXISTS idx_searches_createdAt ON searches (createdAt);
CREATE INDEX IF NOT EXISTS idx_opportunities_workMode ON opportunities (workMode);
CREATE INDEX IF NOT EXISTS idx_opportunities_experienceLevel ON opportunities (experienceLevel);
CREATE INDEX IF NOT EXISTS idx_opportunities_lastVerifiedAt ON opportunities (lastVerifiedAt);
CREATE INDEX IF NOT EXISTS idx_source_listings_opportunityId ON source_listings (opportunityId);
CREATE INDEX IF NOT EXISTS idx_search_results_searchId_rankPosition ON search_results (searchId, rankPosition);
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_userId ON saved_opportunities (userId);
CREATE INDEX IF NOT EXISTS idx_user_profiles_userId ON user_profiles (userId);
CREATE INDEX IF NOT EXISTS idx_user_profiles_userCategory ON user_profiles (userCategory);
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboardingCompleted ON user_profiles (onboardingCompleted);
CREATE INDEX IF NOT EXISTS idx_provider_connections_userId_status ON provider_connections (userId, status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_userId_timestamp ON ai_usage_events (userId, timestamp);
CREATE INDEX IF NOT EXISTS idx_ai_usage_events_provider_timestamp ON ai_usage_events (provider, timestamp);
CREATE INDEX IF NOT EXISTS idx_plans_code ON plans (code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_userId_status ON subscriptions (userId, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions (status);
CREATE INDEX IF NOT EXISTS idx_coupons_code_active ON coupons (code, active);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_userId ON coupon_redemptions (userId);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_userId_status ON payment_transactions (userId, status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_providerOrderId ON payment_transactions (providerOrderId);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_providerPaymentId ON payment_transactions (providerPaymentId);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_userId_isRead ON lifecycle_alerts (userId, isRead);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_userId_createdAt ON lifecycle_alerts (userId, createdAt);
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_opportunityId ON lifecycle_alerts (opportunityId);
CREATE INDEX IF NOT EXISTS idx_discovery_watches_enabled_nextScanAt ON discovery_watches (enabled, nextScanAt);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_userId_startedAt ON discovery_runs (userId, startedAt);
CREATE INDEX IF NOT EXISTS idx_discovery_runs_triggerType ON discovery_runs (triggerType);
CREATE INDEX IF NOT EXISTS idx_opportunity_discovery_events_userId_discoveredAt ON opportunity_discovery_events (userId, discoveredAt);
CREATE INDEX IF NOT EXISTS idx_opportunity_discovery_events_opportunityId ON opportunity_discovery_events (opportunityId);
`;

/**
 * Check if Turso cloud database credentials are configured
 */
export function getTursoConfig(): { url: string; authToken: string } | null {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.TURSO_URL ||
    (process.env.DATABASE_URL?.startsWith("libsql:") ? process.env.DATABASE_URL : null);
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.TURSO_TOKEN;

  if (url && authToken) {
    return { url, authToken };
  }
  return null;
}

/**
 * Determine accurate database file path across local dev and testing environments
 * (Ephemeral /tmp/dev.db removed to ensure 100% cloud persistence or deterministic local file)
 */
export function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && (envUrl.startsWith("postgres") || envUrl.startsWith("mysql") || envUrl.startsWith("prisma"))) {
    return envUrl;
  }

  return envUrl || "file:./dev.db";
}

/**
 * Check if the target database is PostgreSQL
 */
export function isPostgresDatabase(url?: string): boolean {
  const dbUrl = url || process.env.DATABASE_URL || "";
  return dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
}

/**
 * Automatically creates and validates schema tables using @libsql/client
 * Supports both local SQLite files and remote Turso cloud databases without native C++ better-sqlite3
 */
export async function ensureDatabaseSchema(config?: { url: string; authToken?: string }): Promise<void> {
  if (globalForPrisma.initializedTables) return;

  const targetConfig = config || getTursoConfig() || { url: getDatabaseUrl() };

  // For PostgreSQL databases in production, tables and migrations are managed directly by Prisma
  if (isPostgresDatabase(targetConfig.url)) {
    globalForPrisma.initializedTables = true;
    return;
  }

  // For local file paths, ensure parent directory exists
  if (targetConfig.url.startsWith("file:")) {
    try {
      const rawPath = targetConfig.url.replace(/^file:\/\//, "").replace(/^file:/, "");
      const dir = path.dirname(path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {}
  }

  try {
    const client = createClient(targetConfig);

    // Safe column migrations for existing SQLite tables
    const migrations = [
      "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';",
      "ALTER TABLE discovery_watches ADD COLUMN lockedAt DATETIME;",
      "ALTER TABLE discovery_watches ADD COLUMN lockOwner TEXT;",
      "ALTER TABLE discovery_watches ADD COLUMN companies TEXT NOT NULL DEFAULT '[]';",
      "ALTER TABLE discovery_runs ADD COLUMN triggerType TEXT NOT NULL DEFAULT 'MANUAL';",
    ];
    for (const m of migrations) {
      try {
        await client.execute(m);
      } catch {
        // Column already exists - safe to ignore
      }
    }

    await client.executeMultiple(SCHEMA_DDL);
    client.close();
    globalForPrisma.initializedTables = true;
  } catch (err) {
    console.error("[Prisma/libSQL] Failed ensuring database schema tables:", err);
  }
}

/**
 * Backward compatibility alias for ensureDatabaseSchema
 */
export function ensureSqliteSchemaTables(dbUrl?: string): void {
  ensureDatabaseSchema(dbUrl ? { url: dbUrl } : undefined).catch((err) => {
    console.warn("[Prisma] ensureSqliteSchemaTables warning:", err);
  });
}

/**
 * Initialize Prisma Client with PostgreSQL production support and @prisma/adapter-libsql fallback
 * Connects natively to PostgreSQL (AWS RDS / Aurora) or seamlessly to Turso Cloud / local SQLite
 */
export function createPrismaClient(): PrismaClient {
  const dbUrl = getDatabaseUrl();

  // 1. Native PostgreSQL production connection
  if (isPostgresDatabase(dbUrl)) {
    return new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    });
  }

  // 2. Turso Cloud / Local SQLite connection
  const turso = getTursoConfig();
  const dbConfig = turso
    ? { url: turso.url, authToken: turso.authToken }
    : { url: dbUrl };

  // Trigger schema initialization asynchronously for SQLite/libSQL
  ensureDatabaseSchema(dbConfig).catch((err) => {
    console.warn("[Prisma] Schema bootstrap warning:", err);
  });

  const adapter = new PrismaLibSql(dbConfig);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
