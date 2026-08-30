-- =============================================================================
-- BROWSERPILOT PRODUCTION POSTGRESQL DDL & MIGRATION SCHEMA (TASK-021)
-- Multi-Tenant Autonomous Job Monitoring, Discovery, & Execution Pipeline
-- Compatible with AWS RDS PostgreSQL, Aurora Serverless v2, and Supabase/Neon
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(255),
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "geminiApiKey" TEXT,
  "role" VARCHAR(32) NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. General Agent Jobs & Observations
CREATE TABLE IF NOT EXISTS "jobs" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
  "prompt" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "allowedDomains" TEXT NOT NULL DEFAULT '[]',
  "maxStepsBudget" INTEGER NOT NULL DEFAULT 15,
  "goal" TEXT,
  "confidence DOUBLE PRECISION,
  "summary" TEXT,
  "error" TEXT,
  "result" TEXT,
  "totalDurationMs" INTEGER,
  "tokensUsed" INTEGER,
  "memoryMb" DOUBLE PRECISION,
  "maxDurationMs" INTEGER NOT NULL DEFAULT 120000,
  "startedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "job_steps" (
  "id" VARCHAR(64) PRIMARY KEY,
  "jobId" VARCHAR(64) NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "stepNumber" INTEGER NOT NULL,
  "tool" VARCHAR(64) NOT NULL,
  "actionPayload" TEXT NOT NULL,
  "rationale" TEXT,
  "status" VARCHAR(32) NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "observations" (
  "id" VARCHAR(64) PRIMARY KEY,
  "jobId" VARCHAR(64) NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "stepIndex" INTEGER NOT NULL,
  "tool" VARCHAR(64) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "currentUrl" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "pageSummary" TEXT,
  "extractedData" TEXT,
  "screenshotPath" TEXT,
  "error" TEXT,
  "elapsedMs" INTEGER NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "artifacts" (
  "id" VARCHAR(64) PRIMARY KEY,
  "jobId" VARCHAR(64) NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "filename" VARCHAR(255) NOT NULL,
  "storageKey" VARCHAR(512) NOT NULL,
  "mimeType" VARCHAR(64) NOT NULL DEFAULT 'image/png',
  "sizeBytes" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Search Sessions & History
CREATE TABLE IF NOT EXISTS "searches" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) REFERENCES "users"("id") ON DELETE SET NULL,
  "rawQuery" TEXT NOT NULL,
  "intentType" VARCHAR(64) NOT NULL DEFAULT 'JOB_SEARCH_GENERAL',
  "parsedRole" VARCHAR(255),
  "parsedSkills" TEXT NOT NULL DEFAULT '[]',
  "parsedLocation" VARCHAR(255),
  "parsedWorkMode" VARCHAR(32) NOT NULL DEFAULT 'ANY',
  "targetGradYear" INTEGER,
  "status" VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
  "totalFound" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. Canonical Opportunity Records & Source Listings
CREATE TABLE IF NOT EXISTS "opportunities" (
  "id" VARCHAR(64) PRIMARY KEY,
  "canonicalHash" VARCHAR(128) UNIQUE NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "companyName" VARCHAR(255) NOT NULL,
  "location" VARCHAR(255) NOT NULL,
  "workMode" VARCHAR(32) NOT NULL DEFAULT 'ANY',
  "experienceLevel" VARCHAR(32) NOT NULL DEFAULT 'ENTRY_LEVEL',
  "opportunityType" VARCHAR(32) NOT NULL DEFAULT 'FULL_TIME',
  "salaryMin" DOUBLE PRECISION,
  "salaryMax" DOUBLE PRECISION,
  "salaryCurrency" VARCHAR(16) NOT NULL DEFAULT 'USD',
  "description" TEXT NOT NULL DEFAULT '',
  "requirements" TEXT NOT NULL DEFAULT '[]',
  "skills" TEXT NOT NULL DEFAULT '[]',
  "primaryApplyUrl" TEXT NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  "firstSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastVerifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "source_listings" (
  "id" VARCHAR(64) PRIMARY KEY,
  "opportunityId" VARCHAR(64) NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "sourcePlatform" VARCHAR(64) NOT NULL,
  "externalJobId" VARCHAR(255),
  "sourceUrl" TEXT NOT NULL,
  "applyUrl" TEXT NOT NULL,
  "verificationStatus" VARCHAR(32) NOT NULL DEFAULT 'UNVERIFIED',
  "lastCheckedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rawSnippet" TEXT,
  "screenshotArtifactId" VARCHAR(64),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_source_listings_platform_url" UNIQUE ("sourcePlatform", "sourceUrl")
);

-- 5. Search Results & Bookmarks
CREATE TABLE IF NOT EXISTS "search_results" (
  "id" VARCHAR(64) PRIMARY KEY,
  "searchId" VARCHAR(64) NOT NULL REFERENCES "searches"("id") ON DELETE CASCADE,
  "opportunityId" VARCHAR(64) NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "matchScore" DOUBLE PRECISION NOT NULL,
  "rankPosition" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_search_results_search_opp" UNIQUE ("searchId", "opportunityId")
);

CREATE TABLE IF NOT EXISTS "saved_opportunities" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opportunityId" VARCHAR(64) NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "uq_saved_opportunities_user_opp" UNIQUE ("userId", "opportunityId")
);

-- 6. Autonomous Discovery Watches & Scheduler Lease Locks
CREATE TABLE IF NOT EXISTS "discovery_watches" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) UNIQUE NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "roles" TEXT NOT NULL DEFAULT '[]',
  "skills" TEXT NOT NULL DEFAULT '[]',
  "locations" TEXT NOT NULL DEFAULT '[]',
  "companies" TEXT NOT NULL DEFAULT '[]',
  "workModes" TEXT NOT NULL DEFAULT '[]',
  "experienceLevels" TEXT NOT NULL DEFAULT '[]',
  "opportunityTypes" TEXT NOT NULL DEFAULT '[]',
  "preferredSources" TEXT NOT NULL DEFAULT '[]',
  "minimumMatchScore" DOUBLE PRECISION NOT NULL DEFAULT 70,
  "latestOnly" BOOLEAN NOT NULL DEFAULT false,
  "freshnessWindowHours" INTEGER NOT NULL DEFAULT 48,
  "scanIntervalHours" INTEGER NOT NULL DEFAULT 6,
  "lastScannedAt" TIMESTAMPTZ,
  "nextScanAt" TIMESTAMPTZ,
  "lockedAt" TIMESTAMPTZ,
  "lockOwner" VARCHAR(255),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Autonomous Discovery Runs & Telemetry
CREATE TABLE IF NOT EXISTS "discovery_runs" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "triggerType" VARCHAR(32) NOT NULL DEFAULT 'MANUAL',
  "status" VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
  "durationMs" INTEGER NOT NULL DEFAULT 0,
  "providersAttempted" INTEGER NOT NULL DEFAULT 0,
  "providersSucceeded" INTEGER NOT NULL DEFAULT 0,
  "providersFailed" INTEGER NOT NULL DEFAULT 0,
  "candidatesFound" INTEGER NOT NULL DEFAULT 0,
  "validCandidates" INTEGER NOT NULL DEFAULT 0,
  "newOpportunities" INTEGER NOT NULL DEFAULT 0,
  "newSources" INTEGER NOT NULL DEFAULT 0,
  "alreadyKnown" INTEGER NOT NULL DEFAULT 0,
  "reposted" INTEGER NOT NULL DEFAULT 0,
  "notificationsCreated" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "opportunity_discovery_events" (
  "id" VARCHAR(64) PRIMARY KEY,
  "runId" VARCHAR(64) NOT NULL REFERENCES "discovery_runs"("id") ON DELETE CASCADE,
  "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opportunityId" VARCHAR(64) NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "classification" VARCHAR(32) NOT NULL,
  "matchScore" DOUBLE PRECISION NOT NULL,
  "freshnessClass" VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN',
  "notificationCreated" BOOLEAN NOT NULL DEFAULT false,
  "discoveredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Lifecycle Alerts & Notification Inbox (Single Source of Truth)
CREATE TABLE IF NOT EXISTS "lifecycle_alerts" (
  "id" VARCHAR(64) PRIMARY KEY,
  "userId" VARCHAR(64) NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opportunityId" VARCHAR(64) NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  "transitionType" VARCHAR(32) NOT NULL,
  "previousStatus" VARCHAR(32) NOT NULL,
  "newStatus" VARCHAR(32) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "companyName" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "idempotencyKey" VARCHAR(255) UNIQUE NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- PERFORMANCE & COMPOSITE INDEXES
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_jobs_status ON "jobs"("status");
CREATE INDEX IF NOT EXISTS idx_jobs_createdAt ON "jobs"("createdAt");
CREATE INDEX IF NOT EXISTS idx_job_steps_job_step ON "job_steps"("jobId", "stepNumber");
CREATE INDEX IF NOT EXISTS idx_observations_job_step ON "observations"("jobId", "stepIndex");
CREATE INDEX IF NOT EXISTS idx_artifacts_jobId ON "artifacts"("jobId");
CREATE INDEX IF NOT EXISTS idx_searches_userId ON "searches"("userId");
CREATE INDEX IF NOT EXISTS idx_searches_createdAt ON "searches"("createdAt");
CREATE INDEX IF NOT EXISTS idx_opportunities_workMode ON "opportunities"("workMode");
CREATE INDEX IF NOT EXISTS idx_opportunities_experienceLevel ON "opportunities"("experienceLevel");
CREATE INDEX IF NOT EXISTS idx_opportunities_lastVerifiedAt ON "opportunities"("lastVerifiedAt");
CREATE INDEX IF NOT EXISTS idx_source_listings_opportunityId ON "source_listings"("opportunityId");
CREATE INDEX IF NOT EXISTS idx_search_results_search_rank ON "search_results"("searchId", "rankPosition");
CREATE INDEX IF NOT EXISTS idx_saved_opportunities_userId ON "saved_opportunities"("userId");
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_user_read ON "lifecycle_alerts"("userId", "isRead");
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_user_created ON "lifecycle_alerts"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS idx_lifecycle_alerts_opportunityId ON "lifecycle_alerts"("opportunityId");
CREATE INDEX IF NOT EXISTS idx_discovery_watches_enabled_nextScanAt ON "discovery_watches"("enabled", "nextScanAt");
CREATE INDEX IF NOT EXISTS idx_discovery_runs_user_started ON "discovery_runs"("userId", "startedAt");
CREATE INDEX IF NOT EXISTS idx_discovery_runs_triggerType ON "discovery_runs"("triggerType");
CREATE INDEX IF NOT EXISTS idx_opportunity_discovery_events_user_discovered ON "opportunity_discovery_events"("userId", "discoveredAt");
CREATE INDEX IF NOT EXISTS idx_opportunity_discovery_events_opportunityId ON "opportunity_discovery_events"("opportunityId");
