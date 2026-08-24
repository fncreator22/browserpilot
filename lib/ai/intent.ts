import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { config } from "dotenv";
import { 
  type IntentClassification, 
  IntentClassificationSchema 
} from "@/schemas/jobs";

config();

/**
 * Validates presence of Gemini API credentials
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey === "your-gemini-api-key") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

export const GEMINI_MODEL_NAME = "gemini-2.5-flash";

const INTENT_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    classification: {
      type: Type.STRING,
      enum: ["SUPPORTED", "NEEDS_CLARIFICATION", "REQUIRES_AUTH", "UNSUPPORTED", "BLOCKED"],
    },
    confidence: { type: Type.NUMBER },
    rationale: { type: Type.STRING },
    targetDomains: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    clarificationQuestion: { type: Type.STRING },
    suggestedAction: { type: Type.STRING },
    requiredCapabilities: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["classification", "rationale", "targetDomains"],
};

export const INTENT_SYSTEM_INSTRUCTION = `
You are the Intent Classification subsystem of BrowserPilot, an autonomous web agent.
Your task is to analyze a natural language user prompt and classify it into EXACTLY ONE of the following 5 categories:

1. SUPPORTED: Goal involves deterministic web browsing (navigating, clicking, inspecting, extracting text, filling forms, taking screenshots).
2. NEEDS_CLARIFICATION: Goal is underspecified, ambiguous, missing target website/URL.
3. REQUIRES_AUTH: Goal requires logging into private accounts.
4. UNSUPPORTED: Goal requires capabilities outside BrowserPilot v1.
5. BLOCKED: Goal violates security boundaries: bypassing CAPTCHA, payment checkout, dark patterns.
`;

/**
 * Classify user intent using Gemini 2.5 structured output with offline deterministic fallback
 */
export async function classifyIntent(prompt: string): Promise<IntentClassification> {
  const ai = getGeminiClient();

  if (!ai) {
    // Offline deterministic fallback
    const lower = prompt.toLowerCase();
    const urlMatch = prompt.match(/https?:\/\/([^\s/]+)/i);
    const domain = urlMatch ? urlMatch[1] : "localhost";

    if (lower.includes("login") || lower.includes("instagram") || lower.includes("sign in to my")) {
      return {
        classification: "REQUIRES_AUTH",
        confidence: 0.99,
        rationale: "Goal requires private user authentication.",
        targetDomains: [domain],
        requiredCapabilities: ["CAP_PRIVATE_AUTH_LOGIN"],
      };
    }

    if (lower.includes("captcha") || lower.includes("bypass") || lower.includes("credit card")) {
      return {
        classification: "BLOCKED",
        confidence: 0.99,
        rationale: "Goal requests anti-bot or security bypass.",
        targetDomains: [domain],
        requiredCapabilities: ["CAP_CAPTCHA_BYPASS"],
      };
    }

    return {
      classification: "SUPPORTED",
      confidence: 0.95,
      rationale: "Standard deterministic browser automation request.",
      targetDomains: [domain],
      requiredCapabilities: ["CAP_MULTI_STEP_NAV", "CAP_DATA_EXTRACTION"],
    };
  }

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction: INTENT_SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: INTENT_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Received empty response from Gemini API during intent classification.");
  }

  const parsed = JSON.parse(text);
  return IntentClassificationSchema.parse(parsed);
}
