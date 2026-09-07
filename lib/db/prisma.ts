import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { config } from "dotenv";

config({ path: ".env.local", override: true });
config({ path: ".env.development", override: true });
config();


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  initializedTables: boolean | undefined;
  loggedConnection: boolean | undefined;
};

export type DatabaseProvider = "Supabase" | "AWS Aurora" | "PostgreSQL";

export interface DatabaseTargetInfo {
  engine: "POSTGRESQL";
  provider: DatabaseProvider;
  host: string;
  database: string;
  isPooler: boolean;
}

/**
 * Validates and parses the active PostgreSQL connection URL.
 * Throws immediately if DATABASE_URL is missing or not a PostgreSQL connection string.
 * Never silently falls back to any alternative engine or file.
 */
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL?.trim();

  if (!dbUrl) {
    throw new Error(
      "[Database Config Error] DATABASE_URL is missing. A valid PostgreSQL connection string (postgresql:// or postgres://) is required."
    );
  }

  if (!dbUrl.startsWith("postgres://") && !dbUrl.startsWith("postgresql://")) {
    throw new Error(
      `[Database Config Error] Unsupported database URL scheme: "${dbUrl.substring(0, 15)}...". BrowserPilot requires PostgreSQL (Supabase or AWS Aurora).`
    );
  }

  return dbUrl;
}

/**
 * Inspects connection string to identify the hosting provider for startup logs and admin telemetry
 */
export function getDatabaseTarget(url?: string): DatabaseTargetInfo {
  const dbUrl = url || getDatabaseUrl();
  let host = "unknown";
  let database = "postgres";
  let isPooler = false;

  try {
    const parsed = new URL(dbUrl.replace(/^postgresql:\/\//, "http://").replace(/^postgres:\/\//, "http://"));
    host = parsed.hostname.toLowerCase();
    database = parsed.pathname.replace(/^\//, "") || "postgres";
    isPooler = host.includes("pooler") || parsed.port === "6543";
  } catch {
    const hostMatch = dbUrl.match(/@([^/:?]+)/);
    if (hostMatch) {
      host = hostMatch[1].toLowerCase();
    }
  }

  let provider: DatabaseProvider = "PostgreSQL";
  if (host.includes("supabase.co") || host.includes("supabase.com") || host.includes("pooler.supabase.com")) {
    provider = "Supabase";
    isPooler = host.includes("pooler") || isPooler;
  } else if (host.includes("rds.amazonaws.com")) {
    provider = "AWS Aurora";
    isPooler = host.includes("rdsrelay") || host.includes("proxy");
  }

  return {
    engine: "POSTGRESQL",
    provider,
    host,
    database,
    isPooler,
  };
}

/**
 * Type-guard verifying if a given URL is PostgreSQL
 */
export function isPostgresDatabase(url?: string): boolean {
  const dbUrl = url || process.env.DATABASE_URL || "";
  return dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
}

/**
 * Initialize Prisma Client exclusively with PostgreSQL (@prisma/adapter-pg)
 */
export function createPrismaClient(): PrismaClient {
  const dbUrl = getDatabaseUrl();
  const target = getDatabaseTarget(dbUrl);

  if (!globalForPrisma.loggedConnection) {
    console.log(
      `[Database] Active Engine: POSTGRESQL | Provider: ${target.provider} | Host: ${target.host} | DB: ${target.database}`
    );
    globalForPrisma.loggedConnection = true;
  }

  const adapter = new PrismaPg({ connectionString: dbUrl });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Backward compatibility stubs for existing integration test harnesses
 * Schema in PostgreSQL is managed via Prisma migrations.
 */
export async function ensureDatabaseSchema(_config?: unknown): Promise<void> {
  // Pure PostgreSQL: schema DDL is maintained via migrations / prisma db push
  globalForPrisma.initializedTables = true;
}

export function ensureSqliteSchemaTables(_dbUrl?: string): void {
  // Backward compatibility no-op
}

/**
 * Deprecated Turso config stub for legacy test runners
 */
export function getTursoConfig(): { url: string; authToken: string } | null {
  return null;
}

