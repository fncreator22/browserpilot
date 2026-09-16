"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  Radio, 
  Bookmark, 
  Settings,
  Plus,
  Search
} from "lucide-react";
import { useUIState } from "@/components/providers/ui-state-provider";

export function MobileNavPill() {
  const pathname = usePathname();
  const { openProfileModal, isProfileModalOpen, savedCount } = useUIState();
  const [isScrolled, setIsScrolled] = useState(false);

  const isExcludedPath = 
    pathname?.startsWith("/ops-sec-") || 
    pathname?.startsWith("/login") || 
    pathname?.startsWith("/signup") ||
    pathname?.startsWith("/checkout");

  useEffect(() => {
    if (isExcludedPath) return;
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isExcludedPath]);

  if (isExcludedPath) {
    return null;
  }

  const navItems = [
    {
      href: "/app",
      label: "Home",
      icon: Compass,
      isActive: pathname === "/app",
    },
    {
      href: "/app/watch",
      label: "Radar",
      icon: Radio,
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/saved",
      label: "Saved",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      isActive: pathname === "/app/saved",
    },
  ];

  return (
    <nav 
      aria-label="Mobile Floating Dock"
      className="fixed bottom-5 inset-x-0 mx-auto w-fit z-40 lg:hidden pointer-events-none flex items-center gap-2.5 px-4"
    >
      {/* Black Main Pill Dock */}
      <div 
        className={`pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-slate-950/95 text-white backdrop-blur-xl border border-white/10 transition-all duration-300 ${
          isScrolled 
            ? "shadow-2xl shadow-black/60 scale-[0.98]" 
            : "shadow-xl shadow-black/40"
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
              className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
                active 
                  ? "w-11 h-11 rounded-full bg-white text-black shadow-md font-bold scale-105" 
                  : "w-10 h-10 rounded-full text-white/60 hover:text-white hover:bg-white/10"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`${active ? "h-5 w-5 stroke-[2.2]" : "h-4 w-4 stroke-[1.75]"}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-emerald-500 text-white text-[9px] font-mono font-bold px-1 ring-2 ring-slate-950">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}

        {/* Settings / Account Trigger Button */}
        <button
          type="button"
          onClick={() => openProfileModal("ACCOUNT")}
          className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
            isProfileModalOpen 
              ? "w-11 h-11 rounded-full bg-white text-black shadow-md scale-105" 
              : "w-10 h-10 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          }`}
          aria-label="Account Settings"
        >
          <Settings className={`${isProfileModalOpen ? "h-5 w-5 stroke-[2.2]" : "h-4 w-4 stroke-[1.75]"}`} />
        </button>
      </div>

      {/* Quick Search Circular Trigger Button (Matching TimoBots '+' elevated action) */}
      <button
        type="button"
        onClick={() => {
          if (pathname !== "/app") {
            window.location.href = "/app";
          } else {
            const input = document.querySelector("textarea, input[type='text']") as HTMLElement | null;
            input?.focus();
            window.scrollTo({ top: 0, behavior: "smooth" });
          }
        }}
        className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full bg-slate-900/90 text-white border border-white/20 shadow-xl shadow-black/50 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        aria-label="New Search"
        title="Quick Search"
      >
        <Search className="h-5 w-5 group-hover:rotate-12 transition-transform" />
      </button>
    </nav>
  );
}
