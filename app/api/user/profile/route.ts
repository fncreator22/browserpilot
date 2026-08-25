import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserById, updateUserProfile } from "@/lib/db/users";
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
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to access your profile." },
        { status: 401 }
      );
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account not found." },
        { status: 404 }
      );
    }

    const hasKey = !!user.geminiApiKey;
    const rawKey = user.geminiApiKey || "";
    const maskedKey = hasKey && rawKey.length > 8
      ? `${rawKey.slice(0, 6)}••••••••${rawKey.slice(-4)}`
      : hasKey ? "••••••••" : null;

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      hasGeminiKey: hasKey,
      maskedKey,
      createdAt: user.createdAt,
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
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
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

    // Fetch user to verify current password
    const user = await getUserById(userId);
    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account not found." },
        { status: 404 }
      );
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
    const updated = await updateUserProfile(userId, {
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
