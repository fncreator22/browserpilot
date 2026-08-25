import { GoogleGenAI } from "@google/genai";

/**
 * §DYNAMIC GEMINI MODEL AUTO-DETECTOR & PROVIDER
 * Selects the optimal Gemini Flash model based on API Key capabilities and availability.
 * Uses static resolution (no probe API call) to avoid adding latency on every job.
 */
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

// Default to 2.5-flash (most capable), fall back to 2.0-flash if issues arise
export const DEFAULT_GEMINI_MODEL: SupportedGeminiModel = "gemini-2.5-flash";
export const FALLBACK_GEMINI_MODEL: SupportedGeminiModel = "gemini-2.0-flash";

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
 * Returns 2.5-flash if the key looks like a standard Google AI Studio key,
 * else falls back to 2.0-flash (stable, widely supported).
 */
export async function detectOptimalGeminiModel(
  apiKey?: string | null
): Promise<SupportedGeminiModel> {
  const effectiveKey = getEffectiveGeminiApiKey(apiKey);
  if (!effectiveKey) return FALLBACK_GEMINI_MODEL;

  // Standard AI Studio keys (AIzaSy...) support 2.5-flash
  if (effectiveKey.startsWith("AIzaSy") || effectiveKey.startsWith("AIza")) {
    return DEFAULT_GEMINI_MODEL; // gemini-2.5-flash
  }

  // Enterprise/Vertex or other formats — use stable 2.0-flash
  return FALLBACK_GEMINI_MODEL;
}
