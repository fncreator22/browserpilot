"use client";

import { useState } from "react";
import { 
  Sparkles, 
  Copy, 
  Check, 
  ArrowUpRight, 
  RefreshCw, 
  SlidersHorizontal, 
  ShieldCheck, 
  Globe, 
  CheckCircle2,
  Edit3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { OptimizedPromptResult } from "@/lib/ai/promptEnhancer";

interface PromptEnhancerProps {
  currentPrompt: string;
  onApplyPrompt: (newPrompt: string) => void;
  onExecutePrompt: (newPrompt: string) => void;
  className?: string;
}

export function PromptEnhancer({
  currentPrompt,
  onApplyPrompt,
  onExecutePrompt,
  className = "",
}: PromptEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [result, setResult] = useState<OptimizedPromptResult | null>(null);
  const [copied, setCopied] = useState(false);

  const handleEnhance = async () => {
    if (!currentPrompt.trim()) {
      toast.error("Please enter a goal or prompt first to enhance.");
      return;
    }

    setIsEnhancing(true);
    try {
      const res = await fetch("/api/prompt/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt }),
      });

      if (!res.ok) throw new Error("Enhancement failed");

      const data: OptimizedPromptResult = await res.json();
      setResult(data);
      toast.success("Prompt optimized into actionable blueprint.");
    } catch {
      toast.error("Could not enhance prompt. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleCopy = () => {
    if (!result?.enhancedPrompt) return;
    navigator.clipboard.writeText(result.enhancedPrompt);
    setCopied(true);
    toast.success("Enhanced prompt copied to clipboard.");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEditInInput = () => {
    if (!result?.enhancedPrompt) return;
    onApplyPrompt(result.enhancedPrompt);
    toast.info("Enhanced prompt placed in editor. You can tweak and re-enhance.");
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Enhance Trigger Button */}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleEnhance}
          disabled={isEnhancing || !currentPrompt.trim()}
          className="h-8 font-mono text-xs gap-1.5 border-primary/40 hover:border-primary text-foreground bg-primary/5 hover:bg-primary/10 shadow-xs transition-all"
        >
          <Sparkles className={`h-3.5 w-3.5 text-primary ${isEnhancing ? "animate-spin" : ""}`} />
          {isEnhancing ? "Optimizing Goal with AI..." : "Enhance Prompt with AI"}
        </Button>

        {result && (
          <span className="text-[11px] font-mono text-muted-foreground">
            Target Category: <strong className="text-foreground">{result.category}</strong>
          </span>
        )}
      </div>

      {/* Enhanced Prompt Card & Verification Drawer */}
      {result && (
        <div className="rounded-xl border border-primary/50 bg-card p-4 space-y-3.5 shadow-sm transition-all animate-in fade-in duration-300">
          <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground font-mono">
                Suggested Search Goal (Prompt Optimization)
              </h4>
            </div>

            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleEnhance}
                disabled={isEnhancing}
                className="h-7 text-xs font-mono gap-1 text-muted-foreground hover:text-foreground"
                title="Regenerate alternative blueprint"
              >
                <RefreshCw className={`h-3 w-3 ${isEnhancing ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </div>

          {/* Enhanced Text */}
          <div className="bg-muted/30 border border-border/60 rounded-lg p-3 text-xs leading-relaxed text-foreground font-mono select-text">
            {result.enhancedPrompt}
          </div>

          {/* Target Platforms & Extraction Criteria Chips */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground mr-1 flex items-center gap-1">
                <Globe className="h-3 w-3" /> Target Portals:
              </span>
              {result.targetPlatforms.map((p) => (
                <Badge key={p} variant="outline" className="font-mono text-[10px] bg-background">
                  <CheckCircle2 className="h-2.5 w-2.5 text-emerald-500 mr-1 inline" />
                  {p}
                </Badge>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground mr-1 flex items-center gap-1">
                <SlidersHorizontal className="h-3 w-3" /> Fields:
              </span>
              {result.extractionFields.map((f) => (
                <Badge key={f} variant="outline" className="font-mono text-[10px] text-muted-foreground border-border/60">
                  {f}
                </Badge>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleEditInInput}
                className="h-8 text-xs font-mono gap-1.5"
              >
                <Edit3 className="h-3 w-3" />
                Copy to Input & Tweak
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-8 text-xs font-mono gap-1.5 text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => onExecutePrompt(result.enhancedPrompt)}
              className="h-8 text-xs font-mono gap-1.5 shadow-xs bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Execute Verified Plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
