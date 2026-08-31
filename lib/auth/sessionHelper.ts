/**
 * §SESSION INTEGRITY & USER RESOLUTION HELPER (TASK-034)
 * 
 * Provides server-authoritative session extraction, role validation,
 * and tenant isolation protection for API routes.
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./authOptions";
import { prisma } from "@/lib/db/prisma";

export interface AuthenticatedUserContext {
  userId: string;
  email: string;
  role: "USER" | "ADMIN" | "SUPERADMIN" | string;
  name?: string | null;
}

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Access forbidden.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Resolves the authenticated user from the NextAuth session.
 * Throws UnauthorizedError if session is missing or invalid.
 */
export async function requireAuthenticatedUser(): Promise<AuthenticatedUserContext> {
  const session = await getServerSession(authOptions).catch(() => null);
  const sessionUser = session?.user as { id?: string; email?: string | null; name?: string | null; role?: string } | undefined;

  const userId = sessionUser?.id;
  const email = sessionUser?.email?.toLowerCase().trim();

  if (!userId || !email) {
    throw new UnauthorizedError("Authentication required.");
  }

  // Verify user still exists in database to prevent deleted/invalidated token usage
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, name: true },
  });

  if (!dbUser) {
    throw new UnauthorizedError("User session is invalid or user no longer exists.");
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  const effectiveRole = adminEmails.includes(dbUser.email.toLowerCase().trim())
    ? "ADMIN"
    : dbUser.role || "USER";

  return {
    userId: dbUser.id,
    email: dbUser.email,
    role: effectiveRole,
    name: dbUser.name,
  };
}
