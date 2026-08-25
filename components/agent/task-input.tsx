"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  ArrowRight, 
  SlidersHorizontal, 
  Globe, 
  Shield, 
  Layers, 
  CheckCircle2, 
  Search,
  Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface TaskInputProps {
  initialPrompt?: string;
  isCompact?: boolean;
}

const PRESET_TEMPLATES = [
  {
    label: "Hacker News AI Extraction",
    icon: Search,
    goal: "Navigate to news.ycombinator.com, find the top 5 articles discussing Artificial Intelligence or LLMs, extract their titles, authors, point scores, and outbound link URLs into a structured table.",
    domains: "news.ycombinator.com",
    steps: 8,
  },
  {
    label: "SaaS Pricing Comparison",
    icon: Layers,
    goal: "Inspect pricing pages for popular developer tools, compare monthly vs annual discounts, and extract feature matrices for the Pro and Team tiers.",
    domains: "github.com, vercel.com",
    steps: 12,
  },
  {
    label: "Security Advisory Audit",
    icon: Shield,
    goal: "Traverse security release notes, extract all CVE identifiers listed for the past 30 days, verify patch links, and capture full-page audit screenshots.",
    domains: "nvd.nist.gov, github.com",
    steps: 10,
  },
  {
    label: "Form & Signup Flow Audit",
    icon: CheckCircle2,
    goal: "Navigate to the registration form, test field validations by entering mock test data, submit the form, and verify that appropriate success badges appear.",
    domains: "example.com",
    steps: 6,
  },
];

export function TaskInput({ initialPrompt = "", isCompact = false }: TaskInputProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialPrompt);
  const [allowedDomains, setAllowedDomains] = useState("");
  const [maxSteps, setMaxSteps] = useState(15);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const domainsList = allowedDomains
        ? allowedDomains.split(",").map((d) => d.trim()).filter(Boolean)
        : [];

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          allowedDomains: domainsList.length > 0 ? domainsList : undefined,
          maxStepsBudget: maxSteps,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to dispatch job to queue");
      }

      if (data.jobId) {
        router.push(`/app/jobs/${data.jobId}`);
      }
    } catch (err: unknown) {
      setSubmitError((err as Error).message || "An unexpected error occurred while dispatching the task.");
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setPrompt(preset.goal);
    setAllowedDomains(preset.domains);
    setMaxSteps(preset.steps);
  };

  return (
    <div className="w-full rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-6 shadow-xl backdrop-blur-xl transition-all">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
              Agent Goal & Instructions
            </label>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Gemini 2.5 Planner • 8 Deterministic Tools
          </span>
        </div>

        <div className="relative">
          <Textarea
            id="task-goal"
            aria-label="Describe your web automation task"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe your web task in natural language (e.g. 'Navigate to news.ycombinator.com, find the top 3 AI stories, and extract titles and scores into a table')..."
            rows={isCompact ? 3 : 4}
            className="w-full resize-none rounded-xl border-border/70 bg-background/80 p-4 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-1 focus-visible:ring-primary shadow-inner font-sans"
          />
        </div>

        {submitError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
            Error: {submitError}
          </div>
        )}

        {/* Preset Chips */}
        <div className="space-y-2">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
            Sample Workflows:
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESET_TEMPLATES.map((preset) => {
              const Icon = preset.icon;
              return (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => handleSelectPreset(preset)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/50 px-2.5 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary hover:border-primary/40 transition-colors"
                >
                  <Icon className="h-3 w-3 text-muted-foreground" />
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div className="pt-2">
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showAdvanced ? "Hide Execution Constraints" : "Configure Constraints & Domain Lock"}
          </button>

          {showAdvanced && (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-border/60 bg-background/50 p-4">
              <div className="space-y-1.5">
                <label htmlFor="allowed-domains" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Allowed Domains Whitelist
                </label>
                <Input
                  id="allowed-domains"
                  value={allowedDomains}
                  onChange={(e) => setAllowedDomains(e.target.value)}
                  placeholder="e.g. news.ycombinator.com, github.com"
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Restricts browser navigation strictly to specified origins.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="max-steps" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  Max Action Budget (Steps)
                </label>
                <Input
                  id="max-steps"
                  type="number"
                  min={1}
                  max={25}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(parseInt(e.target.value) || 15)}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Hard boundary on total browser actions (max 25 in v1).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-border/40">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Worker Pool: <span className="text-foreground font-medium">Ready</span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              type="submit"
              disabled={!prompt.trim() || isSubmitting}
              className="w-full sm:w-auto gap-2 px-6 shadow-md font-semibold"
            >
              {isSubmitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Dispatching Agent...
                </>
              ) : (
                <>
                  Dispatch Task
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
