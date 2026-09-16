"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";

export function AuditInteractionListener() {
  const pathname = usePathname();
  const lastPathRef = useRef(pathname);

  // Track route transitions
  useEffect(() => {
    if (lastPathRef.current !== pathname) {
      const from = lastPathRef.current;
      lastPathRef.current = pathname;

      try {
        fetch(ADMIN_API_ROUTES.LOGS, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actor: pathname.includes("ops-sec") ? "ADMIN" : "USER",
            actionType: "NAVIGATE",
            target: `Route: ${from} -> ${pathname}`,
            path: pathname,
            details: {
              from,
              to: pathname,
              timestamp: new Date().toISOString(),
              screenResolution: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "unknown",
            },
          }),
          keepalive: true,
        }).catch(() => {
          // Non-blocking telemetry
        });
      } catch {
        // Suppress client telemetry errors
      }
    }
  }, [pathname]);

  // Track interactive element clicks globally
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Find closest interactive element
      const interactiveEl = target.closest(
        "button, a, input[type='checkbox'], input[type='radio'], select, [data-audit], [role='button']"
      ) as HTMLElement | null;

      if (!interactiveEl) return;

      // Extract meaningful identifier
      const explicitLabel =
        interactiveEl.getAttribute("data-audit") ||
        interactiveEl.getAttribute("aria-label") ||
        interactiveEl.innerText?.trim().slice(0, 60) ||
        interactiveEl.getAttribute("title") ||
        interactiveEl.tagName.toLowerCase();

      const href = interactiveEl.getAttribute("href");
      const elementTag = interactiveEl.tagName.toLowerCase();

      // Don't spam if label is empty
      if (!explicitLabel) return;

      const actor = window.location.pathname.includes("ops-sec") ? "ADMIN" : "USER";
      const actionType = href ? "NAVIGATE" : "CLICK";

      try {
        const payload = JSON.stringify({
          actor,
          actionType,
          target: `${elementTag.toUpperCase()}: ${explicitLabel}`,
          path: window.location.pathname,
          details: {
            tagName: elementTag,
            elementId: interactiveEl.id || undefined,
            classList: interactiveEl.className?.slice(0, 100) || undefined,
            href: href || undefined,
            coordinates: { x: Math.round(e.clientX), y: Math.round(e.clientY) },
          },
        });

        if (navigator.sendBeacon) {
          navigator.sendBeacon(ADMIN_API_ROUTES.LOGS, new Blob([payload], { type: "application/json" }));
        } else {
          fetch(ADMIN_API_ROUTES.LOGS, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Non-blocking
      }
    }

    document.addEventListener("click", handleDocumentClick, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", handleDocumentClick, { capture: true });
    };
  }, []);

  return null;
}
