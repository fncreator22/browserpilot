/**
 * §PUTER AI PROVIDER ADAPTER
 * Connects Puter.js to BrowserPilot's action planning, intent classification,
 * and structured data extraction pipelines using Claude 3.7, GPT-4o, or DeepSeek R1.
 */

import { ActionPlanSchema, type ActionPlan } from "@/schemas/jobs";
import type { InferredExtractionSchema } from "@/lib/scraper/schemaInferrer";

export interface PuterPlanningOptions {
  model?: string;
  allowedDomains?: string[];
  maxStepsBudget?: number;
}

const PUTER_PLANNER_SYSTEM_PROMPT = `You are the Planner subsystem of BrowserPilot, an autonomous browser agent.
Decompose the user's web automation goal into a strict sequential ActionPlan using ONLY authorized browser tools:
browser.navigate, browser.click, browser.fill, browser.press, browser.extractText, browser.screenshot, browser.inspect, browser.getState.

Output strictly valid JSON matching this schema:
{
  "goal": "...",
  "targetDomains": ["..."],
  "rationale": "...",
  "maxStepsBudget": 15,
  "steps": [
    {
      "stepNumber": 1,
      "rationale": "...",
      "isOptional": false,
      "action": {
        "tool": "browser.navigate",
        "parameters": { "url": "..." }
      }
    }
  ]
}`;

/**
 * Executes action planning on client-side via Puter.js using free user quota
 */
export async function generateActionPlanViaPuter(
  prompt: string,
  options: PuterPlanningOptions = {}
): Promise<ActionPlan> {
  if (typeof window === "undefined" || !window.puter?.ai) {
    throw new Error("Puter.js is not loaded or available in the current environment.");
  }

  const model = options.model || "claude-3-7-sonnet";
  const userMessage = `User Goal: "${prompt}"\nAllowed Domains: ${JSON.stringify(options.allowedDomains || [])}\nMax Steps Budget: ${options.maxStepsBudget || 15}`;

  const response = await window.puter.ai.chat(
    [
      { role: "system", content: PUTER_PLANNER_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    {
      model,
      temperature: 0.1,
    }
  );

  let rawText = "";
  if (typeof response === "string") rawText = response;
  else if (response?.message?.content) rawText = response.message.content;
  else if (response?.text) rawText = response.text;
  else rawText = JSON.stringify(response);

  // Clean Markdown code blocks if LLM wrapped in ```json
  const cleanJson = rawText.replace(/```json|```/gi, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return ActionPlanSchema.parse(parsed);
  } catch (err) {
    console.error("[PuterProvider] Failed to parse ActionPlan from Puter output:", rawText);
    throw new Error(`Puter ActionPlan validation failed: ${(err as Error).message}`);
  }
}

/**
 * Extracts structured table rows from page content via Puter.js
 */
export async function extractStructuredDataViaPuter(
  distilledContent: string,
  schema: InferredExtractionSchema,
  goal: string,
  model = "claude-3-7-sonnet"
): Promise<Array<Record<string, unknown>>> {
  if (typeof window === "undefined" || !window.puter?.ai) {
    throw new Error("Puter.js is not available.");
  }

  const systemInstruction = `You are a precision web data extraction engine.
Extract all instances of ${schema.entityName} matching goal: "${goal}".
Output strictly a JSON object with format: { "items": [ { ...fields } ] }`;

  const response = await window.puter.ai.chat(
    [
      { role: "system", content: systemInstruction },
      { role: "user", content: `Page Content:\n\n${distilledContent}` },
    ],
    {
      model,
      temperature: 0.1,
    }
  );

  let rawText = "";
  if (typeof response === "string") rawText = response;
  else if (response?.message?.content) rawText = response.message.content;
  else if (response?.text) rawText = response.text;
  else rawText = JSON.stringify(response);

  const cleanJson = rawText.replace(/```json|```/gi, "").trim();

  try {
    const parsed = JSON.parse(cleanJson);
    return Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
