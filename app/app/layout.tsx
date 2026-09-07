"use client";

import React from "react";
import { AppSidebar, MobileAppHeader } from "@/components/navigation/app-sidebar";
import { useUIState } from "@/components/providers/ui-state-provider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isSidebarCollapsed } = useUIState();

  return (
    <div className="min-h-screen bg-[#F6F6F4] text-foreground flex flex-col md:flex-row antialiased">
      {/* Dynamic Left Sidebar on Desktop (w-[216px] or w-[68px]) */}
      <AppSidebar />

      {/* Mobile Top Header (Hidden on Desktop) */}
      <MobileAppHeader />

      {/* Main Page Content with Animated Left Offset on Desktop */}
      <div 
        className={`flex-1 flex flex-col min-w-0 transition-[padding-left] duration-200 ease-in-out ${
          isSidebarCollapsed ? "md:pl-[68px]" : "md:pl-[216px]"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
