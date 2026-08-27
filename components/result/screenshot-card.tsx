"use client";

import { useState } from "react";
import { 
  Camera, 
  Lock, 
  RefreshCw, 
  Download, 
  Cloud,
  ImageIcon,
  Info
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ScreenshotCardProps {
  url?: string;
  step?: number;
  timestamp?: string;
  isWorking?: boolean;
  screenshotUrl?: string | null;
  jobId?: string;
  filename?: string;
  /** Set to true when running in serverless/Lambda mode with no Playwright */
  isServerlessMode?: boolean;
}

export function ScreenshotCard({
  url = "about:blank",
  step = 1,
  timestamp,
  isWorking = false,
  screenshotUrl,
  jobId,
  filename,
  isServerlessMode = false,
}: ScreenshotCardProps) {
  const [imageError, setImageError] = useState(false);

  const displayUrl = screenshotUrl || (jobId && filename ? `/api/artifacts/${jobId}/${filename}` : null);
  // Show serverless notice when there's no artifact and we're not currently working
  const showServerlessNotice = !displayUrl && !isWorking && !imageError;

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Browser Viewport Screenshot Artifact
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Playwright sandbox capture at step #{step} {timestamp ? `(${timestamp})` : ""}
          </p>
        </div>

        {displayUrl && !imageError && (
          <div className="flex items-center gap-2">
            <a
              href={displayUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1 text-xs font-mono text-foreground hover:bg-muted gap-1.5 h-8 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download PNG
            </a>
          </div>
        )}
      </div>

      {/* Browser Chrome Frame */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg">
        {/* Address Bar & Tabs Bar */}
        <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/40 px-3 py-2">
          {/* Traffic Light Dots */}
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          {/* URL Pill */}
          <div className="flex flex-1 max-w-lg items-center gap-2 rounded-md bg-background px-3 py-1 text-xs font-mono text-muted-foreground border border-border/60 shadow-xs">
            <Lock className="h-3 w-3 text-emerald-500" />
            <span className="text-foreground truncate">{url}</span>
          </div>

          {/* Meta Info */}
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
              1280 × 800
            </Badge>
          </div>
        </div>

        {/* Screenshot Canvas */}
        <div className="relative min-h-[340px] bg-muted/10 flex items-center justify-center p-2">
          {displayUrl && !imageError ? (
            <img
              src={displayUrl}
              alt={url && url !== "about:blank" ? `Playwright Viewport Capture at Step ${step} on ${url}` : "Playwright Browser Viewport Capture"}
              onError={() => setImageError(true)}
              className="w-full h-auto rounded-lg object-contain shadow-sm max-h-[500px]"
            />
          ) : showServerlessNotice ? (
            /* Serverless Mode Notice — shown when Playwright is unavailable on Vercel Lambda */
            <div className="flex flex-col items-center justify-center p-8 text-center gap-4 max-w-sm">
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                <Cloud className="h-10 w-10 text-blue-400 mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  Serverless Execution Mode
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  This job ran on Vercel Lambda, which cannot launch a Chromium browser.
                  Text extraction and page navigation still worked — only visual screenshots are unavailable.
                </p>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-left">
                <Info className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                  To enable real screenshots, a Playwright worker container must be deployed separately (Fly.io, Railway, or Render).
                </p>
              </div>
            </div>
          ) : imageError ? (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-xs font-medium">Screenshot capture or artifact retrieval failed.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
              <ImageIcon className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-xs font-medium">No visual screenshot artifact generated for this step.</p>
            </div>
          )}

          {isWorking && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] flex items-center justify-center">
              <div className="rounded-xl border border-border bg-card p-4 shadow-xl flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Executing Browser Workflow...</p>
                  <p className="text-muted-foreground font-mono text-[11px]">Playwright isolated sandbox active</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
