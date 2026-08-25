import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";

const RegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email({ message: "Please enter a valid email address." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters long." }),
});

/**
 * POST /api/auth/register
 * Real email + password account registration
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

    const { email, password } = parseResult.data;

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

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

    // Create user in database
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Account created successfully.",
        user: {
          id: newUser.id,
          email: newUser.email,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const errorMsg = (err as Error).message || "Internal server error";
    return NextResponse.json(
      {
        error: "REGISTRATION_FAILED",
        message: "An error occurred while creating your account. Please try again.",
        detail: process.env.NODE_ENV === "development" ? errorMsg : undefined,
      },
      { status: 500 }
    );
  }
}
