import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { createUser, getUserByEmail } from "@/lib/db/users";

const RegisterSchema = z.object({
  name: z.string().trim().optional(),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long." }),
  geminiApiKey: z
    .string()
    .trim()
    .min(10, { message: "Please provide a valid Gemini API Key from Google AI Studio." }),
});

/**
 * POST /api/auth/register
 * Real email + password + BYOK Gemini API Key account registration
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = RegisterSchema.safeParse(body);
    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          message: firstIssue?.message || "Invalid registration details.",
        },
        { status: 400 }
      );
    }

    const { name, email, password, geminiApiKey } = parseResult.data;

    // Check if user already exists
    const existing = await getUserByEmail(email);
    if (existing) {
      return NextResponse.json(
        {
          error: "EMAIL_ALREADY_REGISTERED",
          message: "An account with this email address already exists.",
        },
        { status: 409 }
      );
    }

    // Hash password securely with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user in database with BYOK Gemini API key
    const newUser = await createUser({
      name,
      email,
      passwordHash,
      geminiApiKey,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully with Gemini API Key configured.",
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Internal server error";
    console.error("[Register] Account registration failed:", err);
    return NextResponse.json(
      {
        error: "REGISTRATION_FAILED",
        message: "An error occurred while creating your account. Please try again.",
        detail: errorMsg,
      },
      { status: 500 }
    );
  }
}
