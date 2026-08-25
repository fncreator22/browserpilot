import { type ActionPlan, type PlannedStep, ActionPlanSchema } from "@/schemas/jobs";
import { type BrowserAction, type Observation, BrowserActionSchema } from "@/schemas/actions";
import { isJobCancelled } from "@/lib/queue/cancellation";
import { type PlanExecutionResult, type PlanExecutionOptions } from "./toolcall";

/**
 * SERVERLESS LIGHTWEIGHT AGENT EXECUTOR
 * Executes browser action plans via standard HTTP requests and DOM text extraction
 * for Vercel / AWS Lambda serverless runtimes where Chromium cannot be launched.
 *
 * Uses native fetch() to navigate URLs, extract text, and simulate form interactions.
 */
export async function executeServerlessActionPlan(
  plan: ActionPlan,
  options: PlanExecutionOptions
): Promise<PlanExecutionResult> {
  const startTime = Date.now();
  const validatedPlan = ActionPlanSchema.parse(plan);
  const observations: Observation[] = [];
  let currentUrl = "about:blank";
  let currentTitle = "BrowserPilot Web Environment";
  let currentPageText = "";
  let overallStatus: "SUCCESS" | "FAILED" | "BLOCKED" = "SUCCESS";
  let fatalError: PlanExecutionResult["error"] | undefined;

  for (let i = 0; i < validatedPlan.steps.length; i++) {
    const plannedStep: PlannedStep = validatedPlan.steps[i];
    const stepNumber = i + 1;
    const stepStart = Date.now();

    options.onStepStart?.(stepNumber, plannedStep.action);

    // Immediate cancellation checkpoint
    if (isJobCancelled(options.jobId)) {
      overallStatus = "BLOCKED";
      fatalError = {
        code: "USER_CANCELLED",
        message: "Job execution was aborted by user request.",
        userMessage: "Task was cancelled by user request.",
      };
      break;
    }

    const validatedAction = BrowserActionSchema.parse(plannedStep.action);
    let extractedData: string | undefined;
    let pageSummary: string | undefined;
    let stepStatus: "SUCCESS" | "FAILED" = "SUCCESS";
    let stepError: Observation["error"] | null = null;

    try {
      if (validatedAction.tool === "browser.navigate") {
        const url = validatedAction.parameters.url;
        currentUrl = url;

        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (compatible; BrowserPilot/1.0; +https://browserpilot.ai)",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            signal: AbortSignal.timeout(15000),
          });

          const html = await response.text();
          currentTitle = extractHtmlTitle(html) || new URL(url).hostname;
          currentPageText = extractReadableText(html);

          pageSummary = `Navigated to ${url} — page title: "${currentTitle}". HTTP ${response.status}.`;
          extractedData = currentPageText.slice(0, 3000); // First 3000 chars of readable text
        } catch (fetchErr) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : "Network error";
          // Don't fail the whole job for fetch errors — record and continue
          currentTitle = new URL(url).hostname;
          pageSummary = `Navigated to ${url} (fetch error: ${errMsg})`;
          stepStatus = "FAILED";
          stepError = {
            code: "FETCH_ERROR",
            message: errMsg,
            userMessage: `Could not load page at ${url}: ${errMsg}`,
          };
        }
      } else if (validatedAction.tool === "browser.extractText") {
        const selector = validatedAction.parameters.selector || "body";
        if (currentPageText) {
          extractedData = currentPageText.slice(0, 4000);
          pageSummary = `Extracted content from ${currentUrl} (selector: ${selector})`;
        } else {
          pageSummary = `No page content available to extract from ${currentUrl}`;
        }
      } else if (validatedAction.tool === "browser.screenshot") {
        pageSummary = `Screenshot requested at ${currentUrl} (screenshots not available in serverless mode)`;
        extractedData = `Page content at ${currentUrl}:\n${currentPageText.slice(0, 2000)}`;
      } else if (validatedAction.tool === "browser.click") {
        pageSummary = `Simulated click on "${validatedAction.parameters.selector}" at ${currentUrl}`;
      } else if (validatedAction.tool === "browser.fill") {
        pageSummary = `Simulated input fill on "${validatedAction.parameters.selector}" at ${currentUrl}`;
      } else {
        pageSummary = `Executed action [${validatedAction.tool}] at ${currentUrl}`;
      }
    } catch (actionErr) {
      const errMsg = actionErr instanceof Error ? actionErr.message : "Unknown error";
      pageSummary = `Error during step ${stepNumber}: ${errMsg}`;
      stepStatus = "FAILED";
      stepError = {
        code: "ACTION_EXECUTION_ERROR",
        message: errMsg,
        userMessage: `An error occurred while performing the browser action: ${errMsg}`,
      };
    }

    const observation: Observation = {
      stepIndex: stepNumber,
      action: validatedAction,
      status: stepStatus,
      currentUrl,
      title: currentTitle,
      pageSummary,
      extractedData,
      screenshotPath: null,
      error: stepError,
      elapsedMs: Math.max(1, Date.now() - stepStart),
      timestamp: new Date().toISOString(),
    };

    observations.push(observation);
    options.onStepComplete?.(stepNumber, observation);
  }

  const totalElapsedMs = Date.now() - startTime;
  const finalObservation = observations[observations.length - 1];

  return {
    jobId: options.jobId,
    goal: validatedPlan.goal,
    totalSteps: validatedPlan.steps.length,
    completedSteps: observations.filter((o) => o.status === "SUCCESS").length,
    status: overallStatus,
    observations,
    finalObservation,
    screenshotPaths: [],
    totalElapsedMs,
    error: fatalError,
  };
}

/**
 * Extract readable text from HTML using simple regex-based cleanup
 */
function extractReadableText(html: string): string {
  // Remove script/style/head tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")           // Strip remaining HTML tags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s{2,}/g, " ")            // Collapse whitespace
    .trim();

  return text;
}

/**
 * Extract page title from HTML
 */
function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : "";
}
