"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  Radio, 
  Bookmark, 
  Plus,
  Search,
  Briefcase
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
      href: "/app/marketplace",
      label: "Market",
      icon: Briefcase,
      isActive: pathname === "/app/marketplace",
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
      {/* Navy Ink Main Pill Dock */}
      <div 
        className={`pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-full bg-[#06233d]/95 text-white backdrop-blur-xl border border-white/10 transition-all duration-300 ${
          isScrolled 
            ? "shadow-marble-3 scale-[0.98]" 
            : "shadow-marble-2"
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
                  ? "w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-marble-1 font-bold scale-105" 
                  : "w-10 h-10 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <Icon className={`${active ? "h-5 w-5 stroke-[2.2]" : "h-4 w-4 stroke-[1.75]"}`} />
              {item.badge !== undefined && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-mono font-bold px-1 ring-2 ring-[#06233d]">
                  {item.badge > 99 ? "99+" : item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Quick Search Circular Trigger Button */}
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
        className="pointer-events-auto flex items-center justify-center w-12 h-12 rounded-full bg-primary text-white border border-primary/30 shadow-marble-2 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
        aria-label="New Search"
        title="Quick Search"
      >
        <Search className="h-5 w-5 group-hover:rotate-12 transition-transform" />
      </button>
    </nav>
  );
}
