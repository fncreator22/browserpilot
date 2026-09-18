/**
 * §PUTER PROVIDER REST API ROUTE (TASK-032)
 * POST /api/account/providers/puter - Connect or verify Puter account
 * DELETE /api/account/providers/puter - Disconnect Puter account
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import {
  upsertPuterConnection,
  disconnectProviderConnection,
} from "@/lib/ai/governance/providerGovernance";
import { z } from "zod";

const PuterConnectSchema = z.object({
  username: z.string().min(1, "Username is required").max(100, "Username too long"),
  token: z.string().min(1, "Token cannot be empty").optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let activeUserId = sessionUser?.id;

    let dbUser = activeUserId ? await prisma.user.findUnique({ where: { id: activeUserId } }) : null;
    if (!dbUser && sessionUser?.email) {
      dbUser = await prisma.user.findUnique({ where: { email: sessionUser.email.toLowerCase().trim() } });
      if (dbUser) activeUserId = dbUser.id;
    }

    if (!activeUserId || !dbUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required or user account not found." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = PuterConnectSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid Puter connection data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const connection = await upsertPuterConnection(activeUserId, parseResult.data);

    return NextResponse.json({
      success: true,
      provider: connection,
    });
  } catch (err: any) {
    console.error("[POST /api/account/providers/puter] Error:", err);
    if (
      err?.code === "P2003" ||
      err?.message?.includes("USER_NOT_FOUND") ||
      err?.message?.includes("P2003") ||
      err?.message?.includes("Foreign key constraint")
    ) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "User account could not be resolved or does not exist." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message || "Failed to connect Puter account." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    let activeUserId = sessionUser?.id;

    let dbUser = activeUserId ? await prisma.user.findUnique({ where: { id: activeUserId } }) : null;
    if (!dbUser && sessionUser?.email) {
      dbUser = await prisma.user.findUnique({ where: { email: sessionUser.email.toLowerCase().trim() } });
      if (dbUser) activeUserId = dbUser.id;
    }

    if (!activeUserId || !dbUser) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const result = await disconnectProviderConnection(activeUserId, "PUTER");

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[DELETE /api/account/providers/puter] Error:", err);
    if (
      err?.code === "P2003" ||
      err?.message?.includes("USER_NOT_FOUND") ||
      err?.message?.includes("P2003") ||
      err?.message?.includes("Foreign key constraint")
    ) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "User account could not be resolved or does not exist." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to disconnect Puter account." },
      { status: 500 }
    );
  }
}
