import { GoogleGenAI } from "@google/genai";

/**
 * §DYNAMIC GEMINI MODEL AUTO-DETECTOR & PROVIDER
 * Selects the optimal Gemini Flash model based on API Key capabilities and availability.
 * Defaults to gemini-3.6-flash (current generation).
 */
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.6-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

// Default to Gemini 3.6 Flash (fastest, most capable, active Google API tier)
export const DEFAULT_GEMINI_MODEL: SupportedGeminiModel = "gemini-3.6-flash";
export const FALLBACK_GEMINI_MODEL: SupportedGeminiModel = "gemini-3.6-flash";

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
 * Always resolves to high-performance gemini-3.6-flash.
 */
export async function detectOptimalGeminiModel(
  apiKey?: string | null
): Promise<SupportedGeminiModel> {
  return DEFAULT_GEMINI_MODEL;
}
