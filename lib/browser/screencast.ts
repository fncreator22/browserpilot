/**
 * §LIVE BROWSER SCREENCAST & VIRTUAL CURSOR ENGINE
 * Captures high-frequency viewport frames via Chrome DevTools Protocol (CDP)
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

    const quality = options.quality ?? 60;
    const maxWidth = options.maxWidth ?? 1280;
    const maxHeight = options.maxHeight ?? 800;
    const everyNthFrame = options.everyNthFrame ?? 1;

    // Listen to CDP screencast frames
    cdpSession.on("Page.screencastFrame", async (event: { data: string; metadata: any; sessionId: number }) => {
      try {
        const cursor = activeCursorStates.get(jobId) || { x: 0, y: 0, action: "idle" };

        // Broadcast frame and cursor over SSE / Redis event bus
        jobEventBus.emitJobEvent(jobId, "screencast_frame" as any, {
          frame: `data:image/jpeg;base64,${event.data}`,
          timestamp: Date.now(),
          cursor,
          url: page.url(),
        });

        // Acknowledge frame to keep CDP streaming flowing
        await cdpSession.send("Page.screencastFrameAck", { sessionId: event.sessionId }).catch(() => {});
      } catch {
        // Stream teardown or backpressure handling
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

    console.log(`[Screencast] ✓ Live CDP Videography started for Job: ${jobId}`);
  } catch (err) {
    console.warn(`[Screencast] CDP Screencast initialization notice (running in serverless or unsupported container):`, err);
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
    console.log(`[Screencast] Detached CDP session for Job: ${jobId}`);
  }
}
