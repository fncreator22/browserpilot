import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { 
  getUserProfile, 
  upsertUserProfile, 
  ACQUISITION_SOURCES, 
  USER_CATEGORIES, 
  USAGE_CONTEXTS, 
  ORGANIZATION_SIZES, 
  EXPERIENCE_LEVELS,
  CURRENT_ONBOARDING_VERSION 
} from "@/lib/db/onboarding";
import { z } from "zod";

export const dynamic = "force-dynamic";

const OnboardingSchema = z.object({
  acquisitionSource: z
    .enum(ACQUISITION_SOURCES)
    .or(z.string().max(50))
    .optional(),
  userCategory: z
    .enum(USER_CATEGORIES)
    .or(z.string().max(50))
    .optional(),
  usageContext: z
    .enum(USAGE_CONTEXTS)
    .or(z.string().max(50))
    .optional(),
  experienceLevel: z
    .enum(EXPERIENCE_LEVELS)
    .or(z.string().max(50))
    .optional(),
  preferredRoles: z
    .array(z.string().trim().max(60))
    .max(10)
    .optional(),
  preferredLocations: z
    .array(z.string().trim().max(60))
    .max(10)
    .optional(),
  preferredWorkModes: z
    .array(z.string().trim().max(20))
    .max(5)
    .optional(),
  targetSkills: z
    .array(z.string().trim().max(50))
    .max(20)
    .optional(),
  organizationName: z
    .string()
    .trim()
    .max(100)
    .optional(),
  organizationSize: z
    .enum(ORGANIZATION_SIZES)
    .or(z.string().max(50))
    .optional(),
  onboardingCompleted: z.boolean().optional(),
});

/**
 * GET /api/account/onboarding
 * Returns authenticated user onboarding status and profile data
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sign in required to view onboarding status." },
        { status: 401 }
      );
    }

    const profile = await getUserProfile(userId);

    return NextResponse.json({
      success: true,
      onboardingCompleted: profile?.onboardingCompleted ?? false,
      onboardingVersion: profile?.onboardingVersion ?? CURRENT_ONBOARDING_VERSION,
      profile: profile || null,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/account/onboarding
 * Server-authoritative onboarding submission and personalization setup
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Sign in required to submit onboarding." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    // Role escalation protection: client payloads can NEVER update user role or credentials
    if ("role" in body || "passwordHash" in body || "id" in body || "email" in body) {
      // Stripped/rejected safely
    }

    const parseResult = OnboardingSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: issue?.message || "Invalid onboarding payload." },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const profile = await upsertUserProfile(userId, data);

    return NextResponse.json({
      success: true,
      message: "Onboarding completed successfully.",
      onboardingCompleted: profile.onboardingCompleted,
      onboardingVersion: profile.onboardingVersion,
      profile,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
