import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { config } from "dotenv";
import { 
  type ActionPlan, 
  ActionPlanSchema 
} from "@/schemas/jobs";
import { getGeminiClient, GEMINI_MODEL_NAME } from "./intent";

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

export interface PlanGenerationOptions {
  allowedDomains?: string[];
  maxStepsBudget?: number;
}

/**
 * Generates an ActionPlan using Gemini 2.5 structured output with offline test fallback
 */
export async function generateActionPlan(
  prompt: string,
  options: PlanGenerationOptions = {}
): Promise<ActionPlan> {
  const ai = getGeminiClient();

  if (!ai) {
    // Offline deterministic test fallback
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

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL_NAME,
    contents: `User Goal: "${prompt}"\nConstraints: Allowed Domains = ${JSON.stringify(options.allowedDomains || [])}, Max Steps = ${options.maxStepsBudget || 15}`,
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
  return ActionPlanSchema.parse(parsed);
}
