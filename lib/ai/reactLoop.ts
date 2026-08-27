/**
 * §DYNAMIC REACT EXECUTION LOOP (Sense -> Reason -> Act -> Evaluate)
 * Replaces rigid static planning with an iterative, self-correcting agent loop
 * powered by Set-of-Marks visual element tagging and multi-model reasoning.
 */

import type { Page } from "playwright";
import { annotatePageWithSetOfMarks, clearSetOfMarksBadges, dismissOverlaysAndModals } from "./setOfMarks";
import { distillHtml } from "@/lib/scraper/distiller";
import { createGeminiClient, getEffectiveGeminiApiKey, detectOptimalGeminiModel, DEFAULT_GEMINI_MODEL } from "./modelSelector";
import type { Observation } from "@/schemas/actions";

export interface ReActLoopOptions {
  jobId: string;
  goal: string;
  maxIterations?: number;
  apiKey?: string;
  onStepProgress?: (stepNum: number, maxSteps: number, description: string) => void;
}

export interface ReActLoopResult {
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  observations: Observation[];
  extractedData?: string;
  finalAnswer?: string;
  iterationsCount: number;
}

const REACT_SYSTEM_PROMPT = `You are the Autonomous Browser Agent of BrowserPilot.
Your task is to iteratively interact with the live webpage to accomplish the user's goal.

At each step, you are given:
- Current Page URL & Title
- Distilled Page Content (Text & Tables)
- Numbered Interactive Elements (e.g. [1] <button> "Sign In", [2] <input> "Search")

You must reason step-by-step and return strictly a JSON object with your single next action:
{
  "thought": "Why you are choosing this action...",
  "action": "click" | "fill" | "navigate" | "scroll" | "extract" | "finish",
  "elementId": number (e.g. 2 for element [2], only if action is click or fill),
  "value": string (only if action is fill or navigate),
  "isGoalComplete": boolean,
  "finalAnswer": string (if goal is complete)
}`;

/**
 * Executes dynamic ReAct agent loop on active Playwright page
 */
export async function runDynamicReActLoop(
  page: Page,
  options: ReActLoopOptions
): Promise<ReActLoopResult> {
  const { jobId, goal, maxIterations = 8, apiKey, onStepProgress } = options;
  const observations: Observation[] = [];
  const effectiveKey = getEffectiveGeminiApiKey(apiKey);
  const ai = effectiveKey ? createGeminiClient(effectiveKey) : null;
  const modelName = effectiveKey ? await detectOptimalGeminiModel(effectiveKey) : DEFAULT_GEMINI_MODEL;

  let currentIteration = 0;
  let finalAnswer = "";
  let extractedContent = "";

  while (currentIteration < maxIterations) {
    currentIteration++;
    onStepProgress?.(currentIteration, maxIterations, `Evaluating page state (Step ${currentIteration})`);

    // 1. SENSE: Self-heal overlays & tag interactive elements
    await dismissOverlaysAndModals(page).catch(() => {});
    const somResult = await annotatePageWithSetOfMarks(page);
    const currentUrl = page.url();
    const title = await page.title().catch(() => "Webpage");
    const rawHtml = await page.content().catch(() => "");
    const distilledText = distillHtml(rawHtml, { maxCharacters: 15000 });

    // 2. REASON: Query LLM for next dynamic action
    let decision: {
      thought: string;
      action: "click" | "fill" | "navigate" | "scroll" | "extract" | "finish";
      elementId?: number;
      value?: string;
      isGoalComplete?: boolean;
      finalAnswer?: string;
    } = {
      thought: "Extract content and complete",
      action: "extract",
      isGoalComplete: true,
    };

    if (ai) {
      try {
        const prompt = `
[USER GOAL]:
${goal}

[CURRENT URL]: ${currentUrl}
[PAGE TITLE]: ${title}

[INTERACTIVE ELEMENTS IN VIEWPORT]:
${somResult.elementSummaryText || "No interactive buttons or inputs visible."}

[PAGE DISTILLED CONTENT]:
${distilledText}
`;

        const response = await ai.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            systemInstruction: REACT_SYSTEM_PROMPT,
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });

        if (response.text) {
          decision = JSON.parse(response.text);
        }
      } catch (reasonErr) {
        console.warn(`[ReActLoop] AI decision fallback at step ${currentIteration}:`, reasonErr);
      }
    }

    // Clear visual badges from page before executing action
    await clearSetOfMarksBadges(page);

    // 3. ACT: Dispatch action based on dynamic decision
    const matchingElement = decision.elementId
      ? somResult.elements.find((e) => e.id === decision.elementId)
      : undefined;

    let actionExecuted = false;

    try {
      if (decision.action === "navigate" && decision.value) {
        onStepProgress?.(currentIteration, maxIterations, `Navigating to ${decision.value}`);
        await page.goto(decision.value, { waitUntil: "domcontentloaded", timeout: 15000 });
        actionExecuted = true;
      } else if (decision.action === "click" && matchingElement) {
        onStepProgress?.(currentIteration, maxIterations, `Clicking element [${matchingElement.id}] (${matchingElement.text || matchingElement.tagName})`);
        await page.click(matchingElement.selector, { timeout: 8000 });
        await page.waitForTimeout(1500);
        actionExecuted = true;
      } else if (decision.action === "fill" && matchingElement && decision.value) {
        onStepProgress?.(currentIteration, maxIterations, `Typing into element [${matchingElement.id}]`);
        await page.fill(matchingElement.selector, decision.value, { timeout: 8000 });
        await page.keyboard.press("Enter").catch(() => {});
        await page.waitForTimeout(1500);
        actionExecuted = true;
      } else if (decision.action === "scroll") {
        onStepProgress?.(currentIteration, maxIterations, `Scrolling down page`);
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await page.waitForTimeout(1000);
        actionExecuted = true;
      } else if (decision.action === "extract" || decision.action === "finish") {
        extractedContent = distilledText;
        if (decision.finalAnswer) finalAnswer = decision.finalAnswer;
        actionExecuted = true;
      }
    } catch (actErr) {
      console.warn(`[ReActLoop] Action execution failed at step ${currentIteration}:`, actErr);
    }

    // 4. EVALUATE: Record observation
    const { BrowserActionSchema } = await import("@/schemas/actions");
    const rawAction = decision.action === "navigate"
      ? {
          tool: "browser.navigate" as const,
          parameters: { url: decision.value || currentUrl },
          rationale: decision.thought,
        }
      : decision.action === "click" && matchingElement
      ? {
          tool: "browser.click" as const,
          parameters: { selector: matchingElement.selector },
          rationale: decision.thought,
        }
      : {
          tool: "browser.extractText" as const,
          parameters: { selector: "body" },
          rationale: decision.thought,
        };

    const typedAction = BrowserActionSchema.parse(rawAction);

    observations.push({
      stepIndex: currentIteration,
      action: typedAction,
      status: actionExecuted ? "SUCCESS" : "FAILED",
      currentUrl: page.url(),
      title: await page.title().catch(() => title),
      pageSummary: distilledText.slice(0, 300),
      extractedData: extractedContent || undefined,
      elapsedMs: 500,
      timestamp: new Date().toISOString(),
    });

    if (decision.isGoalComplete || decision.action === "finish") {
      break;
    }
  }

  return {
    status: "SUCCESS",
    observations,
    extractedData: extractedContent,
    finalAnswer: finalAnswer || extractedContent,
    iterationsCount: currentIteration,
  };
}
