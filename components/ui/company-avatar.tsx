"use client";

import React, { useState } from "react";
import { getCompanyLogoUrl, getCompanyInitials } from "@/lib/companies/companyLogo";

interface CompanyAvatarProps {
  companyName?: string | null;
  applyUrl?: string | null;
  logoUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function CompanyAvatar({
  companyName,
  applyUrl,
  logoUrl: explicitLogoUrl,
  className = "",
  size = "md",
}: CompanyAvatarProps) {
  const [hasImageError, setHasImageError] = useState(false);
  const effectiveName = companyName?.trim() || "Company";
  const logoUrl = explicitLogoUrl || getCompanyLogoUrl(effectiveName, applyUrl);
  const initials = getCompanyInitials(effectiveName);

  const sizeClasses = {
    sm: "h-6 w-6 text-[10px]",
    md: "h-8 w-8 text-xs",
    lg: "h-10 w-10 text-sm",
  }[size];

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full overflow-hidden border border-border/70 bg-slate-50 dark:bg-slate-800 shadow-2xs font-mono font-bold select-none ${sizeClasses} ${className}`}
      title={effectiveName}
    >
      {logoUrl && !hasImageError ? (
        <img
          src={logoUrl}
          alt={effectiveName}
          className="h-full w-full object-cover p-1"
          onError={() => setHasImageError(true)}
          loading="lazy"
        />
      ) : (
        <span className="text-[#0b3558] dark:text-blue-300 font-bold">
          {initials}
        </span>
      )}
    </div>
  );
}
