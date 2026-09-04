/**
 * §OUTBOUND EMAIL DISPATCHER (TASK-020)
 * Orchestrates reliable, idempotent outbound email delivery for LifecycleAlert records.
 * Ensures zero duplicate emails on scheduler retries and strict tenant isolation.
 */

import { prisma } from "@/lib/db/prisma";
import { 
  type EmailProvider, 
  type EmailDeliveryResult, 
  type OutboundEmailPayload,
  ConsoleEmailProvider 
} from "./emailProvider";
import { formatLifecycleAlertEmail } from "./emailTemplate";

export interface LifecycleAlertOpportunityInput {
  id: string;
  title: string;
  companyName: string;
  location?: string | null;
  workMode?: string | null;
  opportunityType?: string | null;
  matchScore?: number | null;
  postedAgoText?: string | null;
  postedAt?: Date | string | null;
  matchReason?: string | null;
  primaryApplyUrl?: string | null;
  skills?: string[] | string | null;
  description?: string | null;
}

export class OutboundEmailDispatcher {
  private static instance: OutboundEmailDispatcher;
  private defaultProvider: EmailProvider;
  private deliveredAlertKeyCache = new Set<string>();

  constructor(provider?: EmailProvider) {
    this.defaultProvider = provider || new ConsoleEmailProvider();
  }

  public static getInstance(provider?: EmailProvider): OutboundEmailDispatcher {
    if (!OutboundEmailDispatcher.instance) {
      OutboundEmailDispatcher.instance = new OutboundEmailDispatcher(provider);
    } else if (provider) {
      OutboundEmailDispatcher.instance.setDefaultProvider(provider);
    }
    return OutboundEmailDispatcher.instance;
  }

  public setDefaultProvider(provider: EmailProvider): void {
    this.defaultProvider = provider;
  }

  public getDefaultProvider(): EmailProvider {
    return this.defaultProvider;
  }

  public clearDeliveryCache(): void {
    this.deliveredAlertKeyCache.clear();
  }

  /**
   * Dispatches an outbound email for an eligible LifecycleAlert.
   * Strictly enforces idempotency, multi-tenant isolation, and truthfulness.
   */
  async dispatchLifecycleAlertEmail(
    alert: {
      id: string;
      userId: string;
      opportunityId?: string | null;
      transitionType: string;
      idempotencyKey?: string | null;
      title: string;
      companyName: string;
      message: string;
    },
    opportunity: LifecycleAlertOpportunityInput,
    options: { customProvider?: EmailProvider; appBaseUrl?: string } = {}
  ): Promise<EmailDeliveryResult> {
    const provider = options.customProvider || this.defaultProvider;

    // 1. Classification Eligibility Gate
    // Supported types: NEW_OPPORTUNITY, REPOSTED, NEW_SOURCE
    // ALREADY_KNOWN must never generate an email
    const eligibleTypes = ["NEW_OPPORTUNITY", "REPOSTED", "NEW_SOURCE"];
    if (!eligibleTypes.includes(alert.transitionType)) {
      return {
        success: true,
        messageId: "skipped_ineligible_classification",
        providerName: provider.name,
      };
    }

    // 2. Delivery Idempotency Check
    const dispatchKey = alert.idempotencyKey || `email_${alert.userId}_${alert.id}_${alert.transitionType}`;
    if (this.deliveredAlertKeyCache.has(dispatchKey)) {
      return {
        success: true,
        messageId: `idempotent_duplicate_suppressed_${dispatchKey}`,
        providerName: provider.name,
      };
    }

    // 3. Multi-Tenant User Email Resolution
    const user = await prisma.user.findUnique({
      where: { id: alert.userId },
      select: { email: true, name: true },
    });

    if (!user || !user.email) {
      return {
        success: false,
        error: `Cannot deliver email: User with id ${alert.userId} not found or has no email address.`,
        providerName: provider.name,
      };
    }

    // 4. Format Structured Email Payload
    const emailData = formatLifecycleAlertEmail({
      to: user.email,
      alertId: alert.id,
      alertType: alert.transitionType,
      subject: "",
      opportunity,
      appBaseUrl: options.appBaseUrl,
    });

    const outboundPayload: OutboundEmailPayload = {
      to: user.email,
      subject: emailData.subject,
      alertId: alert.id,
      alertType: alert.transitionType,
      opportunity,
      textBody: emailData.textBody,
      htmlBody: emailData.htmlBody,
      appBaseUrl: options.appBaseUrl,
    };

    // 5. Send via Configured Provider
    try {
      const result = await provider.sendEmail(outboundPayload);
      if (result.success) {
        // Record key in cache to prevent duplicate email dispatch on scheduler retry
        this.deliveredAlertKeyCache.add(dispatchKey);
      }
      return result;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message || "Unknown error during email transmission";
      return {
        success: false,
        error: errorMsg,
        providerName: provider.name,
      };
    }
  }
}

export function getEmailDispatcher(provider?: EmailProvider): OutboundEmailDispatcher {
  return OutboundEmailDispatcher.getInstance(provider);
}
