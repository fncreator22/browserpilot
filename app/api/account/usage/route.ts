/**
 * §ACCOUNT USAGE REST API ROUTE (TASK-032)
 * GET /api/account/usage - Returns user's AI usage statistics and recent events
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserUsageSummary } from "@/lib/ai/governance/providerGovernance";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;
    if (!userId && !sessionUser?.email) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    let activeUserId = userId;
    let dbUser = userId ? await prisma.user.findUnique({ where: { id: userId } }) : null;
    if (!dbUser && sessionUser?.email) {
      dbUser = await prisma.user.findUnique({ where: { email: sessionUser.email.toLowerCase().trim() } });
      if (dbUser) {
        activeUserId = dbUser.id;
      }
    }

    if (!activeUserId) {
      return NextResponse.json(
        { error: "USER_NOT_FOUND", message: "User account could not be found." },
        { status: 404 }
      );
    }

    const summary = await getUserUsageSummary(activeUserId);

    return NextResponse.json({
      summary,
    });
  } catch (err: unknown) {
    console.error("[GET /api/account/usage] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve usage summary." },
      { status: 500 }
    );
  }
}
