"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ShieldAlert, 
  RefreshCw, 
  HelpCircle, 
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ERROR_CATALOG_7, 
  mapInternalErrorToHuman, 
  type HumanReadableError 
} from "@/lib/verification/errorMapper";

export interface BlockedStateCardProps {
  errorCode?: string;
  customMessage?: string;
  customDiagnostic?: string;
  rawError?: unknown;
  onRetry?: () => void;
}

export function BlockedStateCard({
  errorCode,
  customMessage,
  customDiagnostic,
  rawError,
  onRetry,
}: BlockedStateCardProps) {
  // Use mapping helper to resolve cleanly to one of the 7 user-friendly error definitions
  const error: HumanReadableError = rawError 
    ? mapInternalErrorToHuman(rawError)
    : errorCode && ERROR_CATALOG_7[errorCode]
    ? ERROR_CATALOG_7[errorCode]
    : mapInternalErrorToHuman(errorCode || customMessage);

  const displayMessage = customMessage || error.userMessage;
  const displayTechnical = customDiagnostic || error.technicalDetail;

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 sm:p-6 shadow-md transition-all">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <ShieldAlert className="h-5 w-5" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              {error.title}
              <Badge variant="outline" className="font-mono text-[10px] text-rose-600 dark:text-rose-400 border-rose-500/30 bg-rose-500/10">
                {error.code}
              </Badge>
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground uppercase">
              Category: {error.category}
            </span>
          </div>

          <p className="mt-2 text-sm text-foreground/90 font-medium leading-relaxed">
            {displayMessage}
          </p>

          <div className="mt-4 rounded-xl border border-border/60 bg-background/80 p-3.5 space-y-2 font-mono text-xs">
            <div className="text-muted-foreground text-[11px]">
              <span className="font-bold text-foreground">Diagnostic:</span> {displayTechnical}
            </div>
            <div className="text-muted-foreground text-[11px] pt-2 border-t border-border/40">
              <span className="font-bold text-emerald-600 dark:text-emerald-400">Recommended Action:</span> {error.suggestedAction}
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {error.recoverable && onRetry ? (
              <Button
                variant="default"
                size="sm"
                onClick={onRetry}
                className="gap-2 font-semibold shadow-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Operation
              </Button>
            ) : null}

            <Link
              href="/#reliability"
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono text-foreground hover:bg-muted gap-2 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              Reliability & Safety Rules (§26)
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorCatalogDemo() {
  const [selectedCode, setSelectedCode] = useState<string>("VERIFICATION_BLOCKED");

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm space-y-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          §26 Human-Readable Error & Blocked State Catalog (All 7 Codes)
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Select any of the 7 deterministic system error states below to inspect its human-facing UX card.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {Object.keys(ERROR_CATALOG_7).map((code) => (
          <button
            key={code}
            onClick={() => setSelectedCode(code)}
            className={`rounded-lg px-2.5 py-1 text-xs font-mono border transition-all ${
              selectedCode === code
                ? "bg-primary text-primary-foreground border-primary font-bold shadow-xs"
                : "bg-secondary/60 text-muted-foreground border-border hover:text-foreground"
            }`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="pt-2">
        <BlockedStateCard errorCode={selectedCode} />
      </div>
    </div>
  );
}
