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
    description: "Prisma connection URL (SQLite, LibSQL, or PostgreSQL)",
    isSecret: true,
  },
  {
    name: "TURSO_DATABASE_URL",
    category: "DATABASE",
    requiredInProduction: false,
    description: "Turso / LibSQL primary cloud endpoint URL",
    isSecret: false,
  },
  {
    name: "TURSO_AUTH_TOKEN",
    category: "DATABASE",
    requiredInProduction: false,
    description: "Turso / LibSQL cloud authentication token",
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
    requiredInProduction: false,
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
