"use client";

import Link from "next/link";
import { Radio, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LandingNavbarProps {
  isLoggedIn?: boolean;
}

export function LandingNavbar({ isLoggedIn = false }: LandingNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#d4e0ed] bg-[#f8f9fb]/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center justify-between px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#006bff] text-white shadow-marble-1 transition-transform group-hover:scale-105">
            <Radio className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-sans text-lg font-bold tracking-tight text-[#0b3558]">
              BrowserPilot
            </span>
            <span className="text-[10px] font-mono font-medium text-[#476788] -mt-1 tracking-wider uppercase">
              Opportunity Radar
            </span>
          </div>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1">
          <a
            href="#features"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#476788] hover:text-[#0b3558] hover:bg-[#f0f3f8] transition-colors"
          >
            Features
          </a>
          <a
            href="#radar-engine"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#476788] hover:text-[#0b3558] hover:bg-[#f0f3f8] transition-colors"
          >
            Radar Engine
          </a>
          <a
            href="#verified-portals"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#476788] hover:text-[#0b3558] hover:bg-[#f0f3f8] transition-colors"
          >
            Verified Portals
          </a>
          <a
            href="#pricing"
            className="px-3.5 py-1.5 rounded-lg text-sm font-medium text-[#476788] hover:text-[#0b3558] hover:bg-[#f0f3f8] transition-colors"
          >
            Pricing
          </a>
        </nav>

        {/* Action Button Cluster */}
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link href="/app">
              <Button
                size="sm"
                className="h-9 px-4 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-sm shadow-marble-1 gap-1.5 cursor-pointer"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden sm:inline-flex px-3 py-1.5 text-sm font-medium text-[#0b3558] hover:text-[#006bff] transition-colors"
              >
                Sign In
              </Link>
              <Link href="/login">
                <Button
                  size="sm"
                  className="h-9 px-4 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-sm shadow-marble-1 gap-1.5 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Get Started Free</span>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
