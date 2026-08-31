/**
 * §OUTBOUND EMAIL DISPATCH BOUNDARY (TASK-036)
 * 
 * Decouples notification creation from delivery, providing an
 * idempotent, pluggable interface ready for AWS SES / SendGrid.
 */

import { logger } from "@/lib/infra/logger";
import { idempotency } from "@/lib/infra/idempotency";

export interface EmailIntent {
  to: string;
  subject: string;
  templateName: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface EmailDispatchResult {
  dispatched: boolean;
  messageId: string;
  deliveredAt: Date;
}

export interface EmailDispatcher {
  dispatch(intent: EmailIntent): Promise<EmailDispatchResult>;
}

export class LocalEmailDispatcher implements EmailDispatcher {
  private sentMails: EmailIntent[] = [];

  public async dispatch(intent: EmailIntent): Promise<EmailDispatchResult> {
    const { executed, result } = await idempotency.run(
      `email:${intent.idempotencyKey}`,
      86400, // 24h idempotency window
      async () => {
        this.sentMails.push(intent);
        logger.info("[EmailDispatcher] Dispatched outbound notification email", {
          to: intent.to.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask recipient email
          subject: intent.subject,
          template: intent.templateName,
          idempotencyKey: intent.idempotencyKey,
        });

        return {
          dispatched: true,
          messageId: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          deliveredAt: new Date(),
        };
      }
    );

    return result;
  }

  public getSentMails(): EmailIntent[] {
    return [...this.sentMails];
  }

  public clear(): void {
    this.sentMails = [];
  }
}

export const emailDispatcher: LocalEmailDispatcher = new LocalEmailDispatcher();
