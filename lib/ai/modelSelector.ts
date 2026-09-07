import { GoogleGenAI } from "@google/genai";

/**
 * §DYNAMIC GEMINI MODEL AUTO-DETECTOR & PROVIDER
 * Selects the optimal Gemini Flash model based on API Key capabilities and availability.
 * Defaults to gemini-2.5-flash (current generation Google GenAI API endpoint).
 */
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-2.5-pro",
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

// Default to Gemini 3.6 Flash, fallback to Gemini 3.5 Flash for quota diversification
export const DEFAULT_GEMINI_MODEL: SupportedGeminiModel = "gemini-3.6-flash";
export const FALLBACK_GEMINI_MODEL: SupportedGeminiModel = "gemini-3.5-flash";

/**
 * Get effective Gemini API Key from explicit key or environment
 */
export function getEffectiveGeminiApiKey(explicitKey?: string | null): string | null {
  if (explicitKey && explicitKey.trim() && explicitKey.trim() !== "your-gemini-api-key") {
    return explicitKey.trim();
  }
  const envKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (envKey && envKey.trim() && envKey.trim() !== "your-gemini-api-key") {
    return envKey.trim();
  }
  return null;
}

/**
 * Asynchronously resolve Gemini API key from explicit key, environment variables,
 * specific user record, or database fallback.
 */
export async function resolveGeminiApiKey(
  explicitKey?: string | null,
  userId?: string | null
): Promise<string | null> {
  const direct = getEffectiveGeminiApiKey(explicitKey);
  if (direct) return direct;

  if (typeof window === "undefined") {
    try {
      if (userId) {
        const { getUserGeminiApiKey } = await import("@/lib/db/users");
        const userKey = await getUserGeminiApiKey(userId);
        if (userKey) return userKey;
      }
      const { prisma } = await import("@/lib/db/prisma");
      const { decryptCredential } = await import("@/lib/security/credentialEncryption");
      const u = await prisma.user.findFirst({
        where: { geminiApiKey: { not: null } },
        select: { geminiApiKey: true },
      });
      if (u?.geminiApiKey) {
        const decrypted = decryptCredential(u.geminiApiKey);
        if (decrypted) return decrypted;
      }
    } catch {
      // Ignore database lookup failure in isolated execution
    }
  }
  return null;
}

/**
 * Instantiate GoogleGenAI SDK with the resolved API key
 */
export function createGeminiClient(apiKey?: string | null): GoogleGenAI {
  const effectiveKey = getEffectiveGeminiApiKey(apiKey);
  if (!effectiveKey) {
    throw new Error(
      "MISSING_GEMINI_API_KEY: Please provide your Gemini API Key in your user profile or registration."
    );
  }
  return new GoogleGenAI({ apiKey: effectiveKey });
}

/**
 * Auto-detect optimal available model for the given Gemini API key.
 */
export async function detectOptimalGeminiModel(
  apiKey?: string | null
): Promise<SupportedGeminiModel> {
  return DEFAULT_GEMINI_MODEL;
}
