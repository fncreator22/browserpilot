import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const adminHeader = request.headers.get("x-admin-key");
    const auth = await verifyAdminAccess(adminHeader);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const [totalJobs, completedJobs, failedJobs, totalUsers] = await Promise.all([
      prisma.job.count(),
      prisma.job.count({ where: { status: "COMPLETED" } }),
      prisma.job.count({ where: { status: "FAILED" } }),
      prisma.user.count(),
    ]);

    const aggregateMetrics = await prisma.job.aggregate({
      _sum: {
        tokensUsed: true,
        totalDurationMs: true,
      },
      _avg: {
        totalDurationMs: true,
        tokensUsed: true,
      },
    });

    const memoryRssMb = Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
    const uptimeSeconds = Math.round(process.uptime());

    return NextResponse.json({
      system: {
        status: "OPERATIONAL",
        uptimeSeconds,
        memoryRssMb,
        nodeVersion: process.version,
      },
      counts: {
        totalUsers,
        totalJobs,
        completedJobs,
        failedJobs,
        successRate: totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 100,
      },
      tokens: {
        totalConsumed: aggregateMetrics._sum.tokensUsed || 0,
        averagePerJob: Math.round(aggregateMetrics._avg.tokensUsed || 0),
      },
      performance: {
        averageDurationMs: Math.round(aggregateMetrics._avg.totalDurationMs || 0),
      },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: "METRICS_FETCH_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}
