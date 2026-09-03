import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { userMemoryVault } from "@/lib/ai/memory/userMemoryVault";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/user/memory/[id]
 * Updates a memory value after passing admission.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
        { error: "UNAUTHORIZED", message: "Authentication required." },
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

    if (!body?.value || typeof body.value !== "string" || !body.value.trim()) {
      return NextResponse.json(
        { error: "MISSING_VALUE", message: "A non-empty string value is required." },
        { status: 400 }
      );
    }

    const updateRes = await userMemoryVault.updateMemory(userId, id, body.value.trim());

    if (!updateRes.success || !updateRes.memoryItem) {
      return NextResponse.json(
        {
          error: "UPDATE_FAILED",
          message: updateRes.rejectionReason || "Failed to update memory.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      memory: {
        id: updateRes.memoryItem.id,
        category: updateRes.memoryItem.category,
        key: updateRes.memoryItem.key,
        value: updateRes.memoryItem.value,
        confidence: updateRes.memoryItem.confidence,
        importance: updateRes.memoryItem.importance,
        updatedAt: updateRes.memoryItem.updatedAt,
      },
    });
  } catch (err: unknown) {
    console.error("[UserMemoryItemAPI] PATCH Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to update user memory." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/memory/[id]
 * Deactivates/removes a memory item from the vault for the authenticated user.
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
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
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const deleted = await userMemoryVault.deleteMemory(userId, id);

    return NextResponse.json({
      success: true,
      deleted,
      id,
    });
  } catch (err: unknown) {
    console.error("[UserMemoryItemAPI] DELETE Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to delete user memory." },
      { status: 500 }
    );
  }
}
