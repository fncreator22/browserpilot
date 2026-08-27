"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Globe, 
  MousePointer, 
  Sparkles, 
  Radio, 
  Activity,
  Layers
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ScreencastCursor {
  x: number;
  y: number;
  action?: "move" | "click" | "type" | "idle";
  targetText?: string;
}

interface LiveScreencastPlayerProps {
  jobId: string;
  initialScreenshotUrl?: string | null;
  status?: string;
  className?: string;
}

export function LiveScreencastPlayer({
  jobId,
  initialScreenshotUrl,
  status = "WORKING",
  className = "",
}: LiveScreencastPlayerProps) {
  const [currentFrame, setCurrentFrame] = useState<string | null>(initialScreenshotUrl || null);
  const [currentUrl, setCurrentUrl] = useState<string>("about:blank");
  const [cursor, setCursor] = useState<ScreencastCursor>({ x: 100, y: 100, action: "idle" });
  const [isLive, setIsLive] = useState(status === "WORKING" || status === "PLANNING" || status === "VERIFYING");
  const [actionTicker, setActionTicker] = useState<string>("Initializing browser sandbox...");
  const containerRef = useRef<HTMLDivElement>(null);

  // Connect to the job's real-time SSE stream for live videography frames
  useEffect(() => {
    if (!jobId) return;

    const eventSource = new EventSource(`/api/jobs/${jobId}/events`);

    eventSource.addEventListener("screencast_frame", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.frame) {
          setCurrentFrame(data.frame);
          setIsLive(true);
        }
        if (data.cursor) {
          setCursor(data.cursor);
        }
        if (data.url) {
          setCurrentUrl(data.url);
        }
      } catch {}
    });

    eventSource.addEventListener("cursor_move", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setCursor(data);
        if (data.action === "type" && data.targetText) {
          setActionTicker(`Typing: "${data.targetText}"`);
        } else if (data.action === "click") {
          setActionTicker(`Clicking element at (${data.x}, ${data.y})`);
        }
      } catch {}
    });

    eventSource.addEventListener("step_start", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        setActionTicker(`Executing Step ${data.stepNumber || "?"}: ${data.tool || "browser action"}`);
      } catch {}
    });

    eventSource.addEventListener("complete", () => {
      setIsLive(false);
      setActionTicker("Task execution completed successfully.");
    });

    return () => {
      eventSource.close();
    };
  }, [jobId]);

  return (
    <div className={`rounded-2xl border border-border/80 bg-card overflow-hidden shadow-lg flex flex-col ${className}`}>
      {/* Top Browser Window Header & Address Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/60 gap-3">
        {/* Window Dots */}
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
          <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
        </div>

        {/* Live URL Address Bar */}
        <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-background/80 border border-border/60 rounded-lg px-3 py-1 text-xs font-mono text-muted-foreground truncate">
          <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate text-foreground select-all">{currentUrl}</span>
        </div>

        {/* Live Pulse Badge */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 font-mono text-[10px] gap-1 px-2 py-0.5 animate-pulse">
              <Radio className="h-3 w-3" />
              LIVE STREAM
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground gap-1 px-2 py-0.5">
              <Activity className="h-3 w-3" />
              RECORDED
            </Badge>
          )}
        </div>
      </div>

      {/* Main Viewport Videography Canvas */}
      <div 
        ref={containerRef}
        className="relative aspect-video w-full bg-zinc-950 flex items-center justify-center overflow-hidden select-none"
      >
        {currentFrame ? (
          <img
            src={currentFrame}
            alt="Live Browser Screencast Viewport"
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary animate-pulse">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">Playwright Sandbox Connecting</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Awaiting live Chrome DevTools Protocol video stream from worker node...
              </p>
            </div>
          </div>
        )}

        {/* Animated Virtual Mouse Cursor Overlay */}
        {isLive && currentFrame && (
          <motion.div
            animate={{
              x: cursor.x,
              y: cursor.y,
              scale: cursor.action === "click" ? [1, 0.75, 1.1, 1] : 1,
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
            }}
            className="absolute top-0 left-0 pointer-events-none z-50 transform -translate-x-1 -translate-y-1"
          >
            <div className="relative">
              {/* Cursor Icon */}
              <MousePointer className="h-5 w-5 text-rose-500 fill-rose-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
              {/* Ripple on click */}
              {cursor.action === "click" && (
                <span className="absolute -top-1 -left-1 h-7 w-7 rounded-full bg-rose-500/40 animate-ping" />
              )}
            </div>
          </motion.div>
        )}

        {/* Live Keystroke & Action Ticker Overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none z-40">
          <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-lg">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-mono text-zinc-200 truncate max-w-md">
              {actionTicker}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
