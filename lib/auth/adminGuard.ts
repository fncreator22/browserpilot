/**
 * §ADMIN ROLE & RBAC GUARD
 * Validates administrative access tokens and session claims for multi-tenant administration.
 */

import { getServerSession } from "next-auth";
import { prisma } from "@/lib/db/prisma";

export interface AdminAuthResult {
  isAdmin: boolean;
  userEmail?: string;
  role?: string;
  error?: string;
}

export async function verifyAdminAccess(adminApiKeyHeader?: string | null): Promise<AdminAuthResult> {
  // 1. Direct Secret Header Bypass (for infrastructure health and automated cron monitors)
  const serverAdminSecret = process.env.ADMIN_SECRET_KEY;
  if (serverAdminSecret && adminApiKeyHeader === serverAdminSecret) {
    return { isAdmin: true, role: "SUPERADMIN" };
  }

  // 2. NextAuth Session Role Check
  try {
    const session = await getServerSession().catch(() => null);
    if (!session?.user?.email) {
      return { isAdmin: false, error: "UNAUTHORIZED_SESSION" };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!user) {
      return { isAdmin: false, error: "USER_NOT_FOUND" };
    }

    return { isAdmin: true, userEmail: user.email, role: "ADMIN" };
  } catch (err) {
    return { isAdmin: false, error: (err as Error).message };
  }
}
