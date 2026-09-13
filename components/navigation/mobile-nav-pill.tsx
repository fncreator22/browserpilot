"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  Eye, 
  FileText, 
  SlidersHorizontal
} from "lucide-react";
import { useUIState } from "@/components/providers/ui-state-provider";

export function MobileNavPill() {
  const pathname = usePathname();
  const { openProfileModal, isProfileModalOpen } = useUIState();
  const [isScrolled, setIsScrolled] = useState(false);

  const isExcludedPath = pathname?.startsWith("/ops-sec-") || pathname?.startsWith("/login") || pathname?.startsWith("/register");

  // Monitor scroll for smooth elevation transition (must be called unconditionally before early returns)
  useEffect(() => {
    if (isExcludedPath) return;
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isExcludedPath]);

  // Do not render floating mobile nav pill on admin ops pages or auth pages
  if (isExcludedPath) {
    return null;
  }

  const navItems = [
    {
      href: "/app",
      label: "Discover",
      icon: Compass,
      isActive: pathname === "/app" || pathname === "/app/discover",
    },
    {
      href: "/app/watch",
      label: "Watch",
      icon: Eye,
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/dossier",
      label: "Dossier",
      icon: FileText,
      isActive: pathname === "/app/dossier",
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation Dock"
      className="fixed bottom-3 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none md:hidden"
    >
      <div 
        className={`pointer-events-auto flex items-center justify-around gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-[#1F3D2E]/95 dark:bg-[#1A2620]/95 text-white backdrop-blur-md border border-white/15 transition-all duration-300 min-w-[280px] max-w-[360px] w-full ${
          isScrolled 
            ? "shadow-2xl shadow-black/30 translate-y-0" 
            : "shadow-lg shadow-black/15 translate-y-0"
        }`}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[44px] px-2 rounded-full transition-colors ${
                active 
                  ? "bg-white/20 text-white font-semibold shadow-2xs" 
                  : "text-white/75 hover:text-white hover:bg-white/10"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Dedicated Settings & Profile Trigger Tab */}
        <button
          type="button"
          onClick={() => openProfileModal("ACCOUNT")}
          className={`relative flex flex-col items-center justify-center flex-1 min-h-[44px] px-2 rounded-full transition-colors cursor-pointer ${
            isProfileModalOpen 
              ? "bg-white/20 text-white font-semibold shadow-2xs" 
              : "text-white/75 hover:text-white hover:bg-white/10"
          }`}
          aria-label="Settings and Career Profile"
        >
          <SlidersHorizontal className="h-4 w-4 stroke-[1.75]" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight">Settings</span>
        </button>
      </div>
    </nav>
  );
}
