/**
 * §UNIFIED CANONICAL DISCOVERY CONFIGURATION LAYER (TASK-037)
 * 
 * Central domain service connecting:
 * 1. UserProfile onboarding defaults
 * 2. Natural Language Intent Parsing
 * 3. Manual Refinement Overrides
 * 4. Mode-specific (One-Time / Swarm / Autonomous Watch) Execution
 * 
 * Strict Precedence Policy:
 * Current Query > Explicit Overrides > Profile Defaults > System Defaults
 */

import { buildDiscoveryPlan, type DiscoveryPlan, type UserProfilePreferences } from "./discoveryPlanner";
import { type SearchIntent } from "./providers/baseProvider";
import { getUserProfile } from "@/lib/db/onboarding";

export type DiscoveryExecutionMode = "ONE_TIME" | "SWARM" | "AUTONOMOUS_WATCH";

export interface UnifiedDiscoveryInput {
  userId?: string | null;
  rawQuery?: string | null;
  overrides?: Partial<SearchIntent>;
  executionMode?: DiscoveryExecutionMode;
}

export interface UnifiedDiscoveryConfigResult {
  plan: DiscoveryPlan;
  executionMode: DiscoveryExecutionMode;
  profileApplied: boolean;
  activeOverridesCount: number;
}

/**
 * Loads UserProfile record from the database and translates it into discovery preferences.
 */
export async function getUserProfileDiscoveryDefaults(userId?: string | null): Promise<UserProfilePreferences | undefined> {
  if (!userId) return undefined;

  try {
    const profile = await getUserProfile(userId);
    if (!profile) return undefined;

    return {
      skills: profile.targetSkills,
      experienceLevel: profile.experienceLevel || undefined,
      preferredOpportunityType: profile.userCategory === "STUDENT" ? "INTERNSHIP" : "FULL_TIME",
      preferredLocations: profile.preferredLocations,
      preferredWorkMode: profile.preferredWorkModes[0] || "ANY",
      targetRoles: profile.preferredRoles,
    };
  } catch {
    return undefined;
  }
}

/**
 * Resolves the canonical DiscoveryPlan with deterministic precedence.
 */
export async function resolveCanonicalDiscoveryConfig(
  input: UnifiedDiscoveryInput
): Promise<UnifiedDiscoveryConfigResult> {
  const { userId, rawQuery = "", overrides = {}, executionMode = "ONE_TIME" } = input;

  const profile = await getUserProfileDiscoveryDefaults(userId);
  const plan = buildDiscoveryPlan(rawQuery || "", overrides, profile);

  const activeOverridesCount = Object.keys(overrides).filter((k) => {
    const val = (overrides as Record<string, unknown>)[k];
    return val !== undefined && val !== null && val !== "";
  }).length;

  return {
    plan,
    executionMode,
    profileApplied: !!profile,
    activeOverridesCount,
  };
}
