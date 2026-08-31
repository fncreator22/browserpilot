/**
 * §PAYMENT CHECKOUT INTENT REST API (TASK-033)
 * POST /api/billing/checkout - Create a payment order intent for Razorpay / payment gateway
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { paymentGateway } from "@/lib/billing/paymentGateway";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const CheckoutSchema = z.object({
  planCode: z.enum(["PREMIUM", "ENTERPRISE"]),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const sessionUser = session?.user as { id?: string; email?: string } | undefined;
    const userId = sessionUser?.id;

    if (!userId) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", message: "Authentication required." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "BAD_REQUEST", message: "Request body is required." },
        { status: 400 }
      );
    }

    const parseResult = CheckoutSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid checkout data.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const plan = await prisma.plan.findUnique({
      where: { code: parseResult.data.planCode },
    });

    if (!plan || !plan.active) {
      return NextResponse.json(
        { error: "PLAN_NOT_FOUND", message: "Selected plan is not available." },
        { status: 404 }
      );
    }

    const amount = parseResult.data.billingInterval === "YEARLY" ? plan.priceYearly : plan.priceMonthly;

    const order = await paymentGateway.createOrder({
      userId,
      amount,
      currency: plan.currency,
      planCode: plan.code,
    });

    return NextResponse.json({
      success: true,
      order,
      plan: {
        code: plan.code,
        name: plan.name,
      },
    });
  } catch (err: unknown) {
    console.error("[POST /api/billing/checkout] Error:", err);
    return NextResponse.json(
      { error: "CHECKOUT_FAILED", message: (err as Error).message || "Failed to initialize payment checkout." },
      { status: 500 }
    );
  }
}
