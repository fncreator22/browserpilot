import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserById, getUserByEmail, updateUserProfile } from "@/lib/db/users";
import { getUserProfile, upsertUserProfile, USER_CATEGORIES, USAGE_CONTEXTS, ORGANIZATION_SIZES, EXPERIENCE_LEVELS } from "@/lib/db/onboarding";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const dynamic = "force-dynamic";

const UpdateAccountProfileSchema = z.object({
  name: z.string().trim().max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  geminiApiKey: z.string().trim().optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8).optional(),
  userCategory: z.enum(USER_CATEGORIES).or(z.string().max(50)).optional(),
  usageContext: z.enum(USAGE_CONTEXTS).or(z.string().max(50)).optional(),
  experienceLevel: z.enum(EXPERIENCE_LEVELS).or(z.string().max(50)).optional(),
  preferredRoles: z.array(z.string().trim().max(60)).max(10).optional(),
  preferredLocations: z.array(z.string().trim().max(60)).max(10).optional(),
  preferredWorkModes: z.array(z.string().trim().max(20)).max(5).optional(),
  targetSkills: z.array(z.string().trim().max(50)).max(20).optional(),
  organizationName: z.string().trim().max(100).optional(),
  organizationSize: z.enum(ORGANIZATION_SIZES).or(z.string().max(50)).optional(),
});

/**
 * GET /api/account/profile
 * Returns authenticated user profile, security flags, and personalization settings
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
    const userId = sessionUser?.id;
    const userEmail = sessionUser?.email?.toLowerCase().trim();

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to access your profile." },
        { status: 401 }
      );
    }

    let user = userId ? await getUserById(userId) : null;
    if (!user && userEmail) {
      user = await getUserByEmail(userEmail);
    }

    if (!user) {
      return NextResponse.json({
        id: userId || `user_${Date.now()}`,
        name: sessionUser?.name || null,
        email: userEmail || "",
        role: "USER",
        hasGeminiKey: false,
        maskedKey: null,
        createdAt: new Date(),
        personalization: null,
      });
    }

    const hasKey = !!user.geminiApiKey;
    const rawKey = user.geminiApiKey || "";
    const maskedKey = hasKey && rawKey.length > 8
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : hasKey ? "••••••••" : null;

    const personalization = await getUserProfile(user.id);

    return NextResponse.json({
      id: user.id,
      name: user.name || sessionUser?.name || null,
      email: user.email || userEmail || "",
      role: (user as any).role || "USER",
      hasGeminiKey: hasKey,
      maskedKey,
      createdAt: user.createdAt,
      personalization,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/account/profile
 * Server-authoritative update of user details and personalization
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; name?: string | null; email?: string | null } | undefined;
    const userId = sessionUser?.id;
    const userEmail = sessionUser?.email?.toLowerCase().trim();

    if (!userId && !userEmail) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to update your profile." },
        { status: 401 }
      );
    }

    let user = userId ? await getUserById(userId) : null;
    if (!user && userEmail) {
      user = await getUserByEmail(userEmail);
    }

    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account does not exist." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "INVALID_PAYLOAD", message: "A valid JSON body is required." },
        { status: 400 }
      );
    }

    // Role escalation protection: client can never write role directly
    if ("role" in body) {
      delete (body as any).role;
    }

    const parseResult = UpdateAccountProfileSchema.safeParse(body);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: issue?.message || "Invalid profile data." },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // If changing password, email, or API key, verify current password
    if (data.newPassword || (data.email && data.email !== user.email)) {
      if (!data.currentPassword) {
        return NextResponse.json(
          { error: "PASSWORD_REQUIRED", message: "Current password is required to change email or password." },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json(
          { error: "INVALID_PASSWORD", message: "Current password does not match." },
          { status: 403 }
        );
      }
    }

    // Hash new password if provided
    let newPasswordHash: string | undefined = undefined;
    if (data.newPassword) {
      newPasswordHash = await bcrypt.hash(data.newPassword, 10);
    }

    // Update base User attributes
    const updatedUser = await updateUserProfile(user.id, {
      name: data.name,
      email: data.email,
      geminiApiKey: data.geminiApiKey,
      newPasswordHash,
    });

    // Update personalization attributes if present
    const hasPersonalizationData = 
      data.userCategory !== undefined ||
      data.usageContext !== undefined ||
      data.experienceLevel !== undefined ||
      data.preferredRoles !== undefined ||
      data.preferredLocations !== undefined ||
      data.preferredWorkModes !== undefined ||
      data.targetSkills !== undefined ||
      data.organizationName !== undefined ||
      data.organizationSize !== undefined;

    let updatedPersonalization = null;
    if (hasPersonalizationData) {
      updatedPersonalization = await upsertUserProfile(user.id, {
        userCategory: data.userCategory,
        usageContext: data.usageContext,
        experienceLevel: data.experienceLevel,
        preferredRoles: data.preferredRoles,
        preferredLocations: data.preferredLocations,
        preferredWorkModes: data.preferredWorkModes,
        targetSkills: data.targetSkills,
        organizationName: data.organizationName,
        organizationSize: data.organizationSize,
      });
    } else {
      updatedPersonalization = await getUserProfile(user.id);
    }

    const hasKey = !!updatedUser.geminiApiKey;
    const rawKey = updatedUser.geminiApiKey || "";
    const maskedKey = hasKey && rawKey.length > 8
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : hasKey ? "••••••••" : null;

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        hasGeminiKey: hasKey,
        maskedKey,
      },
      personalization: updatedPersonalization,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SERVER_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
