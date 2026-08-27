/**
 * §LIVE BROWSER SCREENCAST & VIRTUAL CURSOR ENGINE (Low-Latency Turbo Stream)
 * Captures optimized viewport frames via Chrome DevTools Protocol (CDP)
 * and streams real-time visual videography with cursor coordinates over the SSE event bus.
 */

import type { Page, CDPSession } from "playwright";
import { jobEventBus } from "@/lib/events/jobEvents";

export interface ScreencastOptions {
  format?: "jpeg" | "png";
  quality?: number;
  maxWidth?: number;
  maxHeight?: number;
  everyNthFrame?: number;
}

export interface ScreencastCursorState {
  x: number;
  y: number;
  action?: "move" | "click" | "type" | "idle";
  targetText?: string;
}

const activeCDPSessions = new Map<string, CDPSession>();
const activeCursorStates = new Map<string, ScreencastCursorState>();
const lastFrameTimes = new Map<string, number>();

/**
 * Initiates real-time CDP screencast stream on active Playwright page
 */
export async function startBrowserScreencast(
  page: Page,
  jobId: string,
  options: ScreencastOptions = {}
): Promise<void> {
  try {
    const context = page.context();
    const cdpSession: CDPSession = await context.newCDPSession(page);
    activeCDPSessions.set(jobId, cdpSession);

    // Optimized for ultra-low latency & zero buffering over SSE (10-15 FPS, ~25KB per frame)
    const quality = options.quality ?? 50;
    const maxWidth = options.maxWidth ?? 960;
    const maxHeight = options.maxHeight ?? 600;
    const everyNthFrame = options.everyNthFrame ?? 1;

    // 1. Emit instant initial frame so player shows browser immediately
    page.screenshot({ type: "jpeg", quality: 45 }).then((buf) => {
      const base64 = buf.toString("base64");
      jobEventBus.emitJobEvent(jobId, "screencast_frame" as any, {
        frame: `data:image/jpeg;base64,${base64}`,
        timestamp: Date.now(),
        cursor: { x: 100, y: 100, action: "idle" },
        url: page.url() || "about:blank",
      });
    }).catch(() => {});

    // 2. Listen to continuous CDP screencast frames with throttle
    cdpSession.on("Page.screencastFrame", async (event: { data: string; metadata: any; sessionId: number }) => {
      try {
        const now = Date.now();
        const lastTime = lastFrameTimes.get(jobId) || 0;

        // Throttle to max 15 FPS (66ms between frames) to prevent SSE network congestion
        if (now - lastTime >= 65) {
          lastFrameTimes.set(jobId, now);
          const cursor = activeCursorStates.get(jobId) || { x: 0, y: 0, action: "idle" };

          // Broadcast frame and cursor over SSE / Redis event bus
          jobEventBus.emitJobEvent(jobId, "screencast_frame" as any, {
            frame: `data:image/jpeg;base64,${event.data}`,
            timestamp: now,
            cursor,
            url: page.url(),
          });
        }

        // Always acknowledge frame immediately so CDP doesn't pause
        await cdpSession.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
      } catch {
        // Stream teardown
      }
    });

    // Start screencast in Chrome
    await cdpSession.send("Page.startScreencast", {
      format: "jpeg",
      quality,
      maxWidth,
      maxHeight,
      everyNthFrame,
    });

    console.log(`[Screencast] ✓ High-efficiency CDP stream started for Job: ${jobId}`);
  } catch (err) {
    console.warn(`[Screencast] CDP Screencast initialization notice:`, err);
  }
}

/**
 * Updates the virtual cursor coordinates and action state for the live videography player
 */
export function updateScreencastCursor(
  jobId: string,
  cursor: Partial<ScreencastCursorState>
): void {
  const current = activeCursorStates.get(jobId) || { x: 0, y: 0, action: "idle" };
  const updated = { ...current, ...cursor };
  activeCursorStates.set(jobId, updated);

  jobEventBus.emitJobEvent(jobId, "cursor_move" as any, updated);
}

/**
 * Stops and cleans up the active CDP screencast session
 */
export async function stopBrowserScreencast(jobId: string): Promise<void> {
  const cdpSession = activeCDPSessions.get(jobId);
  if (cdpSession) {
    try {
      await cdpSession.send("Page.stopScreencast").catch(() => {});
      await cdpSession.detach().catch(() => {});
    } catch {}
    activeCDPSessions.delete(jobId);
    activeCursorStates.delete(jobId);
    lastFrameTimes.delete(jobId);
    console.log(`[Screencast] Detached CDP session for Job: ${jobId}`);
  }
}
