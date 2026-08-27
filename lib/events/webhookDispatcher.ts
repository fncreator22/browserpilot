/**
 * §WEBHOOK DISPATCHER
 * Delivers completed scraping datasets and execution summaries to external endpoints (Zapier, Make, Slack)
 * with HMAC-SHA256 signature headers and exponential backoff retry.
 */

import { createHmac } from "crypto";

export interface WebhookPayload {
  event: "job.completed" | "job.failed";
  jobId: string;
  goal: string;
  status: string;
  summary: string;
  dataset?: Array<Record<string, unknown>> | string;
  totalDurationMs?: number;
  tokensUsed?: number;
  completedAt: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  attempts: number;
}

/**
 * Dispatches a webhook notification with HMAC-SHA256 signature and retry
 */
export async function dispatchWebhook(
  targetUrl: string,
  payload: WebhookPayload,
  secretKey?: string
): Promise<WebhookDeliveryResult> {
  const bodyString = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "BrowserPilot-Webhook/1.0",
    "X-BrowserPilot-Event": payload.event,
    "X-BrowserPilot-Job-ID": payload.jobId,
    "X-BrowserPilot-Timestamp": new Date().toISOString(),
  };

  if (secretKey) {
    const signature = createHmac("sha256", secretKey).update(bodyString).digest("hex");
    headers["X-BrowserPilot-Signature"] = `sha256=${signature}`;
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: bodyString,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        return { success: true, statusCode: response.status, attempts };
      }

      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        // Client errors (400, 401, 404) are non-retryable
        return {
          success: false,
          statusCode: response.status,
          error: `HTTP ${response.status}: ${response.statusText}`,
          attempts,
        };
      }
    } catch (err) {
      if (attempts >= maxAttempts) {
        return {
          success: false,
          error: (err as Error).message,
          attempts,
        };
      }
    }

    // Exponential backoff delay (1s, 2s)
    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempts - 1) * 1000));
  }

  return { success: false, error: "Max delivery attempts exceeded", attempts };
}
