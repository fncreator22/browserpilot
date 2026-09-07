import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";
import { upsertDiscoveryWatch, getDiscoveryWatch } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    const effectiveUserId = userId || (isDevOrTest ? "dev_user" : null);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to manage connector preferences." },
        { status: 401 }
      );
    }

    // 1. Fetch user-visible active connectors (excluding blocked/unavailable)
    const availableSources = await prisma.discoverySource.findMany({
      where: {
        isEnabled: true,
        isPublic: true,
        status: { not: "BLOCKED" },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        type: true,
        requiresAuth: true,
        iconUrl: true,
        baseUrl: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // 2. Fetch user's preferred sources
    let preferredSources: string[] = [];
    try {
      const watch = await getDiscoveryWatch(effectiveUserId);
      if (watch && watch.preferredSources && watch.preferredSources.length > 0) {
        preferredSources = watch.preferredSources;
      } else {
        preferredSources = availableSources.map((s) => s.name);
      }
    } catch {
      preferredSources = availableSources.map((s) => s.name);
    }

    // Filter preferred sources to only include currently available ones
    const availableNames = new Set(availableSources.map((s) => s.name.toLowerCase()));
    const activePreferred = preferredSources.filter((s) => availableNames.has(s.toLowerCase()));

    // 3. Fetch connected browser sessions for session-beneficial sources
    const sessions = await prisma.browserSession.findMany({
      where: {
        userId: effectiveUserId,
        status: "CONNECTED",
      },
      select: {
        id: true,
        source: true,
        status: true,
        username: true,
        expiresAt: true,
        lastVerifiedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      connectors: availableSources,
      preferredSources: activePreferred.length > 0 ? activePreferred : availableSources.map((s) => s.name),
      connectedSessions: sessions,
    });
  } catch (err: unknown) {
    console.error("[AccountConnectorsAPI] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to load connector preferences." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    const effectiveUserId = userId || (isDevOrTest ? "dev_user" : null);

    if (!effectiveUserId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Please sign in to modify connector preferences." },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { preferredSources } = body;

    if (!Array.isArray(preferredSources)) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "preferredSources must be an array of source names." },
        { status: 400 }
      );
    }

    // Persist to user's DiscoveryWatch (the canonical user-level store)
    const updatedWatch = await upsertDiscoveryWatch(effectiveUserId, {
      preferredSources,
    });

    return NextResponse.json({
      success: true,
      preferredSources: updatedWatch.preferredSources,
      message: "Connector preferences updated successfully.",
    });
  } catch (err: unknown) {
    console.error("[AccountConnectorsAPI] POST error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update connector preferences." },
      { status: 500 }
    );
  }
}
