import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserById, getUserByEmail, updateUserProfile, createUser } from "@/lib/db/users";
import { getUserProfile } from "@/lib/db/onboarding";
import bcrypt from "bcryptjs";
import { z } from "zod";

const UpdateProfileSchema = z.object({
  name: z.string().trim().optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  geminiApiKey: z.string().trim().optional(),
  currentPassword: z.string().min(1, { message: "Current password is required to save profile changes." }),
  newPassword: z.string().min(8, { message: "New password must be at least 8 characters long." }).optional(),
});

/**
 * GET /api/user/profile
 * Returns authenticated user profile with masked Gemini API key
 */
export async function GET() {
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
      // Graceful fallback for authenticated session
      return NextResponse.json({
        id: userId || `user_${Date.now()}`,
        name: sessionUser?.name || null,
        email: userEmail || "",
        hasGeminiKey: false,
        maskedKey: null,
        createdAt: new Date(),
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
 * POST /api/user/profile
 * Updates user profile settings (name, email, BYOK Gemini API key, password) with password verification
 */
export async function POST(request: Request) {
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

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = UpdateProfileSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        { error: "VALIDATION_ERROR", message: firstIssue?.message || "Invalid profile data." },
        { status: 400 }
      );
    }

    const { name, email, geminiApiKey, currentPassword, newPassword } = parseResult.data;

    // Fetch user by ID or Email
    let user = userId ? await getUserById(userId) : null;
    if (!user && userEmail) {
      user = await getUserByEmail(userEmail);
    }

    // If user account is not yet saved on this serverless instance, initialize it
    if (!user) {
      const passwordHash = await bcrypt.hash(newPassword || currentPassword, 10);
      const created = await createUser({
        name: name || sessionUser?.name || undefined,
        email: (email || userEmail)!,
        passwordHash,
        geminiApiKey: geminiApiKey || undefined,
      });

      const hasKey = !!created.geminiApiKey;
      const rawKey = created.geminiApiKey || "";
      const maskedKey = hasKey && rawKey.length > 8
        ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
        : hasKey ? "••••••••" : null;

      return NextResponse.json({
        success: true,
        message: "Profile and Gemini API Key saved successfully.",
        user: {
          id: created.id,
          name: created.name,
          email: created.email,
          hasGeminiKey: hasKey,
          maskedKey,
        },
      });
    }

    // Verify current password
    const isPasswordCorrect = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordCorrect) {
      return NextResponse.json(
        {
          error: "INVALID_PASSWORD",
          message: "Incorrect password. You must enter your current password to save profile changes.",
        },
        { status: 401 }
      );
    }

    // Optional: hash new password if provided
    let newPasswordHash: string | undefined;
    if (newPassword) {
      newPasswordHash = await bcrypt.hash(newPassword, 10);
    }

    // Update profile
    const updated = await updateUserProfile(user.id, {
      name,
      email,
      geminiApiKey: geminiApiKey !== undefined ? geminiApiKey : undefined,
      newPasswordHash,
    });

    const hasKey = !!updated.geminiApiKey;
    const rawKey = updated.geminiApiKey || "";
    const maskedKey = hasKey && rawKey.length > 8
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : hasKey ? "••••••••" : null;

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully.",
      user: {
        id: updated.id,
        name: updated.name,
        email: updated.email,
        hasGeminiKey: hasKey,
        maskedKey,
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "UPDATE_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}
