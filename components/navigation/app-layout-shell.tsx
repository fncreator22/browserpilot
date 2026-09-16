import React from "react";
import { TopNavIsland } from "@/components/navigation/top-nav-island";
import { MobileNavPill } from "@/components/navigation/mobile-nav-pill";

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Top Floating Navigation Island */}
      <TopNavIsland />

      {/* Main Content Viewport - Full Width Fluid Canvas */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-8">
        {children}
      </main>

      {/* Mobile Floating Bottom Navigation Dock (< 1024px, lg:hidden) */}
      <MobileNavPill />
    </div>
  );
}

