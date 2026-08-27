/**
 * §SET-OF-MARKS (SoM) VISUAL ELEMENT TAGGER
 * Injects non-intrusive numbered visual bounding markers [1], [2], [3] directly into the DOM
 * and returns an indexed map of interactive elements for vision and text LLMs.
 */

import type { Page } from "playwright";

export interface InteractiveElement {
  id: number;
  tagName: string;
  type?: string;
  text: string;
  ariaLabel?: string;
  placeholder?: string;
  role?: string;
  selector: string;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SetOfMarksResult {
  elements: InteractiveElement[];
  elementSummaryText: string;
}

/**
 * Injects Set-of-Marks badges into active Playwright page and returns indexed elements
 */
export async function annotatePageWithSetOfMarks(page: Page): Promise<SetOfMarksResult> {
  // Inject marker styles and tagging script into page context
  const rawElements = await page.evaluate(() => {
    // Remove any previous markers
    document.querySelectorAll(".bp-som-badge").forEach((el) => el.remove());

    const interactiveSelectors = [
      "a[href]",
      "button",
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='button']",
      "[role='link']",
      "[role='checkbox']",
      "[role='tab']",
      "[role='menuitem']",
      "[onclick]",
      "[tabindex]:not([tabindex='-1'])",
    ].join(", ");

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(interactiveSelectors));
    const items: Array<{
      id: number;
      tagName: string;
      type?: string;
      text: string;
      ariaLabel?: string;
      placeholder?: string;
      role?: string;
      selector: string;
      bounds: { x: number; y: number; width: number; height: number };
    }> = [];

    let counter = 1;

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);

      // Filter out invisible or offscreen elements
      if (
        rect.width < 4 ||
        rect.height < 4 ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0"
      ) {
        continue;
      }

      // Check if element is in viewport
      if (
        rect.bottom < 0 ||
        rect.right < 0 ||
        rect.top > window.innerHeight ||
        rect.left > window.innerWidth
      ) {
        continue;
      }

      const id = counter++;
      const text = (el.innerText || el.textContent || (el as HTMLInputElement).value || "").trim().slice(0, 60);
      const ariaLabel = el.getAttribute("aria-label") || undefined;
      const placeholder = (el as HTMLInputElement).placeholder || undefined;
      const role = el.getAttribute("role") || undefined;
      const type = (el as HTMLInputElement).type || undefined;

      // Build unique selector
      let selector = "";
      if (el.id) {
        selector = `#${el.id}`;
      } else if (ariaLabel) {
        selector = `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
      } else if (text && text.length > 2 && text.length < 30) {
        selector = `text="${text.replace(/"/g, '\\"')}"`;
      } else {
        selector = el.tagName.toLowerCase();
      }

      // Inject visual marker badge
      const badge = document.createElement("div");
      badge.className = "bp-som-badge";
      badge.textContent = `[${id}]`;
      badge.style.position = "absolute";
      badge.style.left = `${Math.max(0, rect.left + window.scrollX)}px`;
      badge.style.top = `${Math.max(0, rect.top + window.scrollY - 14)}px`;
      badge.style.backgroundColor = "#e11d48";
      badge.style.color = "#ffffff";
      badge.style.fontSize = "10px";
      badge.style.fontWeight = "bold";
      badge.style.fontFamily = "monospace";
      badge.style.padding = "1px 4px";
      badge.style.borderRadius = "3px";
      badge.style.zIndex = "2147483647";
      badge.style.pointerEvents = "none";
      badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5)";
      document.body.appendChild(badge);

      items.push({
        id,
        tagName: el.tagName.toLowerCase(),
        type,
        text,
        ariaLabel,
        placeholder,
        role,
        selector,
        bounds: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
      });

      if (counter > 75) break; // Limit to top 75 visible elements per screen
    }

    return items;
  });

  // Build compact text summary for text-based LLM consumption
  const lines = rawElements.map((el) => {
    const desc = [
      `[${el.id}] <${el.tagName}>`,
      el.type ? `type="${el.type}"` : "",
      el.text ? `"${el.text}"` : "",
      el.placeholder ? `placeholder="${el.placeholder}"` : "",
      el.ariaLabel ? `aria-label="${el.ariaLabel}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    return desc;
  });

  return {
    elements: rawElements,
    elementSummaryText: lines.join("\n"),
  };
}

/**
 * Removes all injected Set-of-Marks badges from the page
 */
export async function clearSetOfMarksBadges(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll(".bp-som-badge").forEach((el) => el.remove());
  }).catch(() => {});
}

/**
 * Self-healing overlay and popup dismisser
 */
export async function dismissOverlaysAndModals(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    let dismissed = false;
    const cookieDismissSelectors = [
      "button#accept-cookie",
      "button#accept-all",
      "button[aria-label*='accept']",
      "button[aria-label*='consent']",
      "button[aria-label*='agree']",
      "button[aria-label*='close']",
      "button.close-modal",
      "button.btn-accept",
      ".cookie-banner button",
      "#cookie-banner button",
    ];

    for (const sel of cookieDismissSelectors) {
      const btn = document.querySelector<HTMLButtonElement>(sel);
      if (btn && btn.offsetParent !== null) {
        btn.click();
        dismissed = true;
        break;
      }
    }
    return dismissed;
  }).catch(() => false);
}
