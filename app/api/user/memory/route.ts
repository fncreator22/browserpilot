import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { userMemoryVault } from "@/lib/ai/memory/userMemoryVault";
import { extractAndStorePreferences } from "@/lib/ai/memory/preferenceExtractor";
import { type MemoryCategory } from "@/lib/ai/memory/memoryTypes";

export const dynamic = "force-dynamic";

/**
 * GET /api/user/memory
 * Retrieves durable preferences and recommendation signals for the authenticated user.
 */
export async function GET(request: NextRequest) {
  try {
    let userId: string | undefined;

    if (process.env.NODE_ENV === "test" || process.env.IS_TEST_HARNESS === "true") {
      const headerUser = request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      const session = await getServerSession(authOptions).catch(() => null);
      userId = (session?.user as { id?: string })?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to access user memory." },
        { status: 401 }
      );
    }

    const memoryResult = await userMemoryVault.getMemories({
      userId,
      limit: 50,
      minImportance: 0.1,
    });

    // Separate explicit/durable preferences from recommendation signals
    const preferences = memoryResult.memories.filter(
      (m) => m.category !== "RECOMMENDATION_SIGNAL" && m.category !== "RESULT_FEEDBACK"
    );

    const recommendations = memoryResult.memories.filter(
      (m) => m.category === "RECOMMENDATION_SIGNAL"
    );

    return NextResponse.json({
      userId,
      totalCount: memoryResult.totalRetrieved,
      preferences: preferences.map((p) => ({
        id: p.id,
        category: p.category,
        key: p.key,
        value: p.value,
        confidence: p.confidence,
        importance: p.importance,
        updatedAt: p.updatedAt,
      })),
      recommendations: recommendations.map((r) => ({
        id: r.id,
        category: r.category,
        key: r.key,
        value: r.value,
        confidence: r.confidence,
        importance: r.importance,
        updatedAt: r.updatedAt,
      })),
    });
  } catch (err: unknown) {
    console.error("[UserMemoryAPI] GET Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve user memory." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/memory
 * Explicitly adds a durable preference or parses a natural-language statement.
 */
export async function POST(request: NextRequest) {
  try {
    let userId: string | undefined;

    if (process.env.NODE_ENV === "test" || process.env.IS_TEST_HARNESS === "true") {
      const headerUser = request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      const session = await getServerSession(authOptions).catch(() => null);
      userId = (session?.user as { id?: string })?.id;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to store user memory." },
        { status: 401 }
      );
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Invalid JSON body." },
        { status: 400 }
      );
    }

    // Flow 1: Natural-language preference statement
    if (typeof body.text === "string" && body.text.trim()) {
      const result = await extractAndStorePreferences(userId, body.text);

      if (result.admittedMemories.length === 0) {
        return NextResponse.json(
          {
            error: "ADMISSION_REJECTED",
            message: result.rejectedReasons[0] || "Memory candidate was rejected by admission policy.",
            rejectedReasons: result.rejectedReasons,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        admittedCount: result.admittedMemories.length,
        memories: result.admittedMemories.map((m) => ({
          id: m.id,
          category: m.category,
          key: m.key,
          value: m.value,
          confidence: m.confidence,
          importance: m.importance,
        })),
      });
    }

    // Flow 2: Structured preference candidate
    const { category, key, value, confidence, importance } = body;
    if (!category || !key || value === undefined) {
      return NextResponse.json(
        { error: "MISSING_FIELDS", message: "Required fields: category, key, value." },
        { status: 400 }
      );
    }

    const storeRes = await userMemoryVault.storeMemory({
      userId,
      category: category as MemoryCategory,
      key: String(key).trim(),
      value,
      confidence: confidence || "EXPLICIT",
      importance: typeof importance === "number" ? importance : 0.9,
      isExplicit: true,
      sourceContext: "API explicit preference addition",
    });

    if (!storeRes.success || !storeRes.memoryItem) {
      return NextResponse.json(
        {
          error: "ADMISSION_REJECTED",
          message: storeRes.rejectionReason || "Candidate was rejected by admission policy.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      memory: {
        id: storeRes.memoryItem.id,
        category: storeRes.memoryItem.category,
        key: storeRes.memoryItem.key,
        value: storeRes.memoryItem.value,
        confidence: storeRes.memoryItem.confidence,
        importance: storeRes.memoryItem.importance,
      },
    });
  } catch (err: unknown) {
    console.error("[UserMemoryAPI] POST Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to store user memory." },
      { status: 500 }
    );
  }
}
