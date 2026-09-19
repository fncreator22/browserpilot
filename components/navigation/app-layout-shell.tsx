"use client";

import React from "react";
import { MobileNavPill } from "@/components/navigation/mobile-nav-pill";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { useUIState } from "@/components/providers/ui-state-provider";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useUIState();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Desktop Persistent Collapsible Sidebar */}
      <AppSidebar />

      {/* Main Content Viewport and Header - Adjusted for Desktop Sidebar Width */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-[padding-left] duration-200 ease-in-out ${
          isSidebarCollapsed ? "lg:pl-[68px]" : "lg:pl-[216px]"
        }`}
      >
        {/* Main Content Viewport */}
        <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Dock (< 1024px, lg:hidden) */}
      <MobileNavPill />
    </div>
  );
}
