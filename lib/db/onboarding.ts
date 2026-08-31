/**
 * §ACCOUNT ONBOARDING & PERSONALIZATION DATA ACCESS LAYER (TASK-031)
 * 
 * Provides server-authoritative persistence for:
 * 1. User onboarding completion & versioning
 * 2. Acquisition source tracking
 * 3. User segmentation & category classifications
 * 4. Usage intent & career/experience context
 * 5. Organization context where applicable
 * 6. Administrative onboarding & segmentation telemetry
 */

import { prisma } from "./prisma";

export const CURRENT_ONBOARDING_VERSION = 1;

export const ACQUISITION_SOURCES = [
  "SEARCH_ENGINE",
  "SOCIAL_MEDIA",
  "FRIEND_COLLEAGUE",
  "COMMUNITY",
  "UNIVERSITY",
  "GITHUB",
  "PRODUCT_RECOMMENDATION",
  "OTHER",
] as const;

export type AcquisitionSource = typeof ACQUISITION_SOURCES[number];

export const USER_CATEGORIES = [
  "STUDENT",
  "PROFESSIONAL",
  "JOB_SEEKER",
  "RECRUITER",
  "FOUNDER",
  "ENTREPRENEUR",
  "COMPANY_ORG",
  "RESEARCHER",
  "EDUCATOR",
  "OTHER",
] as const;

export type UserCategory = typeof USER_CATEGORIES[number];

export const USAGE_CONTEXTS = [
  "INTERNSHIPS",
  "FULL_TIME_JOBS",
  "CONTRACT_OPPORTUNITIES",
  "MONITORING_COMPANIES",
  "EXPLORING_OPPORTUNITIES",
  "RECRUITING",
  "RESEARCH_MARKET",
  "OTHER",
] as const;

export type UsageContext = typeof USAGE_CONTEXTS[number];

export const ORGANIZATION_SIZES = [
  "SOLO",
  "SIZE_2_10",
  "SIZE_11_50",
  "SIZE_51_200",
  "SIZE_201_500",
  "SIZE_501_1000",
  "SIZE_1000_PLUS",
] as const;

export type OrganizationSize = typeof ORGANIZATION_SIZES[number];

export const EXPERIENCE_LEVELS = [
  "INTERN",
  "ENTRY_LEVEL",
  "MID_LEVEL",
  "SENIOR",
  "EXECUTIVE",
] as const;

export type ExperienceLevel = typeof EXPERIENCE_LEVELS[number];

export interface UserProfileRecord {
  id: string;
  userId: string;
  onboardingCompleted: boolean;
  onboardingVersion: number;
  acquisitionSource: string | null;
  userCategory: string | null;
  usageContext: string | null;
  experienceLevel: string | null;
  preferredRoles: string[];
  preferredLocations: string[];
  preferredWorkModes: string[];
  targetSkills: string[];
  organizationName: string | null;
  organizationSize: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingSubmissionInput {
  acquisitionSource?: string;
  userCategory?: string;
  usageContext?: string;
  experienceLevel?: string;
  preferredRoles?: string[];
  preferredLocations?: string[];
  preferredWorkModes?: string[];
  targetSkills?: string[];
  organizationName?: string;
  organizationSize?: string;
  onboardingCompleted?: boolean;
}

function parseJsonArray(val: string | null | undefined): string[] {
  if (!val) return [];
  try {
    const parsed = JSON.parse(val);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Retrieves the UserProfile record for a given userId.
 * Returns null if the user has not started/completed onboarding yet.
 */
export async function getUserProfile(userId: string): Promise<UserProfileRecord | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    userId: profile.userId,
    onboardingCompleted: profile.onboardingCompleted,
    onboardingVersion: profile.onboardingVersion,
    acquisitionSource: profile.acquisitionSource,
    userCategory: profile.userCategory,
    usageContext: profile.usageContext,
    experienceLevel: profile.experienceLevel,
    preferredRoles: parseJsonArray(profile.preferredRoles),
    preferredLocations: parseJsonArray(profile.preferredLocations),
    preferredWorkModes: parseJsonArray(profile.preferredWorkModes),
    targetSkills: parseJsonArray(profile.targetSkills),
    organizationName: profile.organizationName,
    organizationSize: profile.organizationSize,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

/**
 * Creates or updates the UserProfile record server-authoritatively.
 */
export async function upsertUserProfile(
  userId: string,
  input: OnboardingSubmissionInput
): Promise<UserProfileRecord> {
  const updateData: Record<string, any> = {
    onboardingVersion: CURRENT_ONBOARDING_VERSION,
  };

  if (input.onboardingCompleted !== undefined) {
    updateData.onboardingCompleted = input.onboardingCompleted;
  } else {
    updateData.onboardingCompleted = true;
  }

  if (input.acquisitionSource !== undefined) {
    updateData.acquisitionSource = input.acquisitionSource ? input.acquisitionSource.trim() : null;
  }
  if (input.userCategory !== undefined) {
    updateData.userCategory = input.userCategory ? input.userCategory.trim() : null;
  }
  if (input.usageContext !== undefined) {
    updateData.usageContext = input.usageContext ? input.usageContext.trim() : null;
  }
  if (input.experienceLevel !== undefined) {
    updateData.experienceLevel = input.experienceLevel ? input.experienceLevel.trim() : null;
  }
  if (input.preferredRoles !== undefined) {
    updateData.preferredRoles = JSON.stringify(input.preferredRoles || []);
  }
  if (input.preferredLocations !== undefined) {
    updateData.preferredLocations = JSON.stringify(input.preferredLocations || []);
  }
  if (input.preferredWorkModes !== undefined) {
    updateData.preferredWorkModes = JSON.stringify(input.preferredWorkModes || []);
  }
  if (input.targetSkills !== undefined) {
    updateData.targetSkills = JSON.stringify(input.targetSkills || []);
  }
  if (input.organizationName !== undefined) {
    updateData.organizationName = input.organizationName ? input.organizationName.trim() : null;
  }
  if (input.organizationSize !== undefined) {
    updateData.organizationSize = input.organizationSize ? input.organizationSize.trim() : null;
  }

  const profile = await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      onboardingCompleted: updateData.onboardingCompleted ?? true,
      onboardingVersion: CURRENT_ONBOARDING_VERSION,
      acquisitionSource: updateData.acquisitionSource || null,
      userCategory: updateData.userCategory || null,
      usageContext: updateData.usageContext || null,
      experienceLevel: updateData.experienceLevel || null,
      preferredRoles: updateData.preferredRoles || "[]",
      preferredLocations: updateData.preferredLocations || "[]",
      preferredWorkModes: updateData.preferredWorkModes || "[]",
      targetSkills: updateData.targetSkills || "[]",
      organizationName: updateData.organizationName || null,
      organizationSize: updateData.organizationSize || null,
    },
    update: updateData,
  });

  return {
    id: profile.id,
    userId: profile.userId,
    onboardingCompleted: profile.onboardingCompleted,
    onboardingVersion: profile.onboardingVersion,
    acquisitionSource: profile.acquisitionSource,
    userCategory: profile.userCategory,
    usageContext: profile.usageContext,
    experienceLevel: profile.experienceLevel,
    preferredRoles: parseJsonArray(profile.preferredRoles),
    preferredLocations: parseJsonArray(profile.preferredLocations),
    preferredWorkModes: parseJsonArray(profile.preferredWorkModes),
    targetSkills: parseJsonArray(profile.targetSkills),
    organizationName: profile.organizationName,
    organizationSize: profile.organizationSize,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

export interface OnboardingTelemetry {
  totalProfiles: number;
  completedCount: number;
  completionRatePercentage: number;
  currentVersion: number;
  userCategoryDistribution: Record<string, number>;
  acquisitionSourceDistribution: Record<string, number>;
  usageContextDistribution: Record<string, number>;
  organizationSizeDistribution: Record<string, number>;
}

/**
 * Aggregates safe onboarding and segmentation telemetry for admin control plane
 */
export async function getOnboardingTelemetry(): Promise<OnboardingTelemetry> {
  const [totalUsers, allProfiles] = await Promise.all([
    prisma.user.count(),
    prisma.userProfile.findMany({
      select: {
        onboardingCompleted: true,
        onboardingVersion: true,
        userCategory: true,
        acquisitionSource: true,
        usageContext: true,
        organizationSize: true,
      },
    }),
  ]);

  const totalProfiles = allProfiles.length;
  const completedCount = allProfiles.filter((p) => p.onboardingCompleted).length;
  const completionRatePercentage = totalUsers > 0 ? Math.round((completedCount / totalUsers) * 1000) / 10 : 0;

  const userCategoryDistribution: Record<string, number> = {};
  const acquisitionSourceDistribution: Record<string, number> = {};
  const usageContextDistribution: Record<string, number> = {};
  const organizationSizeDistribution: Record<string, number> = {};

  for (const p of allProfiles) {
    if (p.userCategory) {
      userCategoryDistribution[p.userCategory] = (userCategoryDistribution[p.userCategory] || 0) + 1;
    }
    if (p.acquisitionSource) {
      acquisitionSourceDistribution[p.acquisitionSource] = (acquisitionSourceDistribution[p.acquisitionSource] || 0) + 1;
    }
    if (p.usageContext) {
      usageContextDistribution[p.usageContext] = (usageContextDistribution[p.usageContext] || 0) + 1;
    }
    if (p.organizationSize) {
      organizationSizeDistribution[p.organizationSize] = (organizationSizeDistribution[p.organizationSize] || 0) + 1;
    }
  }

  return {
    totalProfiles,
    completedCount,
    completionRatePercentage,
    currentVersion: CURRENT_ONBOARDING_VERSION,
    userCategoryDistribution,
    acquisitionSourceDistribution,
    usageContextDistribution,
    organizationSizeDistribution,
  };
}
