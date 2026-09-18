"use client";

import React, { useState, useEffect } from "react";
import { Toaster } from "sonner";

export function ResponsiveToaster() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const mql = window.matchMedia("(max-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return (
    <Toaster
      position={mounted && isMobile ? "bottom-center" : "top-right"}
      offset={mounted && isMobile ? 120 : 24}
      closeButton
      expand={true}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast !bg-card !text-foreground !border !border-border shadow-xl font-sans text-xs rounded-xl p-4 !h-auto !w-full max-w-[400px] flex items-start gap-3 transition-all relative",
          title: "font-semibold !text-foreground text-sm leading-tight pr-4",
          description: "!text-muted-foreground text-xs mt-1 leading-relaxed break-words whitespace-normal",
          actionButton: "!bg-primary !text-primary-foreground font-semibold text-xs px-3 py-1.5 rounded-lg",
          cancelButton: "!bg-muted !text-muted-foreground text-xs px-3 py-1.5 rounded-lg",
          closeButton: "!bg-background !border !border-border !text-foreground hover:!bg-muted",
          error: "!border-destructive/40 !text-destructive",
          success: "!border-emerald-500/40 !text-emerald-700 dark:!text-emerald-300",
        },
      }}
    />
  );
}
