/**
 * §CANONICAL ENVIRONMENT VARIABLE CONTRACT (TASK-035)
 * 
 * Provides typed, categorized environment variable definitions,
 * boundary validation, and safe non-sensitive configuration audits.
 */

export interface EnvVariableSpec {
  name: string;
  category:
    | "PUBLIC_BROWSER"
    | "SERVER_SECRET"
    | "DATABASE"
    | "INFRASTRUCTURE"
    | "AI_PROVIDER"
    | "PAYMENT"
    | "SCHEDULER"
    | "SECURITY";
  requiredInProduction: boolean;
  description: string;
  isSecret: boolean;
}

export const ENV_SPECS: EnvVariableSpec[] = [
  // Public Browser
  {
    name: "NEXT_PUBLIC_APP_URL",
    category: "PUBLIC_BROWSER",
    requiredInProduction: false,
    description: "Public canonical origin URL for web application",
    isSecret: false,
  },
  {
    name: "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    category: "PUBLIC_BROWSER",
    requiredInProduction: false,
    description: "Razorpay Public Key ID for browser checkout modal",
    isSecret: false,
  },

  // Server Secrets
  {
    name: "NEXTAUTH_SECRET",
    category: "SERVER_SECRET",
    requiredInProduction: true,
    description: "JWT signing secret for NextAuth sessions",
    isSecret: true,
  },
  {
    name: "ADMIN_SECRET_KEY",
    category: "SERVER_SECRET",
    requiredInProduction: true,
    description: "Bearer secret key for headless admin control plane access",
    isSecret: true,
  },
  {
    name: "SCHEDULER_CRON_SECRET",
    category: "SERVER_SECRET",
    requiredInProduction: true,
    description: "Bearer secret key for triggering scheduled discovery cron runs",
    isSecret: true,
  },

  // Database
  {
    name: "DATABASE_URL",
    category: "DATABASE",
    requiredInProduction: true,
    description: "Prisma connection URL (PostgreSQL - Supabase or AWS Aurora)",
    isSecret: true,
  },

  // Infrastructure
  {
    name: "NODE_ENV",
    category: "INFRASTRUCTURE",
    requiredInProduction: true,
    description: "Runtime environment mode (development, test, production)",
    isSecret: false,
  },
  {
    name: "REDIS_URL",
    category: "INFRASTRUCTURE",
    requiredInProduction: true,
    description: "Redis connection URI for BullMQ queues and SSE event streams",
    isSecret: true,
  },
  {
    name: "PORT",
    category: "INFRASTRUCTURE",
    requiredInProduction: false,
    description: "HTTP server binding port (defaults to 3000)",
    isSecret: false,
  },
  {
    name: "AWS_REGION",
    category: "INFRASTRUCTURE",
    requiredInProduction: false,
    description: "Target AWS region for ECS / S3 / Secrets Manager",
    isSecret: false,
  },

  // Payment
  {
    name: "RAZORPAY_KEY_SECRET",
    category: "PAYMENT",
    requiredInProduction: false,
    description: "Razorpay private API secret for order verification and webhooks",
    isSecret: true,
  },
  {
    name: "RAZORPAY_WEBHOOK_SECRET",
    category: "PAYMENT",
    requiredInProduction: false,
    description: "HMAC secret for verifying Razorpay webhook signatures",
    isSecret: true,
  },

  // AI Provider
  {
    name: "GEMINI_API_KEY",
    category: "AI_PROVIDER",
    requiredInProduction: true,
    description: "Server-managed Google Gemini API key fallback",
    isSecret: true,
  },
];

export interface EnvironmentAuditSummary {
  environment: string;
  totalVariablesDefined: number;
  configuredCount: number;
  missingRequiredCount: number;
  variables: Array<{
    name: string;
    category: string;
    isConfigured: boolean;
    isRequired: boolean;
    isSecret: boolean;
  }>;
}

/**
 * Generates a safe, non-sensitive audit summary of environment configuration.
 * Never leaks raw secret strings or tokens.
 */
export function getEnvironmentAuditSummary(): EnvironmentAuditSummary {
  const env = process.env.NODE_ENV || "development";
  const isProd = env === "production";

  const variableSummaries = ENV_SPECS.map((spec) => {
    const rawVal = process.env[spec.name];
    const isConfigured = !!(rawVal && rawVal.trim().length > 0);
    return {
      name: spec.name,
      category: spec.category,
      isConfigured,
      isRequired: isProd ? spec.requiredInProduction : false,
      isSecret: spec.isSecret,
    };
  });

  const missingRequired = variableSummaries.filter((v) => v.isRequired && !v.isConfigured).length;

  return {
    environment: env,
    totalVariablesDefined: ENV_SPECS.length,
    configuredCount: variableSummaries.filter((v) => v.isConfigured).length,
    missingRequiredCount: missingRequired,
    variables: variableSummaries,
  };
}

export interface EnvDiagnostic {
  variable: string;
  status: "OK" | "ERROR" | "WARNING";
  message: string;
  remedy?: string;
}

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  diagnostics: EnvDiagnostic[];
}

/**
 * Validates critical production environment variables (DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, GEMINI_API_KEY)
 * with strict contract checking and actionable error diagnostics.
 */
export function validateProductionEnv(options?: {
  allowTestHarness?: boolean;
  customEnv?: Record<string, string | undefined>;
}): EnvValidationResult {
  const env = options?.customEnv || process.env;
  const isTest = options?.allowTestHarness === true || 
    (options?.allowTestHarness !== false && (env.NODE_ENV === "test" || env.IS_TEST_HARNESS === "true"));

  const errors: string[] = [];
  const warnings: string[] = [];
  const diagnostics: EnvDiagnostic[] = [];

  // 1. DATABASE_URL validation
  const dbUrl = env.DATABASE_URL?.trim();
  if (!dbUrl) {
    const msg = "DATABASE_URL is missing. PostgreSQL connection string is required.";
    errors.push(msg);
    diagnostics.push({
      variable: "DATABASE_URL",
      status: "ERROR",
      message: msg,
      remedy: "Set DATABASE_URL=postgresql://user:password@host:5432/dbname",
    });
  } else if (!dbUrl.startsWith("postgresql://") && !dbUrl.startsWith("postgres://")) {
    const msg = `DATABASE_URL scheme is invalid (${dbUrl.substring(0, 10)}...). Must start with postgresql:// or postgres://.`;
    errors.push(msg);
    diagnostics.push({
      variable: "DATABASE_URL",
      status: "ERROR",
      message: msg,
      remedy: "Update DATABASE_URL to use postgresql:// or postgres:// scheme.",
    });
  } else if (dbUrl.includes("placeholder") || dbUrl.includes("your-password")) {
    const msg = "DATABASE_URL appears to contain placeholder credentials.";
    warnings.push(msg);
    diagnostics.push({
      variable: "DATABASE_URL",
      status: "WARNING",
      message: msg,
      remedy: "Replace placeholder credentials with production database credentials.",
    });
  } else {
    diagnostics.push({
      variable: "DATABASE_URL",
      status: "OK",
      message: "Valid PostgreSQL connection URI configured.",
    });
  }

  // 2. REDIS_URL validation
  const redisUrl = env.REDIS_URL?.trim();
  if (!redisUrl) {
    if (isTest) {
      warnings.push("REDIS_URL is not set; running in local fallback queue mode.");
      diagnostics.push({
        variable: "REDIS_URL",
        status: "WARNING",
        message: "REDIS_URL not configured. Defaulting to local fallback in test mode.",
        remedy: "Configure REDIS_URL=redis://host:6379 for distributed queues in production.",
      });
    } else {
      const msg = "REDIS_URL is missing. BullMQ workers and distributed event streaming require Redis.";
      errors.push(msg);
      diagnostics.push({
        variable: "REDIS_URL",
        status: "ERROR",
        message: msg,
        remedy: "Set REDIS_URL to a valid Redis URI, e.g. redis://127.0.0.1:6379 or rediss://...",
      });
    }
  } else if (!redisUrl.startsWith("redis://") && !redisUrl.startsWith("rediss://")) {
    const msg = `REDIS_URL scheme is invalid (${redisUrl.substring(0, 10)}...). Must start with redis:// or rediss://.`;
    errors.push(msg);
    diagnostics.push({
      variable: "REDIS_URL",
      status: "ERROR",
      message: msg,
      remedy: "Update REDIS_URL to use redis:// or rediss:// scheme.",
    });
  } else {
    diagnostics.push({
      variable: "REDIS_URL",
      status: "OK",
      message: "Valid Redis connection URI configured.",
    });
  }

  // 3. NEXTAUTH_SECRET validation
  const authSecret = env.NEXTAUTH_SECRET?.trim();
  if (!authSecret) {
    const msg = "NEXTAUTH_SECRET is missing. Required for session encryption.";
    errors.push(msg);
    diagnostics.push({
      variable: "NEXTAUTH_SECRET",
      status: "ERROR",
      message: msg,
      remedy: "Generate a 32+ character secret using `openssl rand -base64 32`.",
    });
  } else if (authSecret.length < 16) {
    const msg = `NEXTAUTH_SECRET is too short (${authSecret.length} chars). Minimum required in production is 16 chars (recommended 32+).`;
    if (isTest) {
      warnings.push(msg);
      diagnostics.push({
        variable: "NEXTAUTH_SECRET",
        status: "WARNING",
        message: msg,
        remedy: "Generate a secure secret: `openssl rand -base64 32`.",
      });
    } else {
      errors.push(msg);
      diagnostics.push({
        variable: "NEXTAUTH_SECRET",
        status: "ERROR",
        message: msg,
        remedy: "Generate a secure secret: `openssl rand -base64 32`.",
      });
    }
  } else if (["secret", "changeme", "your-secret", "placeholder"].includes(authSecret.toLowerCase())) {
    const msg = "NEXTAUTH_SECRET is set to an insecure default/placeholder.";
    errors.push(msg);
    diagnostics.push({
      variable: "NEXTAUTH_SECRET",
      status: "ERROR",
      message: msg,
      remedy: "Replace placeholder with a cryptographically random string.",
    });
  } else {
    diagnostics.push({
      variable: "NEXTAUTH_SECRET",
      status: "OK",
      message: "Secure session signing secret configured.",
    });
  }

  // 4. GEMINI_API_KEY validation
  const geminiKey = env.GEMINI_API_KEY?.trim() || env.GOOGLE_API_KEY?.trim();
  if (!geminiKey) {
    if (isTest) {
      warnings.push("GEMINI_API_KEY is missing (permitted in test harness mode).");
      diagnostics.push({
        variable: "GEMINI_API_KEY",
        status: "WARNING",
        message: "Gemini API key missing, but execution is in test mode.",
        remedy: "Provide GEMINI_API_KEY in production for autonomous planning.",
      });
    } else {
      const msg = "GEMINI_API_KEY is missing. Required for autonomous planning and synthesis.";
      errors.push(msg);
      diagnostics.push({
        variable: "GEMINI_API_KEY",
        status: "ERROR",
        message: msg,
        remedy: "Obtain an API key from Google AI Studio and configure GEMINI_API_KEY in .env.",
      });
    }
  } else if (geminiKey.length < 10 || geminiKey.includes("placeholder") || geminiKey === "test-key") {
    const msg = "GEMINI_API_KEY appears to be a placeholder or malformed key.";
    warnings.push(msg);
    diagnostics.push({
      variable: "GEMINI_API_KEY",
      status: "WARNING",
      message: msg,
      remedy: "Verify your API key in Google AI Studio.",
    });
  } else {
    diagnostics.push({
      variable: "GEMINI_API_KEY",
      status: "OK",
      message: "Valid Gemini API Key configured.",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    diagnostics,
  };
}

/**
 * Enforces startup environment contract and outputs formatted console diagnostics if invalid.
 */
export function enforceStartupEnvContract(options?: {
  allowTestHarness?: boolean;
}): EnvValidationResult {
  const result = validateProductionEnv(options);

  if (!result.valid) {
    console.error("\n=================================================");
    console.error("  FATAL CONFIGURATION ERROR: ENVIRONMENT CONTRACT");
    console.error("=================================================");
    result.diagnostics
      .filter((d) => d.status === "ERROR")
      .forEach((d) => {
        console.error(`[ERROR] [${d.variable}]: ${d.message}`);
        if (d.remedy) {
          console.error(`   Remedy: ${d.remedy}`);
        }
      });
    console.error("=================================================\n");

    if (process.env.NODE_ENV === "production") {
      throw new Error(`Environment validation failed with ${result.errors.length} error(s). Server startup aborted.`);
    }
  }

  return result;
}

