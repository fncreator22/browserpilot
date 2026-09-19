/**
 * §15-DAY FREE TRIAL CLOCK ENGINE
 * 
 * Manages automated 15-day trial countdowns based on user creation timestamps.
 * Provides:
 * 1. Automatic user-specific 15-day trial clock countdown.
 * 2. Upgrade gate evaluation when the 15-day window ends.
 * 3. Global admin controls to toggle trial enforcement, adjust trial duration, or grant extensions.
 * 4. Isolation between free trial users and paid Pro/Enterprise subscribers.
 */

import { prisma } from "@/lib/db/prisma";

export interface UserTrialStatus {
  userId: string;
  isPaid: boolean;
  isAdmin: boolean;
  isTrialActive: boolean;
  isTrialExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  trialStartDate: string;
  trialEndDate: string;
  trialLengthDays: number;
  upgradeRequired: boolean;
  statusText: string;
}

export interface AdminTrialConfig {
  enforceTrial: boolean;
  defaultTrialDays: number;
  userOverrides: Record<string, { extendedDays: number; exempt: boolean }>;
}

// In-memory persistent config store (survives hot reloads)
declare global {
  var __browserpilot_trial_config: AdminTrialConfig | undefined;
}

if (!globalThis.__browserpilot_trial_config) {
  globalThis.__browserpilot_trial_config = {
    enforceTrial: true,
    defaultTrialDays: 15,
    userOverrides: {},
  };
}

export function getAdminTrialConfig(): AdminTrialConfig {
  return globalThis.__browserpilot_trial_config!;
}

export function updateAdminTrialConfig(updates: Partial<AdminTrialConfig>): AdminTrialConfig {
  const current = getAdminTrialConfig();
  if (typeof updates.enforceTrial === "boolean") {
    current.enforceTrial = updates.enforceTrial;
  }
  if (typeof updates.defaultTrialDays === "number" && updates.defaultTrialDays > 0) {
    current.defaultTrialDays = updates.defaultTrialDays;
  }
  if (updates.userOverrides) {
    current.userOverrides = { ...current.userOverrides, ...updates.userOverrides };
  }
  return current;
}

export function extendUserTrial(userId: string, additionalDays: number): AdminTrialConfig {
  const current = getAdminTrialConfig();
  const existing = current.userOverrides[userId] || { extendedDays: 0, exempt: false };
  current.userOverrides[userId] = {
    ...existing,
    extendedDays: existing.extendedDays + additionalDays,
  };
  return current;
}

export function setUserTrialExempt(userId: string, exempt: boolean): AdminTrialConfig {
  const current = getAdminTrialConfig();
  const existing = current.userOverrides[userId] || { extendedDays: 0, exempt: false };
  current.userOverrides[userId] = {
    ...existing,
    exempt,
  };
  return current;
}

/**
 * Calculates server-authoritative 15-day trial status for a user.
 */
export async function getUserTrialStatus(userId: string): Promise<UserTrialStatus> {
  const config = getAdminTrialConfig();

  // Guest search handling
  if (!userId || userId.startsWith("guest_")) {
    return {
      userId: userId || "guest",
      isPaid: false,
      isAdmin: false,
      isTrialActive: true,
      isTrialExpired: false,
      daysRemaining: config.defaultTrialDays,
      hoursRemaining: config.defaultTrialDays * 24,
      trialStartDate: new Date().toISOString(),
      trialEndDate: new Date(Date.now() + config.defaultTrialDays * 86400000).toISOString(),
      trialLengthDays: config.defaultTrialDays,
      upgradeRequired: false,
      statusText: `Guest Preview · ${config.defaultTrialDays}d Trial`,
    };
  }

  let dbUser: any = null;
  try {
    dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        createdAt: true,
        role: true,
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIALING"] } },
          include: { plan: true },
          take: 1,
        },
      },
    });
  } catch (err) {
    console.warn("[TrialService] Error fetching user for trial check:", err);
  }

  const createdAt = dbUser?.createdAt ? new Date(dbUser.createdAt) : new Date();
  const isAdmin = dbUser?.role === "ADMIN" || dbUser?.role === "SUPERADMIN";

  // Check paid subscription
  const activeSub = dbUser?.subscriptions?.[0];
  const isPaid = Boolean(activeSub?.plan?.code && activeSub.plan.code !== "FREE");

  if (isPaid || isAdmin) {
    return {
      userId,
      isPaid,
      isAdmin,
      isTrialActive: false,
      isTrialExpired: false,
      daysRemaining: 999,
      hoursRemaining: 999 * 24,
      trialStartDate: createdAt.toISOString(),
      trialEndDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      trialLengthDays: config.defaultTrialDays,
      upgradeRequired: false,
      statusText: isAdmin ? "Admin Sovereign Access" : `${activeSub.plan.name || "Paid Pro"} Active`,
    };
  }

  // Check user specific overrides
  const userOverride = config.userOverrides[userId];
  if (userOverride?.exempt) {
    return {
      userId,
      isPaid: false,
      isAdmin: false,
      isTrialActive: true,
      isTrialExpired: false,
      daysRemaining: 999,
      hoursRemaining: 999 * 24,
      trialStartDate: createdAt.toISOString(),
      trialEndDate: new Date(Date.now() + 365 * 86400000).toISOString(),
      trialLengthDays: config.defaultTrialDays,
      upgradeRequired: false,
      statusText: "Trial Exemption Active",
    };
  }

  const extendedDays = userOverride?.extendedDays || 0;
  const effectiveTrialDays = config.defaultTrialDays + extendedDays;

  const trialStartMs = createdAt.getTime();
  const trialEndMs = trialStartMs + effectiveTrialDays * 86400000;
  const nowMs = Date.now();

  const isExpired = config.enforceTrial && nowMs >= trialEndMs;
  const msRemaining = Math.max(0, trialEndMs - nowMs);
  const daysRemaining = isExpired ? 0 : Math.max(1, Math.ceil(msRemaining / 86400000));
  const hoursRemaining = isExpired ? 0 : Math.max(1, Math.ceil(msRemaining / 3600000));
  const isTrialActive = !isExpired;

  let statusText = "";
  if (isExpired) {
    statusText = "15-Day Free Trial Ended · Upgrade Required";
  } else if (daysRemaining === 1) {
    statusText = `Free Trial · Ends in ${hoursRemaining} hours`;
  } else {
    statusText = `Free Trial · ${daysRemaining} days left`;
  }

  return {
    userId,
    isPaid: false,
    isAdmin: false,
    isTrialActive,
    isTrialExpired: isExpired,
    daysRemaining,
    hoursRemaining,
    trialStartDate: new Date(trialStartMs).toISOString(),
    trialEndDate: new Date(trialEndMs).toISOString(),
    trialLengthDays: effectiveTrialDays,
    upgradeRequired: isExpired,
    statusText,
  };
}
