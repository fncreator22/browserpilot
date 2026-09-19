"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, X, Copy, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfoBadgeProps {
  /**
   * Title shown at the top of the info popover/drawer
   */
  title: string;
  /**
   * High-level concise description
   */
  description?: string;
  /**
   * Structured key-value pairs for technical/analytical metrics
   */
  details?: Record<string, string | number | boolean | null | undefined>;
  /**
   * Optional bullet items for qualitative explanations
   */
  bullets?: string[];
  /**
   * Raw debug JSON payload or trace
   */
  rawPayload?: Record<string, any> | string;
  /**
   * Visual variant: minimal pill, icon-only circle, or inline text badge
   */
  variant?: "icon" | "pill" | "subtle";
  /**
   * Popover placement preference
   */
  side?: "top" | "bottom" | "left" | "right";
  /**
   * Optional custom button label (e.g., "(i) Details")
   */
  label?: string;
  className?: string;
}

export function InfoBadge({
  title,
  description,
  details,
  bullets,
  rawPayload,
  variant = "icon",
  side = "top",
  label,
  className,
}: InfoBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; placement: "top" | "bottom" }>({
    top: 0,
    left: 0,
    placement: "bottom",
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = Math.min(320, typeof window !== "undefined" ? window.innerWidth - 24 : 320);
    const estimatedHeight = 220;

    let left = rect.left + rect.width / 2 - popoverWidth / 2;
    if (typeof window !== "undefined") {
      left = Math.max(12, Math.min(left, window.innerWidth - popoverWidth - 12));
    }

    // Smart vertical positioning: flip to bottom if top will overflow off screen
    let placement: "top" | "bottom" = side === "bottom" ? "bottom" : "top";
    if (placement === "top" && rect.top < estimatedHeight + 20) {
      placement = "bottom";
    }

    let top = 0;
    if (placement === "top") {
      top = Math.max(10, rect.top - 8);
    } else {
      top = rect.bottom + 8;
    }

    setCoords({ top, left, placement });
  }, [side]);

  // Update position when opened or on window resize/scroll
  useEffect(() => {
    if (isOpen) {
      updatePosition();
      const handleScrollOrResize = () => updatePosition();
      window.addEventListener("scroll", handleScrollOrResize, true);
      window.addEventListener("resize", handleScrollOrResize);
      return () => {
        window.removeEventListener("scroll", handleScrollOrResize, true);
        window.removeEventListener("resize", handleScrollOrResize);
      };
    }
  }, [isOpen, updatePosition]);

  // Close on Escape or click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  const handleCopyPayload = () => {
    if (!rawPayload) return;
    const text =
      typeof rawPayload === "string"
        ? rawPayload
        : JSON.stringify(rawPayload, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const popoverContent = isOpen && mounted ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={title}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: coords.placement === "top" ? undefined : `${coords.top}px`,
        bottom: coords.placement === "top" ? `${typeof window !== "undefined" ? window.innerHeight - coords.top : 0}px` : undefined,
        left: `${coords.left}px`,
        width: "min(320px, calc(100vw - 24px))",
        zIndex: 99999,
      }}
      className="rounded-xl border border-border bg-card/95 backdrop-blur-md p-3.5 shadow-xl text-left animate-in fade-in zoom-in-95 duration-150 max-h-[min(380px,80vh)] overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-bold">
            i
          </span>
          <h4 className="text-xs font-semibold font-sans text-foreground tracking-tight truncate">
            {title}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          aria-label="Close information dialog"
        >
          <X className="h-3 w-3 stroke-[2]" />
        </button>
      </div>

      {/* Description */}
      {description && (
        <p className="mt-2 text-[11px] font-sans text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}

      {/* Structured Details Matrix */}
      {details && Object.keys(details).length > 0 && (
        <div className="mt-2.5 space-y-1 rounded-lg bg-muted/50 p-2 border border-border/50 text-[10px] font-mono">
          {Object.entries(details).map(([key, val]) => {
            if (val === undefined || val === null) return null;
            return (
              <div key={key} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground truncate">{key}:</span>
                <span className="font-semibold text-foreground truncate">
                  {typeof val === "boolean" ? (val ? "Yes" : "No") : String(val)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bullet Points */}
      {bullets && bullets.length > 0 && (
        <ul className="mt-2 space-y-1 text-[11px] font-sans text-muted-foreground">
          {bullets.map((b, idx) => (
            <li key={idx} className="flex items-start gap-1.5">
              <ChevronRight className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Raw Payload Inspector */}
      {rawPayload && (
        <div className="mt-2.5 pt-2 border-t border-border/50">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground">
              Debug Payload
            </span>
            <button
              type="button"
              onClick={handleCopyPayload}
              className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy payload to clipboard"
            >
              {copied ? (
                <>
                  <Check className="h-2.5 w-2.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-2.5 w-2.5" />
                  <span>Copy JSON</span>
                </>
              )}
            </button>
          </div>
          <pre className="max-h-28 overflow-y-auto rounded-md bg-slate-950 p-2 text-[9px] font-mono text-slate-300 leading-tight border border-slate-800">
            {typeof rawPayload === "string"
              ? rawPayload
              : JSON.stringify(rawPayload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  ) : null;

  return (
    <div 
      className="relative inline-flex items-center"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* (i) Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        aria-label={`View info: ${title}`}
        aria-expanded={isOpen}
        title={`View info: ${title}`}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 cursor-pointer select-none",
          variant === "icon" &&
            "h-4 w-4 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700/80 shadow-2xs hover:scale-105 active:scale-95",
          variant === "pill" &&
            "gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-muted-foreground hover:text-foreground border border-border/80 shadow-2xs",
          variant === "subtle" &&
            "h-3.5 w-3.5 rounded-full text-muted-foreground/70 hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-slate-800/50",
          className
        )}
      >
        <Info className="h-2.5 w-2.5 stroke-[2.25]" />
        {label && <span className="text-[10px] font-mono leading-none">{label}</span>}
      </button>

      {/* Portaled Popover into document.body */}
      {mounted && typeof document !== "undefined" && createPortal(popoverContent, document.body)}
    </div>
  );
}
