import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserSearches } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to view search history." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10), 1), 100);

    const searches = await getUserSearches(userId, limit);

    function parseStoredSkills(raw: unknown): string[] {
      if (Array.isArray(raw)) return raw.filter((s): s is string => typeof s === "string");
      if (typeof raw === "string") {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed.filter((s): s is string => typeof s === "string");
          if (typeof parsed === "string" && parsed.trim().length > 0) return [parsed.trim()];
        } catch {
          if (raw.trim().length > 0) return [raw.trim()];
        }
      }
      return [];
    }

    return NextResponse.json({
      history: searches.map((s) => ({
        id: s.id,
        rawQuery: s.rawQuery,
        intentType: s.intentType,
        parsedRole: s.parsedRole,
        parsedSkills: parseStoredSkills(s.parsedSkills),
        parsedLocation: s.parsedLocation,
        parsedWorkMode: s.parsedWorkMode,
        targetGradYear: s.targetGradYear,
        totalFound: s.totalFound,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (err: unknown) {
    console.error("[SearchHistoryAPI] Error retrieving search history:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve search history." },
      { status: 500 }
    );
  }
}
