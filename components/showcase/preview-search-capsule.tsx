"use client";

import { useState } from "react";
import { Sparkles, ArrowRight, CornerDownLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * PreviewSearchCapsule - Standalone showcase / landing page animation component.
 * 
 * Features:
 * - Reactive glowing border perimeter with `--glow-color`
 * - Simulated discovery progress and morphing CTA state
 * - Quick filter preset badges
 * - Zero dependencies on internal app router or active session
 */
export function PreviewSearchCapsule({
  onSimulateSearch,
}: {
  onSimulateSearch?: (prompt: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [isSimulating, setIsSimulating] = useState(false);

  const presets = [
    "Staff AI Engineer in SF or Remote",
    "Founding Frontend at YC Startup",
    "Product Designer (Europe / Remote)",
  ];

  const handleSimulate = (text?: string) => {
    const targetText = text || query || "Senior Full-Stack Engineer at Series B Startup";
    setQuery(targetText);
    setIsSimulating(true);

    if (onSimulateSearch) onSimulateSearch(targetText);

    setTimeout(() => {
      setIsSimulating(false);
    }, 2500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Capsule Box */}
      <div
        className={`relative rounded-2xl border transition-all duration-300 p-2 shadow-lg ${
          isSimulating
            ? "border-primary shadow-[0_0_25px_rgba(255,255,255,0.15)] animate-glow-active bg-card"
            : "border-border/80 bg-card/90 hover:border-border"
        }`}
      >
        <div className="flex items-center gap-2 px-3 py-1.5">
          <Sparkles className={`h-4 w-4 ${isSimulating ? "text-primary animate-spin" : "text-muted-foreground"}`} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSimulate()}
            placeholder="Type any career search or target company..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <Button
            size="sm"
            onClick={() => handleSimulate()}
            disabled={isSimulating}
            className="h-8 px-3 rounded-lg text-xs font-semibold gap-1.5 transition-all"
          >
            {isSimulating ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Searching</span>
              </>
            ) : (
              <>
                <span>Discover</span>
                <CornerDownLeft className="h-3 w-3 opacity-60" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preset Pills */}
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span className="text-[11px] text-muted-foreground mr-1 font-mono">Try:</span>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handleSimulate(preset)}
            className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
          >
            {preset}
          </button>
        ))}
      </div>
    </div>
  );
}
