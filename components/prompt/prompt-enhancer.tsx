"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Sparkles, 
  Check, 
  X,
  Globe, 
  SlidersHorizontal,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { OptimizedPromptResult } from "@/lib/ai/promptEnhancer";

interface PromptEnhancerProps {
  currentPrompt: string;
  onApplyPrompt: (newPrompt: string) => void;
  onExecutePrompt?: (newPrompt: string) => void;
  className?: string;
}

export function PromptEnhancer({
  currentPrompt,
  onApplyPrompt,
  className = "",
}: PromptEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [result, setResult] = useState<OptimizedPromptResult | null>(null);

  const handleEnhance = async () => {
    if (!currentPrompt.trim()) {
      toast.error("Please enter a query first to enhance.");
      return;
    }

    setIsEnhancing(true);
    try {
      let res = await fetch("/api/agent/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      if (!res.ok) {
        res = await fetch("/api/prompt/enhance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: currentPrompt }),
        });
      }

      if (!res.ok) throw new Error("Enhancement failed");

      const data: OptimizedPromptResult = await res.json();
      setResult(data);
      toast.success("Prompt optimized with structured constraints.");
    } catch {
      toast.error("Could not enhance prompt. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleApply = () => {
    if (!result?.enhancedPrompt) return;
    onApplyPrompt(result.enhancedPrompt);
    toast.success("Enhanced prompt applied.");
    setResult(null);
  };

  const handleDismiss = () => {
    setResult(null);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Compact Trigger Button */}
      <button
        type="button"
        onClick={handleEnhance}
        disabled={isEnhancing || !currentPrompt.trim()}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-sans text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        title="Enhance prompt with AI"
      >
        <Sparkles className={`h-3.5 w-3.5 text-amber-500 shrink-0 ${isEnhancing ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">{isEnhancing ? "Enhancing..." : "Enhance"}</span>
      </button>

      {/* Slide-Down Popover Card */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="absolute left-0 bottom-full mb-2 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card p-3.5 shadow-xl space-y-3 font-sans text-xs"
          >
            {/* Popover Header */}
            <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span className="font-semibold text-foreground">Enhanced Prompt</span>
                <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
                  {result.category}
                </Badge>
              </div>

              <button
                type="button"
                onClick={handleDismiss}
                className="h-5 w-5 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Enhanced Prompt Text */}
            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/60 text-foreground font-sans leading-relaxed text-xs">
              {result.enhancedPrompt}
            </div>

            {/* Diff Summary of Additions */}
            <div className="space-y-1.5 pt-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                Structured Additions
              </span>
              <div className="flex flex-wrap gap-1">
                {result.targetPlatforms?.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40"
                  >
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {p}
                  </span>
                ))}
                {result.extractionFields?.slice(0, 4).map((f) => (
                  <span
                    key={f}
                    className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] bg-muted text-muted-foreground border border-border/60"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="h-7 px-2 text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Dismiss
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                className="h-7 px-3 text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-xs"
              >
                <Check className="h-3 w-3" />
                Apply to Input
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
