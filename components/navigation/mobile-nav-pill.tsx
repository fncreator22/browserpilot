"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Compass, 
  Bookmark, 
  Eye, 
  Bell, 
  Search,
  SlidersHorizontal
} from "lucide-react";
import { useUIState } from "@/components/providers/ui-state-provider";

export function MobileNavPill() {
  const pathname = usePathname();
  const { unreadNotificationsCount, savedCount, openCommandPalette, openProfileModal, isProfileModalOpen } = useUIState();
  const [isScrolled, setIsScrolled] = useState(false);

  // Monitor scroll for smooth elevation transition
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    {
      href: "/app",
      label: "Discover",
      icon: Compass,
      isActive: pathname === "/app" || pathname === "/app/discover",
    },
    {
      href: "/app/saved",
      label: "Saved",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      isActive: pathname === "/app/saved",
    },
    {
      href: "/app/watch",
      label: "Watch",
      icon: Eye,
      isActive: pathname === "/app/watch",
    },
    {
      href: "/app/notifications",
      label: "Alerts",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeColor: "bg-rose-500",
      isActive: pathname === "/app/notifications",
    },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation Bar"
      className="fixed bottom-4 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none md:hidden"
    >
      <div 
        className={`pointer-events-auto flex items-center justify-between gap-0.5 sm:gap-1.5 px-2.5 py-1.5 rounded-full bg-[#1F3D2E]/95 dark:bg-[#1A2620]/95 text-white backdrop-blur-md border border-white/15 transition-all duration-300 ${
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
              className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1.5 rounded-full transition-colors ${
                active 
                  ? "bg-white/20 text-white font-semibold" 
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.badge !== undefined && (
                  <span 
                    className={`absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-mono font-bold text-white ring-1 ring-[#1F3D2E] ${
                      item.badgeColor || "bg-emerald-500"
                    }`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}

        {/* Dedicated Settings Trigger Button */}
        <button
          type="button"
          onClick={() => openProfileModal("ACCOUNT")}
          className={`relative flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-1.5 rounded-full transition-colors cursor-pointer ${
            isProfileModalOpen 
              ? "bg-white/20 text-white font-semibold" 
              : "text-white/80 hover:text-white hover:bg-white/10"
          }`}
          aria-label="Settings and Profile"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight">Settings</span>
        </button>

        {/* Divider */}
        <div className="h-6 w-px bg-white/20 mx-0.5" aria-hidden="true" />

        {/* Global Command / Quick Search Trigger Button */}
        <button
          type="button"
          onClick={openCommandPalette}
          className="flex flex-col items-center justify-center min-w-[42px] min-h-[44px] px-1 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Open Command Palette and Quick Search"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5 tracking-tight font-mono">⌘K</span>
        </button>
      </div>
    </nav>
  );
}
