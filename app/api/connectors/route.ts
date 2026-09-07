import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    const isDevOrTest =
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test" ||
      (process.env as any).IS_TEST_HARNESS === "true";

    if (!userId && !isDevOrTest) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const sources = await prisma.discoverySource.findMany({
      where: {
        isEnabled: true,
        isPublic: true,
        status: { not: "BLOCKED" },
      },
      select: {
        id: true,
        name: true,
        displayName: true,
        iconUrl: true,
        baseUrlPattern: true,
        type: true,
        requiresAuth: true,
        status: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json({
      success: true,
      connectors: sources,
    });
  } catch (err: unknown) {
    console.error("[ConnectorsAPI] GET error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to load connectors." },
      { status: 500 }
    );
  }
}
