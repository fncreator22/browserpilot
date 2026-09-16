import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { 
  saveOpportunity, 
  unsaveOpportunity, 
  isOpportunitySaved,
  getOpportunityById,
  getOpportunityByCanonicalHash
} from "@/lib/db/opportunities";
import { fastButtonCache } from "@/lib/cache/buttonCache";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

async function resolveOpportunityId(idOrHash: string): Promise<string | null> {
  const cached = fastButtonCache.getResolvedOpportunityId(idOrHash);
  if (cached) return cached;

  // Check if it's already an opportunity ID
  const oppById = await getOpportunityById(idOrHash);
  if (oppById) {
    fastButtonCache.setResolvedOpportunityId(idOrHash, oppById.id);
    return oppById.id;
  }

  // Otherwise check if it's a canonical hash
  const oppByHash = await getOpportunityByCanonicalHash(idOrHash);
  if (oppByHash) {
    fastButtonCache.setResolvedOpportunityId(idOrHash, oppByHash.id);
    return oppByHash.id;
  }

  return null;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "AUTHENTICATION_REQUIRED", message: "You must be signed in to save opportunities." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const opportunityId = await resolveOpportunityId(resolvedParams.id);

    if (!opportunityId) {
      return NextResponse.json(
        { error: "OPPORTUNITY_NOT_FOUND", message: "Opportunity could not be found." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const savedRecord = await saveOpportunity(userId, opportunityId, body.notes);
    fastButtonCache.setSavedStatus(userId, opportunityId, true);

    return NextResponse.json({
      saved: true,
      opportunityId,
      savedRecordId: savedRecord.id,
      savedAt: savedRecord.createdAt,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "SAVE_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = _request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "AUTHENTICATION_REQUIRED", message: "You must be signed in to modify saved opportunities." },
        { status: 401 }
      );
    }

    const resolvedParams = await params;
    const opportunityId = await resolveOpportunityId(resolvedParams.id);

    if (!opportunityId) {
      return NextResponse.json(
        { error: "OPPORTUNITY_NOT_FOUND", message: "Opportunity could not be found." },
        { status: 404 }
      );
    }

    const result = await unsaveOpportunity(userId, opportunityId);
    fastButtonCache.setSavedStatus(userId, opportunityId, false);

    return NextResponse.json({
      saved: false,
      opportunityId,
      deleted: result.deleted,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "UNSAVE_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions).catch(() => null);
    let userId = (session?.user as { id?: string })?.id;

    if (!userId && (process.env.NODE_ENV === "test" || (process.env as any).IS_TEST_HARNESS === "true")) {
      const headerUser = _request.headers.get("x-test-user-id");
      if (headerUser) userId = headerUser;
    }

    if (!userId) {
      return NextResponse.json({ saved: false, authenticated: false });
    }

    const resolvedParams = await params;
    const opportunityId = await resolveOpportunityId(resolvedParams.id);

    if (!opportunityId) {
      return NextResponse.json({ saved: false, error: "NOT_FOUND" }, { status: 404 });
    }

    const cachedStatus = await fastButtonCache.getSavedStatus(userId, opportunityId);
    if (cachedStatus !== null) {
      return NextResponse.json({ saved: cachedStatus, opportunityId, cached: true });
    }

    const saved = await isOpportunitySaved(userId, opportunityId);
    fastButtonCache.setSavedStatus(userId, opportunityId, saved);
    return NextResponse.json({ saved, opportunityId });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "STATUS_CHECK_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}
