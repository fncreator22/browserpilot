import { createClient } from "@libsql/client";

const TURSO_URL = "libsql://browserpilot-fncreator.aws-ap-south-1.turso.io";
const TURSO_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc2NjQwNDQsImlkIjoiMDFhMDM5MTQtNWQwMS03YjdkLWJjMzQtN2RlNDJjODU0ODMxIiwia2lkIjoidVVkZDFYendxSV9KRlhCalNxZ3pXanZBNHllOW0xcnJiYlZDMm5USTBLayIsInJpZCI6ImVhZDFjOTVhLTFlYzMtNGUzYi1iNTA2LWI1OWIzOTU5Nzc5YyJ9.U68jIT3rOZew41uIbcDm0MoRVPllLBZ5ULRwMh74cOhC-CC1b83YghZYIqLfJMKM09jE3h4irJtnHKFMKPHNBQ";

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

async function initTurso() {
  console.log("Connecting to Turso cloud database...");
  const ping = await client.execute("SELECT 1 as connected");
  console.log("✓ Turso Connected:", ping.rows);

  console.log("Creating/verifying schema tables in Turso...");

  await client.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      geminiApiKey TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
    `CREATE TABLE IF NOT EXISTS jobs (
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
      maxDurationMs INTEGER,
      startedAt DATETIME,
      completedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
    );`,
    `CREATE TABLE IF NOT EXISTS job_steps (
      id TEXT PRIMARY KEY,
      jobId TEXT NOT NULL,
      stepNumber INTEGER NOT NULL,
      tool TEXT NOT NULL,
      actionPayload TEXT NOT NULL,
      rationale TEXT,
      status TEXT NOT NULL DEFAULT 'PLANNED',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS observations (
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
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );`,
    `CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      jobId TEXT NOT NULL,
      filename TEXT NOT NULL,
      storageKey TEXT NOT NULL,
      mimeType TEXT NOT NULL,
      sizeBytes INTEGER NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jobId) REFERENCES jobs(id) ON DELETE CASCADE
    );`,
  ], "write");

  console.log("✓ All schema tables successfully created and synchronized in Turso cloud database!");
}

initTurso().catch((err) => {
  console.error("Turso init error:", err);
  process.exit(1);
});
