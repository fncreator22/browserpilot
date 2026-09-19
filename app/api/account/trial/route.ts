import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { getUserTrialStatus } from "@/lib/billing/trialService";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;

    let activeUserId = sessionUser?.id;

    if (!activeUserId && sessionUser?.email) {
      const dbUser = await prisma.user.findUnique({
        where: { email: sessionUser.email.toLowerCase().trim() },
        select: { id: true },
      });
      if (dbUser) {
        activeUserId = dbUser.id;
      }
    }

    const trial = await getUserTrialStatus(activeUserId || "guest");
    return NextResponse.json({ trial }, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/account/trial] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to retrieve trial status." },
      { status: 500 }
    );
  }
}
