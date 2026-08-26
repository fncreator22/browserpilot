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

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_jobs_createdAt ON jobs (createdAt);
CREATE INDEX IF NOT EXISTS idx_job_steps_jobId_stepNumber ON job_steps (jobId, stepNumber);
CREATE INDEX IF NOT EXISTS idx_observations_jobId_stepIndex ON observations (jobId, stepIndex);
CREATE INDEX IF NOT EXISTS idx_artifacts_jobId ON artifacts (jobId);
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
 * Automatically creates and validates schema tables using @libsql/client
 * Supports both local SQLite files and remote Turso cloud databases without native C++ better-sqlite3
 */
export async function ensureDatabaseSchema(config?: { url: string; authToken?: string }): Promise<void> {
  if (globalForPrisma.initializedTables) return;

  const targetConfig = config || getTursoConfig() || { url: getDatabaseUrl() };

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
 * Initialize Prisma Client with unified @prisma/adapter-libsql adapter
 * Connects seamlessly to both Turso Cloud (libsql://) and local SQLite (file:./dev.db)
 */
export function createPrismaClient(): PrismaClient {
  const turso = getTursoConfig();
  const dbConfig = turso
    ? { url: turso.url, authToken: turso.authToken }
    : { url: getDatabaseUrl() };

  // Trigger schema initialization asynchronously
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
