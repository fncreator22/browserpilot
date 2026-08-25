import { GoogleGenAI } from "@google/genai";

/**
 * §DYNAMIC GEMINI MODEL AUTO-DETECTOR & PROVIDER
 * Selects the optimal Gemini Flash model based on API Key capabilities and availability
 */
export const SUPPORTED_GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export type SupportedGeminiModel = (typeof SUPPORTED_GEMINI_MODELS)[number];

export const DEFAULT_GEMINI_MODEL: SupportedGeminiModel = "gemini-2.5-flash";

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
 * Auto-detect optimal available model for the given Gemini API key
 */
export async function detectOptimalGeminiModel(
  apiKey?: string | null
): Promise<SupportedGeminiModel> {
  const effectiveKey = getEffectiveGeminiApiKey(apiKey);
  if (!effectiveKey) return DEFAULT_GEMINI_MODEL;

  try {
    const ai = createGeminiClient(effectiveKey);
    // Quick probe on primary model
    const testRes = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: "ping",
    });
    if (testRes) return DEFAULT_GEMINI_MODEL;
  } catch (err: unknown) {
    const msg = (err as Error).message || "";
    // If 2.5 is not accessible, fall back to 2.0-flash or 1.5-flash
    if (msg.includes("not found") || msg.includes("unsupported") || msg.includes("404")) {
      return "gemini-2.0-flash";
    }
  }

  return DEFAULT_GEMINI_MODEL;
}
