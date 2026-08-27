import { type Page } from "playwright";
import { 
  type BrowserAction, 
  type BrowserActionInput,
  type Observation, 
  ObservationSchema,
  BrowserActionSchema 
} from "@/schemas/actions";
import { artifactStorage } from "@/lib/storage";
import { InteractionGuard, type InteractionInspectionResult } from "./interaction-guard";
import { mapInternalErrorToHuman } from "@/lib/verification/errorMapper";

export interface ExecutorOptions {
  jobId: string;
  stepIndex?: number;
  captureScreenshot?: boolean;
}

export class BrowserExecutor {
  /**
   * Execute any of the 8 validated browser actions against an active Playwright page
   * with Runtime Interaction Guard protection
   */
  static async execute(
    page: Page,
    action: BrowserAction | BrowserActionInput,
    options: ExecutorOptions
  ): Promise<Observation> {
    const startTime = Date.now();
    const stepIndex = options.stepIndex ?? 0;
    const validatedAction = BrowserActionSchema.parse(action);

    let status: "SUCCESS" | "FAILED" | "BLOCKED" = "SUCCESS";
    let pageSummary: string | undefined;
    let extractedData: string | string[] | Record<string, unknown> | undefined;
    let screenshotPath: string | null = null;
    let screenshotStorageKey: string | null = null; // raw backend key (Blob URL / FS path)
    let errorPayload: Observation["error"] = null;

    try {
      // 1. RUNTIME INTERACTION GUARD PRE-STEP CHECK (§12 / skills/security.md)
      // Only check guard if not currently navigating or already on blank
      if (validatedAction.tool !== "browser.navigate" && page.url() && page.url() !== "about:blank") {
        const guardResult: InteractionInspectionResult = await InteractionGuard.inspect(page);

        // A. Hard Stop on Verification / CAPTCHA (Zero bypass attempt rule)
        if (guardResult.state === "VERIFICATION_REQUIRED") {
          status = "BLOCKED";
          errorPayload = {
            code: "BLOCKED_VERIFICATION_REQUIRED",
            message: guardResult.reason,
            userMessage:
              "The website is asking for a verification step that I can't complete automatically. I stopped safely here.",
            suggestion: "Complete verification manually or execute on non-gated pages.",
          };
        } else if (guardResult.state === "AUTHENTICATION_REQUIRED") {
          status = "BLOCKED";
          errorPayload = {
            code: "BLOCKED_AUTHENTICATION_REQUIRED",
            message: guardResult.reason,
            userMessage: "This page requires user login credentials or session authentication.",
            suggestion: "Authenticate your session or use public/test credentials.",
          };
        } else if (guardResult.state === "DISMISSIBLE_OVERLAY") {
          // B. Attempt safe dismissal of non-blocking overlay/modal
          console.log(`[Executor] Dismissible overlay detected before Step ${stepIndex}. Attempting safe dismissal...`);
          const dismissResult = await InteractionGuard.attemptDismissOverlay(page, guardResult.dismissSelector);
          if (!dismissResult.dismissed) {
            status = "BLOCKED";
            errorPayload = {
              code: "BLOCKED_INTERACTION_REQUIRED",
              message: "An overlay/modal blocked the interaction target and could not be dismissed.",
              userMessage: "A modal overlay is obscuring the page and could not be safely dismissed.",
              suggestion: "Inspect target page or dismiss modal in interactive session.",
            };
          }
        } else if (guardResult.state === "UNKNOWN_BLOCKER") {
          status = "BLOCKED";
          errorPayload = {
            code: "BLOCKED_UNKNOWN_STATE",
            message: guardResult.reason,
            userMessage: guardResult.userMessage || "An unknown blocking overlay is preventing interaction.",
            suggestion: "Check page structure for unexpected popups or redirects.",
          };
        }
      }

      // If pre-step guard halted, do not execute the action tool
      if (status !== "BLOCKED") {
        // 2. Dispatch the specific tool
        switch (validatedAction.tool) {
          case "browser.navigate": {
            const { url, waitUntil, timeout } = validatedAction.parameters;
            await page.goto(url, { waitUntil, timeout });
            const title = await page.title();
            pageSummary = `Navigated to ${url}. Page title: "${title}".`;

            // Post-navigation Interaction Guard check
            const postNavGuard = await InteractionGuard.inspect(page);
            if (postNavGuard.state === "VERIFICATION_REQUIRED") {
              status = "BLOCKED";
              errorPayload = {
                code: "BLOCKED_VERIFICATION_REQUIRED",
                message: postNavGuard.reason,
                userMessage:
                  "The website is asking for a verification step that I can't complete automatically. I stopped safely here.",
                suggestion: "Complete verification manually or execute on non-gated pages.",
              };
            } else if (postNavGuard.state === "DISMISSIBLE_OVERLAY") {
              console.log(`[Executor] Post-navigation overlay detected. Attempting safe dismissal...`);
              await InteractionGuard.attemptDismissOverlay(page, postNavGuard.dismissSelector);
            }
            break;
          }

          case "browser.inspect": {
            const { selector, maxElements } = validatedAction.parameters;
            const target = selector || "body";
            const locator = page.locator(target);
            const count = await locator.count();

            if (count === 0) {
              pageSummary = `No elements matching selector "${target}" found.`;
              extractedData = [];
            } else {
              const elementsSummary: string[] = [];
              const limit = Math.min(count, maxElements);
              for (let i = 0; i < limit; i++) {
                const el = locator.nth(i);
                const tagName = await el.evaluate((node) => node.tagName.toLowerCase()).catch(() => "unknown");
                const text = (await el.innerText().catch(() => "")).trim().slice(0, 80);
                const isVisible = await el.isVisible().catch(() => false);
                elementsSummary.push(`[${tagName}] visible=${isVisible} text="${text}"`);
              }
              pageSummary = `Inspected "${target}". Found ${count} matching element(s) (showing first ${limit}).`;
              extractedData = elementsSummary;
            }
            break;
          }

          case "browser.click": {
            const { selector, button, clickCount, timeout } = validatedAction.parameters;
            const locator = page.locator(selector).first();
            await locator.waitFor({ state: "visible", timeout });
            await locator.click({ button, clickCount, timeout });
            pageSummary = `Clicked element matching selector "${selector}" with ${button} button.`;
            break;
          }

          case "browser.fill": {
            const { selector, value, clearExisting, timeout } = validatedAction.parameters;
            const locator = page.locator(selector).first();
            await locator.waitFor({ state: "visible", timeout });
            if (clearExisting) {
              await locator.fill("");
            }
            await locator.fill(value, { timeout });
            pageSummary = `Filled element "${selector}" with value length ${value.length}.`;
            break;
          }

          case "browser.press": {
            const { key, selector, delayMs } = validatedAction.parameters;
            if (selector) {
              const locator = page.locator(selector).first();
              await locator.press(key, { delay: delayMs });
            } else {
              await page.keyboard.press(key, { delay: delayMs });
            }
            pageSummary = `Dispatched keyboard key press: "${key}".`;
            break;
          }

          case "browser.extractText": {
            const { selector, extractMultiple, maxChars } = validatedAction.parameters;
            const target = selector || "body";
            const locator = page.locator(target);
            const count = await locator.count();

            if (count === 0) {
              pageSummary = `Selector "${target}" not found on page.`;
              extractedData = "";
            } else if (extractMultiple) {
              const allTexts = await locator.allInnerTexts();
              extractedData = allTexts.map((t) => t.trim().slice(0, maxChars));
              pageSummary = `Extracted text from ${allTexts.length} elements matching "${target}".`;
            } else {
              const text = await locator.first().innerText();
              const trimmed = text.trim().slice(0, maxChars);
              extractedData = trimmed;
              pageSummary = `Extracted ${trimmed.length} characters from "${target}".`;
            }
            break;
          }

          case "browser.screenshot": {
            const { fullPage, filename, saveArtifact = true } = validatedAction.parameters;
            const artifactName = filename || `step_${stepIndex}_${Date.now()}.png`;
            const imageBuffer = await page.screenshot({ fullPage, type: "png" });
            if (saveArtifact) {
              // rawStorageKey = Blob URL (in production) or local FS path (in dev)
              const rawStorageKey = await artifactStorage.saveArtifact(options.jobId, artifactName, imageBuffer);
              screenshotStorageKey = rawStorageKey;
              // screenshotPath = proxy URL for UI (works with both storage backends)
              screenshotPath = artifactStorage.getArtifactUrl(options.jobId, artifactName);
            }
            pageSummary = `Captured ${fullPage ? "full-page" : "viewport"} screenshot saved as ${artifactName}.`;
            break;
          }

          case "browser.getState": {
            const currentUrl = page.url();
            const title = await page.title();
            const interactiveCount = await page.locator("button, a, input, select, textarea").count();
            const viewport = page.viewportSize();

            extractedData = {
              url: currentUrl,
              title,
              interactiveElementsCount: interactiveCount,
              viewport,
            };
            pageSummary = `Active page: "${title}" (${currentUrl}) with ${interactiveCount} interactive elements.`;
            break;
          }
        }
      }
    } catch (err: unknown) {
      status = "FAILED";
      const errorMsg = (err as Error).message || String(err);
      const mapped = mapInternalErrorToHuman(errorMsg);

      errorPayload = {
        code: mapped.code,
        message: errorMsg,
        userMessage: mapped.userMessage,
        suggestion: mapped.suggestedAction,
      };
    }

    // 3. CAPTURE ARTIFACT ON BLOCKED OR FAILED STATE (§12 / §24)
    if (options.captureScreenshot || status === "BLOCKED" || (status === "FAILED" && !screenshotPath)) {
      try {
        const artifactName = `step_${stepIndex}_${status.toLowerCase()}.png`;
        const imageBuffer = await page.screenshot({ fullPage: false, type: "png" });
        const rawStorageKey = await artifactStorage.saveArtifact(options.jobId, artifactName, imageBuffer);
        screenshotStorageKey = rawStorageKey;
        screenshotPath = artifactStorage.getArtifactUrl(options.jobId, artifactName);
      } catch {
        // Screenshot capture failure should not overwrite original action observation
      }
    }

    const elapsedMs = Date.now() - startTime;
    const currentUrl = page.url() || "about:blank";
    const title = await page.title().catch(() => "Unknown");

    const rawObservation = {
      stepIndex,
      action: validatedAction,
      status,
      currentUrl,
      title,
      pageSummary,
      extractedData,
      screenshotPath,
      screenshotStorageKey,
      error: errorPayload,
      elapsedMs,
      timestamp: new Date().toISOString(),
    };

    return ObservationSchema.parse(rawObservation);
  }
}
