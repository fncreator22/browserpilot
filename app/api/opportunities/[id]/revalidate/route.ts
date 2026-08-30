import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { revalidateOpportunity } from "@/lib/scraper/evidenceVerifier";
import { getOpportunityWithSourceListings } from "@/lib/db/opportunities";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const oppId = params.id;

    if (!oppId) {
      return NextResponse.json(
        { error: "INVALID_REQUEST", message: "Missing required opportunity ID." },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions).catch(() => null);
    const userId = (session?.user as { id?: string })?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required to revalidate opportunities." },
        { status: 401 }
      );
    }

    // Verify opportunity exists
    const existing = await getOpportunityWithSourceListings(oppId);
    if (!existing) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Opportunity not found." },
        { status: 404 }
      );
    }

    let force = false;
    try {
      const body = await request.json();
      if (typeof body?.force === "boolean") force = body.force;
    } catch {
      // Body optional
    }

    // Execute bounded revalidation
    const summary = await revalidateOpportunity(existing.id, {
      force,
      timeoutMs: 3000,
    });

    if (!summary) {
      return NextResponse.json(
        { error: "REVALIDATION_FAILED", message: "Failed to complete opportunity revalidation." },
        { status: 500 }
      );
    }

    // Fetch updated opportunity state
    const updated = await getOpportunityWithSourceListings(existing.id);

    return NextResponse.json({
      success: true,
      revalidation: summary,
      opportunity: updated,
    });
  } catch (err: unknown) {
    console.error("[OpportunityRevalidationAPI] Error during revalidation:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Unexpected error during opportunity revalidation." },
      { status: 500 }
    );
  }
}
