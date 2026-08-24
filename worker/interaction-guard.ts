import { type Page, type Locator } from "playwright";

export type PageInteractionState =
  | "NORMAL"
  | "DISMISSIBLE_OVERLAY"
  | "REQUIRED_INPUT"
  | "AUTHENTICATION_REQUIRED"
  | "VERIFICATION_REQUIRED"
  | "UNKNOWN_BLOCKER";

export interface InteractionInspectionResult {
  state: PageInteractionState;
  reason: string;
  userMessage?: string;
  dismissSelector?: string;
  detectedElements: string[];
}

/**
 * EXACT DETECTION SELECTORS & HEURISTICS
 */

// 1. Anti-Bot / CAPTCHA / Verification challenge selectors
const VERIFICATION_SELECTORS = [
  "iframe[src*='challenges.cloudflare.com']",
  "iframe[src*='recaptcha']",
  "iframe[src*='hcaptcha']",
  "iframe[src*='turnstile']",
  "#challenge-running",
  ".cf-browser-verification",
  ".cf-turnstile",
  "div[data-sitekey]",
  "#recaptcha",
  "div.g-recaptcha",
  "div.h-captcha",
];

const VERIFICATION_TEXT_PATTERNS = [
  "verify you are human",
  "attention required! | cloudflare",
  "checking your browser",
  "please complete the security check",
  "confirm you are not a robot",
];

// 2. Authentication Wall selectors
const AUTH_SELECTORS = [
  "input[type='password']:visible",
  "form[action*='login']:visible",
  "form[action*='signin']:visible",
  "#login-form:visible",
  ".login-container:visible",
];

// 3. Modal / Overlay containers
const OVERLAY_CONTAINER_SELECTORS = [
  "[role='dialog']:visible",
  "[role='alertdialog']:visible",
  "[aria-modal='true']:visible",
  ".modal:visible",
  ".modal-overlay:visible",
  ".popup-overlay:visible",
  ".newsletter-modal:visible",
  "#promo-modal:visible",
  "#cookie-consent:visible",
  ".cookie-banner:visible",
  "#onetrust-banner-sdk:visible",
];

// 4. Heuristics for Dismissible Close Controls (in order of priority)
export const DISMISS_CONTROL_SELECTORS = [
  // A. Explicit accessible aria labels
  "button[aria-label*='close' i]:visible",
  "button[aria-label*='dismiss' i]:visible",
  "button[aria-label*='cancel' i]:visible",
  "[aria-label='Close' i]:visible",
  "[aria-label='Dismiss' i]:visible",

  // B. Standard button IDs / class names
  "button#close-modal-btn:visible",
  "button.close:visible",
  "button.modal-close:visible",
  "button.btn-close:visible",
  ".close-button:visible",
  "#dismiss-btn:visible",

  // C. Standard text labels for dismiss / opt-out
  "button:has-text('Dismiss'):visible",
  "button:has-text('Close'):visible",
  "button:has-text('No thanks'):visible",
  "button:has-text('No Thanks'):visible",
  "button:has-text('Not now'):visible",
  "button:has-text('Not Now'):visible",
  "button:has-text('Maybe later'):visible",
  "button:has-text('Skip'):visible",
  "button:has-text('Decline'):visible",
  "button:has-text('Got it'):visible",

  // D. Cookie consent accept / agree buttons
  "button:has-text('Accept all'):visible",
  "button:has-text('Accept Cookies'):visible",
  "button:has-text('Accept all cookies'):visible",
  "button:has-text('I agree'):visible",
  "button:has-text('Agree'):visible",
  "#onetrust-accept-btn-handler:visible",

  // E. Symbol close buttons (X glyphs)
  "button:has-text('✕'):visible",
  "button:has-text('×'):visible",
  "button:has-text('X'):visible",
];

export class InteractionGuard {
  /**
   * Inspect active page state and classify interaction readiness
   */
  static async inspect(page: Page): Promise<InteractionInspectionResult> {
    try {
      // 1. Check for Verification / CAPTCHA challenge (Highest Priority)
      for (const selector of VERIFICATION_SELECTORS) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          return {
            state: "VERIFICATION_REQUIRED",
            reason: `Anti-bot verification element detected via selector: "${selector}"`,
            userMessage:
              "The website is asking for a verification step that I can't complete automatically. I stopped safely here.",
            detectedElements: [selector],
          };
        }
      }

      // Check text-based verification signals
      const pageTitle = (await page.title().catch(() => "")).toLowerCase();
      for (const text of VERIFICATION_TEXT_PATTERNS) {
        if (pageTitle.includes(text)) {
          return {
            state: "VERIFICATION_REQUIRED",
            reason: `Anti-bot verification challenge detected in page title: "${pageTitle}"`,
            userMessage:
              "The website is asking for a verification step that I can't complete automatically. I stopped safely here.",
            detectedElements: [`title:${text}`],
          };
        }
      }

      // 2. Check for Authentication Wall
      for (const selector of AUTH_SELECTORS) {
        const el = page.locator(selector).first();
        if (await el.isVisible().catch(() => false)) {
          return {
            state: "AUTHENTICATION_REQUIRED",
            reason: `Authentication login form detected via selector: "${selector}"`,
            userMessage: "This page requires user login credentials or session authentication.",
            detectedElements: [selector],
          };
        }
      }

      // 3. Check for Active Modals / Overlays
      for (const containerSel of OVERLAY_CONTAINER_SELECTORS) {
        const container = page.locator(containerSel).first();
        if (await container.isVisible().catch(() => false)) {
          // Look for dismiss button within or near the overlay
          const dismissControl = await this.findDismissControl(page, container);
          if (dismissControl) {
            return {
              state: "DISMISSIBLE_OVERLAY",
              reason: `Overlay detected ("${containerSel}") with available dismiss control ("${dismissControl}")`,
              dismissSelector: dismissControl,
              detectedElements: [containerSel, dismissControl],
            };
          } else {
            // Overlay has no recognizable dismiss control -> UNKNOWN_BLOCKER (never NORMAL)
            return {
              state: "UNKNOWN_BLOCKER",
              reason: `Blocking overlay detected ("${containerSel}") without recognizable dismiss control.`,
              userMessage: "A blocking overlay or modal is present that could not be safely dismissed.",
              detectedElements: [containerSel],
            };
          }
        }
      }

      // 4. Standard Interactive State
      return {
        state: "NORMAL",
        reason: "Page is in normal interactive state with no blocking overlays or challenges.",
        detectedElements: [],
      };
    } catch (err: unknown) {
      // In case of error during inspection, err on the side of safety
      return {
        state: "UNKNOWN_BLOCKER",
        reason: `Interaction inspection error: ${(err as Error).message}`,
        userMessage: "An error occurred while inspecting page interaction state.",
        detectedElements: [],
      };
    }
  }

  /**
   * Attempt safe dismissal of detected overlay
   */
  static async attemptDismissOverlay(
    page: Page,
    dismissSelector?: string
  ): Promise<{ dismissed: boolean; selectorUsed?: string; error?: string }> {
    const candidateSelectors = dismissSelector
      ? [dismissSelector, ...DISMISS_CONTROL_SELECTORS]
      : DISMISS_CONTROL_SELECTORS;

    for (const selector of candidateSelectors) {
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible().catch(() => false)) {
          console.log(`[InteractionGuard] Attempting dismissal via: "${selector}"`);
          await locator.click({ timeout: 3000 });
          await page.waitForTimeout(400); // Allow modal animation to finish

          // Re-inspect to verify overlay disappeared
          const afterState = await this.inspect(page);
          if (afterState.state === "NORMAL") {
            console.log(`[InteractionGuard] ✓ Overlay dismissed successfully.`);
            return { dismissed: true, selectorUsed: selector };
          }
        }
      } catch {
        // Continue to next candidate dismiss selector
      }
    }

    return {
      dismissed: false,
      error: "Unable to dismiss overlay with available close controls.",
    };
  }

  /**
   * Helper to locate dismiss control inside or near container
   */
  private static async findDismissControl(
    page: Page,
    container: Locator
  ): Promise<string | undefined> {
    for (const selector of DISMISS_CONTROL_SELECTORS) {
      try {
        // Check inside container first
        const inside = container.locator(selector).first();
        if (await inside.isVisible().catch(() => false)) {
          return selector;
        }

        // Check global page
        const globalEl = page.locator(selector).first();
        if (await globalEl.isVisible().catch(() => false)) {
          return selector;
        }
      } catch {
        // continue search
      }
    }
    return undefined;
  }
}
