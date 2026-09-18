/**
 * §DEEPSEEK AI CLIENT (DeepSeek-V3 / DeepSeek-R1 Harness)
 * 
 * Interacts with DeepSeek's official API (https://api.deepseek.com/v1/chat/completions)
 * with support for:
 * 1. DeepSeek-V3 (deepseek-chat) - Flagship 671B MoE model
 * 2. DeepSeek-R1 (deepseek-reasoner) - Reasoning model with separate thought tokens
 * 3. Puter Cloud AI Driver Fallback (puter-chat-completion with deepseek models)
 * 4. Structured usage telemetry recorded in PostgreSQL AIUsageEvent
 */

import type { AIOperation } from "../governance/providerGovernance";
import { callPuterChatCompletion, type PuterChatMessage } from "../puterClient";

export interface DeepSeekChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekChatOptions {
  messages: DeepSeekChatMessage[];
  apiKey?: string | null;
  puterToken?: string | null;
  model?: "deepseek-chat" | "deepseek-reasoner" | string;
  userId?: string | null;
  operation?: AIOperation;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface DeepSeekChatResult {
  content: string;
  reasoningContent?: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  provider: "DEEPSEEK" | "PUTER";
}

/**
 * Resolves effective DeepSeek API key from explicit param, environment, or DB user record.
 */
export async function resolveDeepSeekApiKey(
  explicitKey?: string | null,
  userId?: string | null
): Promise<string | null> {
  if (explicitKey && explicitKey.trim() && explicitKey.trim().length >= 8) {
    return explicitKey.trim();
  }
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey && envKey.trim() && envKey.trim().length >= 8) {
    return envKey.trim();
  }
  if (typeof window === "undefined" && userId) {
    try {
      const { getUserDeepSeekApiKey } = await import("../governance/providerGovernance");
      const userKey = await getUserDeepSeekApiKey(userId);
      if (userKey) return userKey;
    } catch {
      // Ignore database lookup failure in isolated sandbox execution
    }
  }
  return null;
}

/**
 * Logs AI Usage Event to database for tracking and admin telemetry.
 */
async function logDeepSeekUsage(input: {
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
      const { recordAIUsageEvent } = await import("../governance/providerGovernance");
      await recordAIUsageEvent(input);
    } catch (err) {
      console.warn("[DeepSeekClient] Failed to persist AIUsageEvent:", err);
    }
  }
}

/**
 * Invokes DeepSeek chat completion or delegates to Puter driver when using Puter accounts.
 */
export async function callDeepSeekChatCompletion(
  options: DeepSeekChatOptions
): Promise<DeepSeekChatResult> {
  const {
    messages,
    apiKey,
    puterToken,
    model = "deepseek-chat",
    userId,
    operation = "ACTION_PLANNING",
    temperature = 0.3,
    maxTokens = 4096,
    timeoutMs = 45000,
  } = options;

  const startTime = Date.now();
  const effectiveKey = await resolveDeepSeekApiKey(apiKey, userId);

  // If no direct API key is available but Puter auth token exists, route via Puter driver
  if (!effectiveKey && puterToken) {
    const puterRes = await callPuterChatCompletion({
      token: puterToken,
      messages: messages as PuterChatMessage[],
      model: model === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat",
      userId: userId || undefined,
      operation,
      timeoutMs,
    });

    // Extract reasoning tags if present in Puter response
    let cleanContent = puterRes.content;
    let extractedReasoning: string | undefined;

    const thinkMatch = cleanContent.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      extractedReasoning = thinkMatch[1].trim();
      cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
    }

    return {
      content: cleanContent,
      reasoningContent: extractedReasoning,
      modelUsed: puterRes.modelUsed || model,
      promptTokens: puterRes.promptTokens,
      completionTokens: puterRes.completionTokens,
      totalTokens: puterRes.totalTokens,
      durationMs: puterRes.durationMs,
      provider: "PUTER",
    };
  }

  if (!effectiveKey) {
    throw new Error(
      "MISSING_DEEPSEEK_KEY: Please provide your DeepSeek API Key or connect your Puter account."
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const { sanitizeSearchTelemetry } = await import("@/lib/ai/errors/searchFailureModel");
  const sanitizedMessages = sanitizeSearchTelemetry(messages);

  const payload = {
    model,
    messages: sanitizedMessages,
    temperature: model === "deepseek-reasoner" ? undefined : temperature,
    max_tokens: maxTokens,
  };

  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const durationMs = Date.now() - startTime;

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      const errorMsg = `DeepSeek API HTTP ${res.status}: ${errorText || res.statusText}`;

      if (userId) {
        await logDeepSeekUsage({
          userId,
          provider: "DEEPSEEK",
          model,
          operation,
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          durationMs,
          status: res.status === 429 ? "RATE_LIMITED" : "FAILED",
          errorMessage: errorMsg,
        });
      }

      throw new Error(errorMsg);
    }

    const json = await res.json();
    const choice = json.choices?.[0];
    const rawContent = choice?.message?.content || "";
    let reasoningContent = choice?.message?.reasoning_content || undefined;

    let cleanContent = rawContent;
    if (!reasoningContent) {
      const thinkMatch = rawContent.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        reasoningContent = thinkMatch[1].trim();
        cleanContent = rawContent.replace(/<think>[\s\S]*?<\/think>/i, "").trim();
      }
    }

    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    if (userId) {
      await logDeepSeekUsage({
        userId,
        provider: "DEEPSEEK",
        model,
        operation,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        totalTokens,
        durationMs,
        status: "SUCCESS",
      });
    }

    return {
      content: cleanContent,
      reasoningContent,
      modelUsed: json.model || model,
      promptTokens,
      completionTokens,
      totalTokens,
      durationMs,
      provider: "DEEPSEEK",
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorMsg = (err as Error).message || "DeepSeek completion failed";

    if (userId) {
      await logDeepSeekUsage({
        userId,
        provider: "DEEPSEEK",
        model,
        operation,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        durationMs,
        status: "FAILED",
        errorMessage: errorMsg,
      });
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
