/**
 * §PAYMENT GATEWAY WEBHOOK REST API (TASK-033)
 * POST /api/billing/webhook - Idempotent webhook receiver for payment notifications
 */

import { NextResponse } from "next/server";
import { paymentGateway } from "@/lib/billing/paymentGateway";

export async function POST(req: Request) {
  try {
    const headersObj: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersObj[key.toLowerCase()] = value;
    });

    const signature = req.headers.get("x-razorpay-signature") || req.headers.get("stripe-signature") || undefined;
    const body = await req.json().catch(() => null);

    if (!body) {
      return NextResponse.json({ error: "BAD_REQUEST", message: "Invalid webhook JSON payload" }, { status: 400 });
    }

    const result = await paymentGateway.handleWebhook(body, signature, headersObj);

    return NextResponse.json({
      received: true,
      handled: result.eventHandled,
      eventType: result.eventType,
    });
  } catch (err: unknown) {
    console.error("[POST /api/billing/webhook] Error:", err);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed processing payment webhook." },
      { status: 500 }
    );
  }
}
