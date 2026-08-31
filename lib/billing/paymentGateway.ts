/**
 * §PAYMENT GATEWAY & TRANSACTION ADAPTER (TASK-033)
 * 
 * Provider-agnostic payment processing boundary supporting Razorpay,
 * mock development gateways, transaction recording, and idempotent webhooks.
 */

import { prisma } from "@/lib/db/prisma";
import { assignUserToPlan } from "./planService";
import crypto from "node:crypto";

export interface CreateOrderParams {
  userId: string;
  amount: number;
  currency: string;
  planCode: string;
}

export interface VerifyPaymentParams {
  userId: string;
  orderId: string;
  paymentId: string;
  signature?: string;
  planCode: string;
}

export interface PaymentGatewayAdapter {
  createOrder(params: CreateOrderParams): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string | null;
  }>;
  verifyPayment(params: VerifyPaymentParams): Promise<{
    verified: boolean;
    transactionId: string;
  }>;
  handleWebhook(payload: any, signature?: string): Promise<{
    eventHandled: boolean;
    eventType: string;
    transactionId?: string;
  }>;
}

export class RazorpayAdapter implements PaymentGatewayAdapter {
  private keyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || null;
  private keySecret = process.env.RAZORPAY_KEY_SECRET || null;

  public async createOrder(params: CreateOrderParams) {
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Record initial PENDING transaction
    await prisma.paymentTransaction.create({
      data: {
        userId: params.userId,
        amount: params.amount,
        currency: params.currency,
        provider: "RAZORPAY",
        providerOrderId: orderId,
        status: "PENDING",
        metadata: JSON.stringify({ planCode: params.planCode }),
      },
    });

    return {
      orderId,
      amount: params.amount,
      currency: params.currency,
      keyId: this.keyId || "rzp_test_mock_key_id",
    };
  }

  public async verifyPayment(params: VerifyPaymentParams) {
    const isMock = !this.keySecret || this.keySecret.includes("mock") || this.keySecret.includes("test");

    let isValidSignature = true;
    if (!isMock && params.signature) {
      const generatedSignature = crypto
        .createHmac("sha256", this.keySecret!)
        .update(`${params.orderId}|${params.paymentId}`)
        .digest("hex");
      isValidSignature = generatedSignature === params.signature;
    }

    if (!isValidSignature) {
      // Update transaction to FAILED
      await prisma.paymentTransaction.updateMany({
        where: { providerOrderId: params.orderId },
        data: {
          status: "FAILED",
          failureReason: "INVALID_SIGNATURE",
          providerPaymentId: params.paymentId,
        },
      });
      return { verified: false, transactionId: "" };
    }

    // Find pending transaction
    const existingTx = await prisma.paymentTransaction.findFirst({
      where: { providerOrderId: params.orderId },
    });

    const txId = existingTx?.id || `tx_${Date.now()}`;

    // Update transaction to SUCCESS
    if (existingTx) {
      await prisma.paymentTransaction.update({
        where: { id: existingTx.id },
        data: {
          status: "SUCCESS",
          providerPaymentId: params.paymentId,
          providerSignature: params.signature || "mock_sig",
          updatedAt: new Date(),
        },
      });
    }

    // Provision subscription on verified payment
    await assignUserToPlan(params.userId, params.planCode, {
      paymentProvider: "RAZORPAY",
      providerSubscriptionId: params.paymentId,
      metadata: { orderId: params.orderId, paymentId: params.paymentId },
    });

    return { verified: true, transactionId: txId };
  }

  public async handleWebhook(payload: any, signature?: string) {
    const eventType = payload?.event || "unknown";
    const paymentEntity = payload?.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;

    if (eventType === "payment.captured" && orderId) {
      const existingTx = await prisma.paymentTransaction.findFirst({
        where: { providerOrderId: orderId },
      });

      if (existingTx && existingTx.status !== "SUCCESS") {
        await prisma.paymentTransaction.update({
          where: { id: existingTx.id },
          data: {
            status: "SUCCESS",
            providerPaymentId: paymentId,
            updatedAt: new Date(),
          },
        });

        let meta: any = {};
        try {
          meta = JSON.parse(existingTx.metadata || "{}");
        } catch {}

        if (meta.planCode) {
          await assignUserToPlan(existingTx.userId, meta.planCode, {
            paymentProvider: "RAZORPAY_WEBHOOK",
            providerSubscriptionId: paymentId,
          });
        }
      }

      return { eventHandled: true, eventType, transactionId: existingTx?.id };
    }

    return { eventHandled: false, eventType };
  }
}

export const paymentGateway: PaymentGatewayAdapter = new RazorpayAdapter();
