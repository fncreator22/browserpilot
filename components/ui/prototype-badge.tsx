"use client";

import React from "react";
import { FlaskConical } from "lucide-react";

interface PrototypeBadgeProps {
  label?: string;
  tooltip?: string;
  className?: string;
  size?: "sm" | "md";
}

/**
 * PrototypeBadge
 * 
 * Visual indicator marking incomplete, mock, or unconnected preview features
 * so operators and users clearly know they are in active development.
 * Follows Navy Ink on Cool Marble design system (no purple, no em-dashes).
 */
export function PrototypeBadge({
  label = "Prototype (Not Connected)",
  tooltip = "This feature is in prototype preview and not yet connected to a live upstream service.",
  className = "",
  size = "sm",
}: PrototypeBadgeProps) {
  const isSm = size === "sm";

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono uppercase tracking-wider font-semibold rounded-md border border-amber-600/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 select-none shadow-2xs ${
        isSm ? "text-[9px] px-1.5 py-0.5" : "text-[10px] px-2 py-0.5"
      } ${className}`}
      title={tooltip}
    >
      <FlaskConical className={isSm ? "h-2.5 w-2.5" : "h-3 w-3"} />
      <span>{label}</span>
    </span>
  );
}

