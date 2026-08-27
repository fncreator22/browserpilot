"use client";

import { useState } from "react";
import { 
  Camera, 
  Download, 
  ExternalLink, 
  ZoomIn, 
  Layers, 
  ChevronLeft, 
  ChevronRight,
  Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface StepScreenshot {
  stepIndex: number;
  tool: string;
  url: string;
  screenshotUrl: string;
  timestamp?: string;
  caption?: string;
}

interface ScreenshotGalleryProps {
  screenshots: StepScreenshot[];
  jobId: string;
  className?: string;
}

export function ScreenshotGallery({ screenshots = [], jobId, className = "" }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  if (screenshots.length === 0) return null;

  const currentScreenshot = screenshots[selectedIndex] || screenshots[0];

  return (
    <div className={`rounded-2xl border border-border/80 bg-card p-5 space-y-4 shadow-md ${className}`}>
      {/* Gallery Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
            Multi-Step Viewport Gallery
          </h3>
          <Badge variant="outline" className="font-mono text-[10px]">
            {screenshots.length} {screenshots.length === 1 ? "Capture" : "Captures"}
          </Badge>
        </div>

        {currentScreenshot?.screenshotUrl && (
          <div className="flex items-center gap-2">
            <a
              href={currentScreenshot.screenshotUrl}
              target="_blank"
              rel="noreferrer"
              download={`job_${jobId}_step_${currentScreenshot.stepIndex}.png`}
            >
              <Button variant="outline" size="sm" className="h-7 text-xs font-mono gap-1.5">
                <Download className="h-3 w-3" />
                Download PNG
              </Button>
            </a>
          </div>
        )}
      </div>

      {/* Selected Main Image Preview */}
      <div className="relative aspect-video rounded-xl border border-border/80 overflow-hidden bg-zinc-950 group">
        <img
          src={currentScreenshot.screenshotUrl}
          alt={`Step ${currentScreenshot.stepIndex} screenshot`}
          className="w-full h-full object-contain"
        />

        {/* Overlay Info Tag */}
        <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/60 rounded-md px-2.5 py-1 text-[11px] font-mono text-zinc-300">
          Step {currentScreenshot.stepIndex}: {currentScreenshot.tool}
        </div>

        {/* Lightbox Trigger */}
        <button
          onClick={() => setIsLightboxOpen(true)}
          className="absolute bottom-3 right-3 bg-zinc-900/80 hover:bg-zinc-800 backdrop-blur-sm text-zinc-200 p-2 rounded-lg border border-zinc-700/60 transition-colors opacity-0 group-hover:opacity-100"
          title="Inspect full resolution"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      {/* Thumbnails Row */}
      {screenshots.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          {screenshots.map((s, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`relative h-16 w-24 shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                selectedIndex === idx
                  ? "border-primary shadow-xs ring-2 ring-primary/20"
                  : "border-border/60 opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={s.screenshotUrl}
                alt={`Step ${s.stepIndex}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0.5 right-1 bg-black/70 text-[9px] font-mono text-white px-1 rounded">
                #{s.stepIndex}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          onClick={() => setIsLightboxOpen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <img
              src={currentScreenshot.screenshotUrl}
              alt="Full Resolution Viewport Screenshot"
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain border border-zinc-800"
            />
            <p className="text-zinc-400 font-mono text-xs mt-3">
              Step {currentScreenshot.stepIndex} — {currentScreenshot.url} (Click anywhere to close)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
