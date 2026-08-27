"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Bot, Terminal, History, ArrowRight, User, LogOut, LogIn, Sparkles, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfileModal } from "@/components/profile/profile-modal";
import { HistoryDrawer } from "@/components/history/history-drawer";

export function Navbar() {
  const { data: session } = useSession();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-foreground flex items-center gap-1.5">
                BrowserPilot
                <span className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-medium text-primary border border-primary/20">
                  v1.0
                </span>
              </span>
              <span className="text-[11px] font-mono text-muted-foreground -mt-1">
                Autonomous Web Agent
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
              How it Works
            </Link>
            <Link href="/#architecture" className="hover:text-foreground transition-colors">
              Architecture
            </Link>
            <Link href="/#showcase" className="hover:text-foreground transition-colors">
              Showcase
            </Link>
            <Link href="/#reliability" className="hover:text-foreground transition-colors">
              Reliability
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/app/history">
              <Button variant="ghost" size="sm" className="font-mono text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                <History className="h-3.5 w-3.5" />
                History
              </Button>
            </Link>

            <Link href="/app" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm" className="font-mono text-xs gap-1.5 text-muted-foreground">
                <Terminal className="h-3.5 w-3.5" />
                Workspace
              </Button>
            </Link>

            {session?.user ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsProfileOpen(true)}
                  className="font-mono text-xs gap-1.5 border-border/80 hover:border-primary/40 bg-muted/20"
                >
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="max-w-[110px] truncate">
                    {session.user.name || session.user.email?.split("@")[0]}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="font-mono text-xs gap-1.5 text-muted-foreground hover:text-rose-500"
                  aria-label="Sign Out"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5">
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="gap-2 shadow-sm font-medium">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* User Profile Pop-Up Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
