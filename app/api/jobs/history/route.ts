import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getServerSession } from "next-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession().catch(() => null);
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const query = searchParams.get("q") || "";

    const whereClause: any = {};
    if (session?.user?.email) {
      whereClause.user = { email: session.user.email };
    }
    if (query) {
      whereClause.prompt = { contains: query };
    }

    const jobs = await prisma.job.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        prompt: true,
        status: true,
        summary: true,
        progress: true,
        tokensUsed: true,
        totalDurationMs: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      history: jobs,
      total: jobs.length,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "HISTORY_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
