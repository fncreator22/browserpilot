import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export interface AdminAuthResult {
  isAdmin: boolean;
  userEmail?: string;
  role?: string;
  error?: string;
}

export async function verifyAdminAccess(adminApiKeyHeader?: string | null): Promise<AdminAuthResult> {
  // 1. Direct Secret Header / Bearer Token Bypass (for infrastructure health and automated cron / CLI monitors)
  const serverAdminSecret = process.env.ADMIN_SECRET_KEY || process.env.SCHEDULER_CRON_SECRET;
  if (serverAdminSecret && adminApiKeyHeader) {
    const cleanKey = adminApiKeyHeader.startsWith("Bearer ")
      ? adminApiKeyHeader.substring(7).trim()
      : adminApiKeyHeader.trim();
    if (cleanKey === serverAdminSecret) {
      return { isAdmin: true, role: "SUPERADMIN" };
    }
  }

  // 2. NextAuth Session Role Check
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    if (!session?.user?.email) {
      return { isAdmin: false, error: "UNAUTHORIZED_SESSION" };
    }

    const userEmail = session.user.email.toLowerCase().trim();

    // Check ADMIN_EMAILS environment variable
    const adminEmails = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (adminEmails.includes(userEmail)) {
      return { isAdmin: true, userEmail: session.user.email, role: "ADMIN" };
    }

    // Check user.role from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return { isAdmin: false, error: "USER_NOT_FOUND" };
    }

    if (user.role === "ADMIN" || user.role === "SUPERADMIN") {
      return { isAdmin: true, userEmail: user.email, role: user.role };
    }

    // Normal authenticated user -> Not an admin!
    return { isAdmin: false, userEmail: user.email, role: user.role || "USER", error: "FORBIDDEN" };
  } catch (err) {
    return { isAdmin: false, error: (err as Error).message };
  }
}
