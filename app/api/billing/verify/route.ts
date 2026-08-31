/**
 * §PAYMENT VERIFICATION REST API (TASK-033)
 * POST /api/billing/verify - Verify payment gateway signature and provision subscription
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/authOptions";
import { paymentGateway } from "@/lib/billing/paymentGateway";
import { z } from "zod";

const VerifyPaymentSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().min(1),
  signature: z.string().optional(),
  planCode: z.enum(["PREMIUM", "ENTERPRISE"]),
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

    const parseResult = VerifyPaymentSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_FAILED",
          message: parseResult.error.issues[0]?.message || "Invalid payment payload.",
          errors: parseResult.error.issues,
        },
        { status: 400 }
      );
    }

    const result = await paymentGateway.verifyPayment({
      userId,
      orderId: parseResult.data.orderId,
      paymentId: parseResult.data.paymentId,
      signature: parseResult.data.signature,
      planCode: parseResult.data.planCode,
    });

    if (!result.verified) {
      return NextResponse.json(
        { error: "PAYMENT_VERIFICATION_FAILED", message: "Invalid payment signature or credentials." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      transactionId: result.transactionId,
      planCode: parseResult.data.planCode,
      message: `Payment verified! Successfully upgraded to ${parseResult.data.planCode} plan.`,
    });
  } catch (err: unknown) {
    console.error("[POST /api/billing/verify] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: (err as Error).message || "Payment verification error." },
      { status: 500 }
    );
  }
}
