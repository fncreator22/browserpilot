/**
 * §AI PROVIDER CONNECTIONS & USAGE GOVERNANCE FOUNDATION (TASK-032)
 * 
 * Provides:
 * - Server-authoritative ProviderConnection management (Puter, BYOK Gemini, BYOK OpenAI/Anthropic, Server Managed)
 * - Deterministic connection state machine (CONNECTED, DISCONNECTED, VERIFICATION_FAILED, EXPIRED, REVOKED)
 * - Safe credential masking (raw secrets are never exposed in return payloads)
 * - Decoupled entitlement boundary (canUseFeature) for future premium/tier logic
 * - Minimal, privacy-safe AI usage tracking without storing raw prompts
 * - Aggregate telemetry for administrative control plane
 */

import { prisma } from "@/lib/db/prisma";

export const SUPPORTED_PROVIDERS = [
  "PUTER",
  "GEMINI_BYOK",
  "OPENAI_BYOK",
  "ANTHROPIC_BYOK",
  "SERVER_MANAGED",
] as const;

export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export const PROVIDER_STATUSES = [
  "CONNECTED",
  "DISCONNECTED",
  "VERIFICATION_FAILED",
  "EXPIRED",
  "REVOKED",
] as const;

export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const AI_OPERATIONS = [
  "PROMPT_ENHANCEMENT",
  "ACTION_PLANNING",
  "STRUCTURED_EXTRACTION",
  "INTENT_PARSING",
  "DISCOVERY_RANKING",
] as const;

export type AIOperation = (typeof AI_OPERATIONS)[number];

export interface SafeProviderConnection {
  id: string;
  userId: string;
  provider: SupportedProvider;
  connectionMethod: string;
  status: ProviderStatus;
  providerUsername: string | null;
  maskedCredential: string | null;
  lastVerifiedAt: Date;
  lastVerificationStatus: string;
  usageAvailability: "AVAILABLE_VIA_PUTER" | "AVAILABLE_VIA_BYOK" | "SERVER_DEFAULT" | "UNAVAILABLE";
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AIUsageInput {
  userId: string;
  provider: string;
  model: string;
  operation: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  durationMs?: number;
  status?: "SUCCESS" | "FAILED" | "RATE_LIMITED" | "QUOTA_EXCEEDED";
  errorMessage?: string;
}

export interface UserUsageSummary {
  userId: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  totalTokensTracked: number;
  operationsByProvider: Record<string, number>;
  operationsByModel: Record<string, number>;
  recentEvents: Array<{
    id: string;
    provider: string;
    model: string;
    operation: string;
    totalTokens: number;
    durationMs: number;
    status: string;
    timestamp: Date;
  }>;
}

export interface ProviderTelemetryMetrics {
  totalConnections: number;
  activeConnectionsCount: number;
  providerDistribution: Record<string, number>;
  statusDistribution: Record<string, number>;
  totalAIUsageOperations: number;
  operationsByProvider: Record<string, number>;
}

/**
 * Masks sensitive API keys or credentials.
 * E.g. "AIzaSyTestApiKey1234" -> "AIzaSy••••••••1234"
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return "••••••••";
  const prefix = secret.slice(0, Math.min(6, Math.floor(secret.length / 3)));
  const suffix = secret.slice(-Math.min(4, Math.floor(secret.length / 4)));
  return `${prefix}••••••••${suffix}`;
}

/**
 * Returns safe provider connection records for a user.
 */
export async function getUserProviderConnections(userId: string): Promise<SafeProviderConnection[]> {
  const records = await prisma.providerConnection.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });

  return records.map((r) => {
    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(r.metadata || "{}");
    } catch {}

    let usageAvailability: SafeProviderConnection["usageAvailability"] = "UNAVAILABLE";
    if (r.status === "CONNECTED") {
      if (r.provider === "PUTER") usageAvailability = "AVAILABLE_VIA_PUTER";
      else if (r.provider.endsWith("_BYOK")) usageAvailability = "AVAILABLE_VIA_BYOK";
      else usageAvailability = "SERVER_DEFAULT";
    }

    return {
      id: r.id,
      userId: r.userId,
      provider: r.provider as SupportedProvider,
      connectionMethod: r.connectionMethod,
      status: r.status as ProviderStatus,
      providerUsername: r.providerUsername,
      maskedCredential: r.maskedCredential,
      lastVerifiedAt: r.lastVerifiedAt,
      lastVerificationStatus: r.lastVerificationStatus,
      usageAvailability,
      metadata: meta,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });
}

/**
 * Connects or updates a Puter account for a user.
 */
export async function upsertPuterConnection(
  userId: string,
  input: { username: string; metadata?: Record<string, unknown> }
): Promise<SafeProviderConnection> {
  const cleanUsername = input.username.trim();
  if (!cleanUsername) {
    throw new Error("INVALID_PUTER_USERNAME: Username is required.");
  }

  const record = await prisma.providerConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: "PUTER",
      },
    },
    create: {
      userId,
      provider: "PUTER",
      connectionMethod: "PUTER_OAUTH",
      status: "CONNECTED",
      providerUsername: cleanUsername,
      maskedCredential: null,
      lastVerifiedAt: new Date(),
      lastVerificationStatus: "VALID",
      metadata: JSON.stringify(input.metadata || {}),
    },
    update: {
      status: "CONNECTED",
      providerUsername: cleanUsername,
      lastVerifiedAt: new Date(),
      lastVerificationStatus: "VALID",
      metadata: JSON.stringify(input.metadata || {}),
      updatedAt: new Date(),
    },
  });

  return {
    id: record.id,
    userId: record.userId,
    provider: "PUTER",
    connectionMethod: record.connectionMethod,
    status: record.status as ProviderStatus,
    providerUsername: record.providerUsername,
    maskedCredential: null,
    lastVerifiedAt: record.lastVerifiedAt,
    lastVerificationStatus: record.lastVerificationStatus,
    usageAvailability: "AVAILABLE_VIA_PUTER",
    metadata: input.metadata || {},
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Connects or updates a BYOK API Key provider (Gemini, OpenAI, Anthropic).
 */
export async function upsertApiKeyConnection(
  userId: string,
  input: {
    provider: "GEMINI_BYOK" | "OPENAI_BYOK" | "ANTHROPIC_BYOK";
    apiKey: string;
  }
): Promise<SafeProviderConnection> {
  const cleanKey = input.apiKey.trim();
  if (!cleanKey || cleanKey.length < 8) {
    throw new Error("INVALID_API_KEY: Credential must be at least 8 characters long.");
  }

  const masked = maskSecret(cleanKey);

  // If Gemini, also synchronize with legacy user.geminiApiKey for backward compatibility
  if (input.provider === "GEMINI_BYOK") {
    await prisma.user.update({
      where: { id: userId },
      data: { geminiApiKey: cleanKey },
    });
  }

  const record = await prisma.providerConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: input.provider,
      },
    },
    create: {
      userId,
      provider: input.provider,
      connectionMethod: "API_KEY",
      status: "CONNECTED",
      providerUsername: null,
      maskedCredential: masked,
      encryptedCredential: cleanKey, // Future: KMS/AES envelope encryption
      lastVerifiedAt: new Date(),
      lastVerificationStatus: "VALID",
      metadata: JSON.stringify({ keyLength: cleanKey.length }),
    },
    update: {
      status: "CONNECTED",
      maskedCredential: masked,
      encryptedCredential: cleanKey,
      lastVerifiedAt: new Date(),
      lastVerificationStatus: "VALID",
      metadata: JSON.stringify({ keyLength: cleanKey.length }),
      updatedAt: new Date(),
    },
  });

  return {
    id: record.id,
    userId: record.userId,
    provider: input.provider,
    connectionMethod: record.connectionMethod,
    status: record.status as ProviderStatus,
    providerUsername: null,
    maskedCredential: masked,
    lastVerifiedAt: record.lastVerifiedAt,
    lastVerificationStatus: record.lastVerificationStatus,
    usageAvailability: "AVAILABLE_VIA_BYOK",
    metadata: { keyLength: cleanKey.length },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Disconnects a provider for a user deterministically.
 */
export async function disconnectProviderConnection(
  userId: string,
  provider: string
): Promise<{ success: boolean; provider: string; status: ProviderStatus }> {
  const existing = await prisma.providerConnection.findUnique({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
  });

  if (!existing) {
    return { success: true, provider, status: "DISCONNECTED" };
  }

  // If disconnecting Gemini BYOK, also clear legacy user.geminiApiKey
  if (provider === "GEMINI_BYOK") {
    await prisma.user.update({
      where: { id: userId },
      data: { geminiApiKey: null },
    });
  }

  await prisma.providerConnection.update({
    where: { id: existing.id },
    data: {
      status: "DISCONNECTED",
      maskedCredential: null,
      encryptedCredential: null,
      updatedAt: new Date(),
    },
  });

  return { success: true, provider, status: "DISCONNECTED" };
}

/**
 * Records an AI usage event without storing raw prompts or user inputs.
 */
export async function recordAIUsageEvent(input: AIUsageInput) {
  return prisma.aIUsageEvent.create({
    data: {
      userId: input.userId,
      provider: input.provider,
      model: input.model,
      operation: input.operation,
      inputTokens: input.inputTokens || 0,
      outputTokens: input.outputTokens || 0,
      totalTokens: input.totalTokens || (input.inputTokens || 0) + (input.outputTokens || 0),
      durationMs: input.durationMs || 0,
      status: input.status || "SUCCESS",
      errorMessage: input.errorMessage || null,
    },
  });
}

/**
 * Retrieves aggregated AI usage statistics and recent events for a user.
 */
export async function getUserUsageSummary(userId: string): Promise<UserUsageSummary> {
  const events = await prisma.aIUsageEvent.findMany({
    where: { userId },
    orderBy: { timestamp: "desc" },
    take: 50,
  });

  let totalOperations = 0;
  let successfulOperations = 0;
  let failedOperations = 0;
  let totalTokensTracked = 0;
  const operationsByProvider: Record<string, number> = {};
  const operationsByModel: Record<string, number> = {};

  for (const ev of events) {
    totalOperations++;
    if (ev.status === "SUCCESS") successfulOperations++;
    else failedOperations++;

    totalTokensTracked += ev.totalTokens;
    operationsByProvider[ev.provider] = (operationsByProvider[ev.provider] || 0) + 1;
    operationsByModel[ev.model] = (operationsByModel[ev.model] || 0) + 1;
  }

  return {
    userId,
    totalOperations,
    successfulOperations,
    failedOperations,
    totalTokensTracked,
    operationsByProvider,
    operationsByModel,
    recentEvents: events.map((e: {
      id: string;
      provider: string;
      model: string;
      operation: string;
      totalTokens: number;
      durationMs: number;
      status: string;
      timestamp: Date;
    }) => ({
      id: e.id,
      provider: e.provider,
      model: e.model,
      operation: e.operation,
      totalTokens: e.totalTokens,
      durationMs: e.durationMs,
      status: e.status,
      timestamp: e.timestamp,
    })),
  };
}

/**
 * Clean architectural entitlement boundary.
 * Checks if a user has access to a capability/feature without coupling to payment logic.
 */
export async function checkFeatureEntitlement(
  userId: string,
  capability: string
): Promise<{ allowed: boolean; reason?: string; effectiveProvider?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { providerConnections: true },
  });

  if (!user) {
    return { allowed: false, reason: "USER_NOT_FOUND" };
  }

  // Active Puter connection
  const puter = user.providerConnections.find(
    (p) => p.provider === "PUTER" && p.status === "CONNECTED"
  );
  if (puter) {
    return { allowed: true, effectiveProvider: "PUTER" };
  }

  // Active BYOK connection
  const byok = user.providerConnections.find(
    (p) => p.provider.endsWith("_BYOK") && p.status === "CONNECTED"
  );
  if (byok) {
    return { allowed: true, effectiveProvider: byok.provider };
  }

  // Legacy BYOK key or server environment fallback
  if (user.geminiApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    return { allowed: true, effectiveProvider: "SERVER_MANAGED" };
  }

  return {
    allowed: true, // Baseline allowance for standard discovery
    effectiveProvider: "SERVER_MANAGED",
  };
}

/**
 * Aggregates provider connection and AI usage telemetry for the Admin Control Plane.
 */
export async function getAdminProviderTelemetry(): Promise<ProviderTelemetryMetrics> {
  const connections = await prisma.providerConnection.findMany();
  const usageEvents = await prisma.aIUsageEvent.findMany({
    select: { provider: true, status: true },
  });

  const providerDistribution: Record<string, number> = {};
  const statusDistribution: Record<string, number> = {};
  let activeConnectionsCount = 0;

  for (const c of connections) {
    providerDistribution[c.provider] = (providerDistribution[c.provider] || 0) + 1;
    statusDistribution[c.status] = (statusDistribution[c.status] || 0) + 1;
    if (c.status === "CONNECTED") activeConnectionsCount++;
  }

  const operationsByProvider: Record<string, number> = {};
  for (const u of usageEvents) {
    operationsByProvider[u.provider] = (operationsByProvider[u.provider] || 0) + 1;
  }

  return {
    totalConnections: connections.length,
    activeConnectionsCount,
    providerDistribution,
    statusDistribution,
    totalAIUsageOperations: usageEvents.length,
    operationsByProvider,
  };
}
