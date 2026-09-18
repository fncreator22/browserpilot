/**
 * Puter AI Client (Task-032 / Autonomous Discovery)
 * 
 * Invokes Puter's server-authoritative driver API (interface: "puter-chat-completion", driver: "ai-chat")
 * using the user's decrypted Puter auth token.
 * Tracks all token usage and latency in PostgreSQL `AIUsageEvent`.
 */

import type { AIOperation } from "./governance/providerGovernance";

async function logPuterUsage(input: {
  userId: string;
  provider: string;
  model: string;
  operation: AIOperation;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  status: "SUCCESS" | "FAILED" | "RATE_LIMITED" | "QUOTA_EXCEEDED";
  errorMessage?: string;
}) {
  if (typeof window === "undefined") {
    try {
      const { recordAIUsageEvent } = await import("./governance/providerGovernance");
      await recordAIUsageEvent(input);
    } catch (err) {
      console.warn("[PuterClient] Failed to persist AIUsageEvent:", err);
    }
  }
}

export interface PuterChatMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

export interface PuterChatOptions {
  token: string;
  messages: PuterChatMessage[];
  model?: string;
  userId?: string;
  operation?: AIOperation;
  timeoutMs?: number;
}

export interface PuterChatResult {
  content: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
}

export async function callPuterChatCompletion(options: PuterChatOptions): Promise<PuterChatResult> {
  const { token, messages, model, userId, operation = "ACTION_PLANNING", timeoutMs = 45000 } = options;

  if (!token) {
    throw new Error("Puter chat completion requires a valid auth token.");
  }

  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const { sanitizeSearchTelemetry } = await import("@/lib/ai/errors/searchFailureModel");
  const sanitizedMessages = sanitizeSearchTelemetry(messages);

  const payload = {
    interface: "puter-chat-completion",
    driver: "ai-chat",
    test_mode: false,
    method: "complete",
    args: {
      messages: sanitizedMessages,
      ...(model ? { model } : {}),
    },
    auth_token: token,
  };

  try {
    const res = await fetch("https://api.puter.com/drivers/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const errorMsg = `Puter AI driver HTTP error ${res.status}: ${errorText || res.statusText}`;

      if (userId) {
        await logPuterUsage({
          userId,
          provider: "PUTER",
          model: model || "ai-chat",
          operation,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          durationMs,
          status: "FAILED",
          errorMessage: errorMsg,
        });
      }

      throw new Error(errorMsg);
    }

    const data = await res.json();
    if (!data.success && data.error) {
      const errorMsg = typeof data.error === "string" ? data.error : data.error.message || JSON.stringify(data.error);

      if (userId) {
        await logPuterUsage({
          userId,
          provider: "PUTER",
          model: model || "ai-chat",
          operation,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          durationMs,
          status: "FAILED",
          errorMessage: errorMsg,
        });
      }

      throw new Error(`Puter AI returned failure: ${errorMsg}`);
    }

    const content = data.result?.message?.content || "";
    const promptTokens = data.result?.usage?.prompt_tokens || 0;
    const completionTokens = data.result?.usage?.completion_tokens || 0;
    const totalTokens = promptTokens + completionTokens;
    const modelUsed = data.metadata?.providerUsed || data.metadata?.service_used || model || "puter-chat";

    if (userId) {
      await logPuterUsage({
        userId,
        provider: "PUTER",
        model: modelUsed,
        operation,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        totalTokens,
        durationMs,
        status: "SUCCESS",
      });
    }

    return {
      content,
      modelUsed,
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    if (userId && !err.message?.includes("Puter AI driver HTTP error")) {
      await logPuterUsage({
        userId,
        provider: "PUTER",
        model: model || "ai-chat",
        operation,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        durationMs,
        status: "FAILED",
        errorMessage: err.message || "Unknown error calling Puter AI",
      });
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
