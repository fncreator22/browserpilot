import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { config } from "dotenv";
import { 
  type ActionPlan, 
  ActionPlanSchema 
} from "@/schemas/jobs";
import { GEMINI_MODEL_NAME, isTestHarnessEnvironment } from "./intent";

config();

const PLANNER_RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    goal: { type: Type.STRING },
    targetDomains: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    rationale: { type: Type.STRING },
    maxStepsBudget: { type: Type.INTEGER },
    estimatedDurationSeconds: { type: Type.NUMBER },
    expectedOutputDescription: { type: Type.STRING },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stepNumber: { type: Type.INTEGER },
          rationale: { type: Type.STRING },
          isOptional: { type: Type.BOOLEAN },
          checkpointScreenshot: { type: Type.BOOLEAN },
          action: {
            type: Type.OBJECT,
            properties: {
              tool: {
                type: Type.STRING,
                enum: [
                  "browser.navigate",
                  "browser.inspect",
                  "browser.click",
                  "browser.fill",
                  "browser.press",
                  "browser.extractText",
                  "browser.screenshot",
                  "browser.getState",
                ],
              },
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING },
                  waitUntil: { type: Type.STRING, enum: ["load", "domcontentloaded", "networkidle", "commit"] },
                  selector: { type: Type.STRING },
                  value: { type: Type.STRING },
                  key: { type: Type.STRING },
                  depth: { type: Type.INTEGER },
                  maxElements: { type: Type.INTEGER },
                  extractMultiple: { type: Type.BOOLEAN },
                  maxChars: { type: Type.INTEGER },
                  fullPage: { type: Type.BOOLEAN },
                  timeout: { type: Type.INTEGER },
                },
              },
            },
            required: ["tool", "parameters"],
          },
        },
        required: ["stepNumber", "action", "rationale"],
      },
    },
  },
  required: ["goal", "targetDomains", "steps"],
};

export const PLANNER_SYSTEM_INSTRUCTION = `
You are the Planner subsystem of BrowserPilot, an autonomous browser agent.
Decompose the user's web automation goal into a strict sequential ActionPlan using ONLY the 8 authorized tools.
`;

import { 
  createGeminiClient, 
  getEffectiveGeminiApiKey, 
  detectOptimalGeminiModel,
  DEFAULT_GEMINI_MODEL 
} from "./modelSelector";

export interface PlanGenerationOptions {
  allowedDomains?: string[];
  maxStepsBudget?: number;
  apiKey?: string;
}

/**
 * Generates an ActionPlan using Gemini structured output with dynamic model selection.
 * Gated: Offline test fallback ONLY activates when NODE_ENV === 'test' or IS_TEST_HARNESS === 'true'.
 */
export async function generateActionPlan(
  prompt: string,
  options: PlanGenerationOptions = {}
): Promise<ActionPlan> {
  const isTest = isTestHarnessEnvironment();
  const effectiveKey = getEffectiveGeminiApiKey(options.apiKey);
  const hasValidKey = !!effectiveKey;

  // In test harness mode or when key is missing in test mode, use deterministic test fallback
  if (isTest || !hasValidKey) {
    if (!isTest && !hasValidKey) {
      const err = new Error("MISSING_GEMINI_API_KEY: Gemini API Key is required for action planning outside test mode.");
      (err as unknown as { code: string }).code = "MISSING_GEMINI_API_KEY";
      throw err;
    }

    // Offline deterministic test fallback (ONLY permitted in test harness mode)
    const urlMatch = prompt.match(/https?:\/\/[^\s,]+/i);
    const targetUrl = urlMatch ? urlMatch[0] : "http://127.0.0.1:3997";
    const domainMatch = targetUrl.match(/https?:\/\/([^\s/:]+)/i);
    const domain = domainMatch ? domainMatch[1] : "localhost";

    return ActionPlanSchema.parse({
      goal: prompt,
      targetDomains: [domain],
      rationale: "Deterministic plan for offline execution.",
      maxStepsBudget: options.maxStepsBudget || 10,
      steps: [
        {
          stepNumber: 1,
          action: {
            tool: "browser.navigate",
            parameters: { url: targetUrl, waitUntil: "domcontentloaded" },
            rationale: "Navigate to target URL",
          },
          rationale: "Navigate to target webpage",
          isOptional: false,
          checkpointScreenshot: false,
        },
        {
          stepNumber: 2,
          action: {
            tool: "browser.extractText",
            parameters: { selector: "#pricing-table" },
            rationale: "Extract target data from pricing table",
          },
          rationale: "Extract pricing content",
          isOptional: false,
          checkpointScreenshot: true,
        },
      ],
    });
  }

  const ai = createGeminiClient(effectiveKey);
  const modelName = await detectOptimalGeminiModel(effectiveKey);

  // Autonomous Target Resolution: If no explicit URL is in prompt, resolve target organically
  let targetContext = "";
  try {
    const { resolveTargetUrl } = await import("@/lib/scraper/searchResolver");
    const resolved = await resolveTargetUrl(prompt);
    if (resolved.url && !prompt.includes("http://") && !prompt.includes("https://")) {
      targetContext = `\nDiscovered Target URL: ${resolved.url} (Domain: ${resolved.domain})`;
    }
  } catch {}

  const response = await ai.models.generateContent({
    model: modelName || DEFAULT_GEMINI_MODEL,
    contents: `User Goal: "${prompt}"${targetContext}\nConstraints: Allowed Domains = ${JSON.stringify(options.allowedDomains || [])}, Max Steps = ${options.maxStepsBudget || 15}`,
    config: {
      systemInstruction: PLANNER_SYSTEM_INSTRUCTION,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: PLANNER_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Received empty response from Gemini API during plan generation.");
  }

  const parsed = JSON.parse(text);
  const validated = ActionPlanSchema.parse(parsed);
  const tokensUsed = response.usageMetadata?.totalTokenCount;
  return Object.assign(validated, { tokensUsed });
}
