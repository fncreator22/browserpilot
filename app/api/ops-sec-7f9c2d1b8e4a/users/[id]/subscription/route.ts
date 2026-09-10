/**
 * §ADMIN USER SUBSCRIPTION MANAGEMENT REST API
 * GET /api/ops-sec-7f9c2d1b8e4a/users/[id]/subscription - Fetch user subscription details
 * POST /api/ops-sec-7f9c2d1b8e4a/users/[id]/subscription - Assign or modify user subscription
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/auth/adminGuard";
import { prisma } from "@/lib/db/prisma";
import { assignUserToPlan } from "@/lib/billing/planService";
import { recordSecurityEvent } from "@/lib/security/auditLog";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AssignSubscriptionSchema = z.object({
  planCode: z.string().min(1, "Plan code is required"),
  billingInterval: z.enum(["MONTHLY", "YEARLY", "LIFETIME"]).optional().default("MONTHLY"),
  durationDays: z.number().int().min(1).max(3650).optional(),
  paymentProvider: z.string().optional().default("MANUAL_ADMIN"),
  notes: z.string().max(300).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "User ID is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "User not found." },
        { status: 404 }
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: {
        userId: id,
        status: { in: ["ACTIVE", "TRIALING"] },
      },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });

    const priorSubscriptions = await prisma.subscription.findMany({
      where: { userId: id },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      user,
      currentSubscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            paymentProvider: subscription.paymentProvider,
            plan: {
              id: subscription.plan.id,
              code: subscription.plan.code,
              name: subscription.plan.name,
              priceMonthly: subscription.plan.priceMonthly,
              priceYearly: subscription.plan.priceYearly,
            },
          }
        : null,
      history: priorSubscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        planCode: s.plan.code,
        billingInterval: s.billingInterval,
        createdAt: s.createdAt,
        currentPeriodEnd: s.currentPeriodEnd,
      })),
    });
  } catch (err: unknown) {
    console.error("[GET /api/ops-sec-7f9c2d1b8e4a/users/[id]/subscription] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminHeader = request.headers.get("x-admin-key") || request.headers.get("authorization") || request.nextUrl.searchParams.get("admin_key");
    const auth = await verifyAdminAccess(adminHeader, request);

    if (!auth.isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Admin privileges required." },
        { status: 403 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "User ID is required." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "User does not exist." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = AssignSubscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid input data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { planCode, billingInterval, durationDays, paymentProvider, notes } = parseResult.data;

    const newSub = await assignUserToPlan(id, planCode, {
      billingInterval,
      durationDays,
      paymentProvider,
      metadata: {
        assignedBy: auth.userEmail || "SUPERADMIN",
        assignedAt: new Date().toISOString(),
        notes: notes || "Admin manual subscription assignment",
      },
    });

    recordSecurityEvent({
      type: "ADMIN_CONFIG_CHANGE",
      path: request.nextUrl.pathname,
      details: {
        action: "ASSIGN_USER_SUBSCRIPTION",
        targetUserId: id,
        targetEmail: user.email,
        planCode,
        billingInterval,
        durationDays,
        adminUser: auth.userEmail || "SUPERADMIN_KEY",
      },
    });

    return NextResponse.json({
      success: true,
      message: `Assigned user ${user.email} to ${planCode} (${billingInterval}) plan.`,
      subscription: {
        id: newSub.id,
        planCode: newSub.plan.code,
        planName: newSub.plan.name,
        status: newSub.status,
        billingInterval: newSub.billingInterval,
        currentPeriodStart: newSub.currentPeriodStart,
        currentPeriodEnd: newSub.currentPeriodEnd,
        paymentProvider: newSub.paymentProvider,
      },
    });
  } catch (err: unknown) {
    console.error("[POST /api/ops-sec-7f9c2d1b8e4a/users/[id]/subscription] Error:", err);
    return NextResponse.json(
      { error: "ASSIGNMENT_FAILED", message: (err as Error).message },
      { status: 500 }
    );
  }
}