import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { config } from "dotenv";

config();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initializedTables: boolean | undefined;
};

/**
 * Determine accurate database file path across local dev and Vercel serverless environments
 */
export function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL;
  if (envUrl && (envUrl.startsWith("postgres") || envUrl.startsWith("mysql") || envUrl.startsWith("prisma"))) {
    return envUrl;
  }

  // In Vercel serverless functions or AWS Lambda, the root directory is read-only.
  // /tmp is the only writable storage location.
  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NODE_ENV === "production") {
    // If not an external DB, use writable /tmp
    if (!envUrl || envUrl.startsWith("file:")) {
      return "file:/tmp/dev.db";
    }
  }

  return envUrl || "file:./dev.db";
}

/**
 * Automatically creates and validates SQLite schema tables on the fly
 */
export function ensureSqliteSchemaTables(dbUrl: string): void {
  if (globalForPrisma.initializedTables) return;

  if (dbUrl.startsWith("file:")) {
    try {
      const filePath = dbUrl.replace(/^file:/, "");
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const db = new Database(filePath);
      db.pragma("journal_mode = WAL");
      db.pragma("foreign_keys = ON");

      db.exec(`
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
      `);

      // Safe column migrations for existing SQLite databases
      try { db.exec(`ALTER TABLE users ADD COLUMN name TEXT;`); } catch {}
      try { db.exec(`ALTER TABLE users ADD COLUMN geminiApiKey TEXT;`); } catch {}
      try { db.exec(`ALTER TABLE users ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP;`); } catch {}

      db.close();
      globalForPrisma.initializedTables = true;
    } catch (err) {
      console.error("[Prisma] Failed ensuring SQLite tables:", err);
    }
  }
}

export function createPrismaClient(): PrismaClient {
  const url = getDatabaseUrl();
  ensureSqliteSchemaTables(url);

  const adapter = new PrismaBetterSqlite3({ url });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
