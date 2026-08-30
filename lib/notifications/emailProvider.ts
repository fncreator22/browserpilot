/**
 * §OUTBOUND EMAIL PROVIDER INTERFACE & BUILT-IN ADAPTERS (TASK-020)
 * Provides pluggable email delivery capabilities for LifecycleAlerts with zero credential leakage.
 */

export interface OutboundEmailPayload {
  to: string;
  subject: string;
  alertId: string;
  alertType: "NEW_OPPORTUNITY" | "NEW_SOURCE" | "REPOSTED" | string;
  opportunity: {
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
  };
  textBody?: string;
  htmlBody?: string;
  appBaseUrl?: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
  providerName: string;
}

export interface EmailProvider {
  name: string;
  sendEmail(payload: OutboundEmailPayload): Promise<EmailDeliveryResult>;
}

/**
 * In-memory Mock Email Provider for testing and validation.
 */
export class MockEmailProvider implements EmailProvider {
  public name = "MockEmailProvider";
  public sentEmails: OutboundEmailPayload[] = [];
  public shouldFail = false;
  public failureErrorMessage = "Simulated SMTP connection timeout";

  async sendEmail(payload: OutboundEmailPayload): Promise<EmailDeliveryResult> {
    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureErrorMessage,
        providerName: this.name,
      };
    }

    this.sentEmails.push({ ...payload });
    return {
      success: true,
      messageId: `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deliveredAt: new Date(),
      providerName: this.name,
    };
  }

  clear(): void {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

/**
 * Standard Console Logger Provider for local development.
 * Never logs credentials, passwords, or API keys.
 */
export class ConsoleEmailProvider implements EmailProvider {
  public name = "ConsoleEmailProvider";

  async sendEmail(payload: OutboundEmailPayload): Promise<EmailDeliveryResult> {
    const sanitizedEmail = payload.to.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
      return `${first}${"*".repeat(Math.max(middle.length, 2))}${domain}`;
    });

    console.log(`[OutboundEmail] [${payload.alertType}] To: ${sanitizedEmail} | Subject: "${payload.subject}" | Opp: ${payload.opportunity.title} at ${payload.opportunity.companyName}`);

    return {
      success: true,
      messageId: `console_${Date.now()}`,
      deliveredAt: new Date(),
      providerName: this.name,
    };
  }
}
