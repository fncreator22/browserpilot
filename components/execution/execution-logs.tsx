"use client";

import { useState } from "react";
import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  Code2, 
  Braces 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ToolExecutionLog {
  id: string;
  step: number;
  tool: string;
  parameters: Record<string, unknown>;
  observation: {
    status: "SUCCESS" | "FAILED" | "BLOCKED";
    url: string;
    domSummary?: string;
    elapsedMs: number;
  };
  timestamp: string;
}

export function ExecutionLogs({ logs = [] }: { logs?: ToolExecutionLog[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (log: ToolExecutionLog) => {
    navigator.clipboard.writeText(JSON.stringify(log, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Raw Tool Calls & Developer Telemetry (Level 4 Disclosure)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deterministic Playwright tool invocations, parameters, and raw JSON observations
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="font-mono text-xs gap-1.5"
          disabled={logs.length === 0}
        >
          {isOpen ? (
            <>
              Hide Raw Logs <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show Execution Details ({logs.length} calls) <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </Button>
      </div>

      {logs.length === 0 && (
        <p className="text-xs font-mono text-muted-foreground mt-4 italic">
          No tool execution observations recorded yet. Active execution in progress...
        </p>
      )}

      {isOpen && logs.length > 0 && (
        <div className="mt-6 space-y-4 pt-4 border-t border-border/60">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-border/60 bg-muted/20 p-4 font-mono text-xs transition-all hover:border-border"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-2 py-0.5 font-bold text-primary">
                    Step {log.step}
                  </span>
                  <span className="font-semibold text-foreground">{log.tool}</span>
                  <Badge variant="outline" className="text-[10px] bg-background">
                    {log.observation.elapsedMs}ms
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-[11px]">{log.timestamp}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopy(log)}
                    title="Copy JSON Payload"
                  >
                    {copiedId === log.id ? (
                      <Check className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Parameters */}
                <div className="rounded-lg bg-background/80 p-3 border border-border/40">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Code2 className="h-3 w-3" /> Input Parameters:
                  </div>
                  <pre className="overflow-x-auto text-[11px] text-foreground leading-relaxed">
                    {JSON.stringify(log.parameters, null, 2)}
                  </pre>
                </div>

                {/* Observation Output */}
                <div className="rounded-lg bg-background/80 p-3 border border-border/40">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Braces className="h-3 w-3" /> Observation Output:
                  </div>
                  <pre className="overflow-x-auto text-[11px] text-foreground leading-relaxed">
                    {JSON.stringify(log.observation, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
