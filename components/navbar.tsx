"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { 
  Bot, 
  Compass, 
  Eye, 
  Bookmark, 
  History, 
  Bell, 
  ShieldCheck, 
  User, 
  LogOut, 
  LogIn, 
  ArrowRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProfileModal } from "@/components/profile/profile-modal";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!session?.user) return;
    async function checkNotifications() {
      try {
        const res = await fetch("/api/notifications?unreadOnly=true");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount || 0);
        }
      } catch {}
    }
    checkNotifications();
  }, [session?.user]);

  const isAuthWorkspace = pathname?.startsWith("/app") || pathname?.startsWith("/admin");

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo Brand */}
          <Link href={session?.user ? "/app" : "/"} className="flex items-center gap-2.5 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground transition-transform group-hover:scale-105">
              <Bot className="h-4 w-4" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground">
                BrowserPilot
              </span>
              <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
                Discovery & Monitoring
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          {session?.user ? (
            <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1">
              <Link href="/app">
                <Button
                  variant={pathname === "/app" || pathname === "/app/discover" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 font-mono text-xs gap-1.5 cursor-pointer ${
                    pathname === "/app" || pathname === "/app/discover" ? "bg-primary/10 text-primary font-semibold border border-primary/20" : "text-muted-foreground"
                  }`}
                >
                  <Compass className="h-3.5 w-3.5" />
                  Discover
                </Button>
              </Link>

              <Link href="/app/watch">
                <Button
                  variant={pathname === "/app/watch" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 font-mono text-xs gap-1.5 cursor-pointer ${
                    pathname === "/app/watch" ? "bg-primary/10 text-primary font-semibold border border-primary/20" : "text-muted-foreground"
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Watch
                </Button>
              </Link>

              <Link href="/app/saved">
                <Button
                  variant={pathname === "/app/saved" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 font-mono text-xs gap-1.5 cursor-pointer ${
                    pathname === "/app/saved" ? "bg-primary/10 text-primary font-semibold border border-primary/20" : "text-muted-foreground"
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Saved
                </Button>
              </Link>

              <Link href="/app/history">
                <Button
                  variant={pathname === "/app/history" ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 font-mono text-xs gap-1.5 cursor-pointer ${
                    pathname === "/app/history" ? "bg-primary/10 text-primary font-semibold border border-primary/20" : "text-muted-foreground"
                  }`}
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Button>
              </Link>
            </nav>
          ) : (
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
          )}

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {session?.user && (
              <Link href="/app/notifications">
                <Button
                  variant={pathname === "/app/notifications" ? "secondary" : "ghost"}
                  size="sm"
                  className="relative font-mono text-xs gap-1.5 text-muted-foreground hover:text-foreground px-2.5 cursor-pointer"
                  title={unreadCount > 0 ? `${unreadCount} unread lifecycle alerts` : "Lifecycle Alerts"}
                  aria-label="Notifications"
                >
                  <Bell className={`h-3.5 w-3.5 ${unreadCount > 0 ? "text-amber-500 animate-pulse" : ""}`} />
                  {unreadCount > 0 && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-black">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}

            {session?.user && ((session.user as any).role === "ADMIN" || (session.user as any).role === "SUPERADMIN") && (
              <Link href="/admin" className="hidden sm:inline-flex">
                <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 border-purple-500/40 text-purple-400 hover:bg-purple-500/10 bg-purple-500/5 cursor-pointer">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin
                </Button>
              </Link>
            )}

            {session?.user ? (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsProfileOpen(true)}
                  className="font-mono text-xs gap-1.5 border-border/80 hover:border-primary/40 bg-muted/20 cursor-pointer max-w-[130px] truncate"
                >
                  <User className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">
                    {session.user.name || session.user.email?.split("@")[0]}
                  </span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="font-mono text-xs gap-1 text-muted-foreground hover:text-rose-500 cursor-pointer hidden sm:inline-flex"
                  aria-label="Sign Out"
                  title="Sign Out"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>

                {/* Mobile Menu Trigger */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Toggle Navigation Menu"
                >
                  {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 cursor-pointer">
                    <LogIn className="h-3.5 w-3.5" />
                    Sign In
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button size="sm" className="gap-2 shadow-sm font-medium cursor-pointer">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {isMobileMenuOpen && session?.user && (
          <div className="md:hidden border-t border-border/60 bg-background/95 backdrop-blur-md px-4 py-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 pb-2">
              <Link href="/app" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant={pathname === "/app" ? "secondary" : "outline"}
                  size="sm"
                  className="w-full justify-start font-mono text-xs gap-2"
                >
                  <Compass className="h-3.5 w-3.5" />
                  Discover
                </Button>
              </Link>
              <Link href="/app/watch" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant={pathname === "/app/watch" ? "secondary" : "outline"}
                  size="sm"
                  className="w-full justify-start font-mono text-xs gap-2"
                >
                  <Eye className="h-3.5 w-3.5" />
                  Watch
                </Button>
              </Link>
              <Link href="/app/saved" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant={pathname === "/app/saved" ? "secondary" : "outline"}
                  size="sm"
                  className="w-full justify-start font-mono text-xs gap-2"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Saved
                </Button>
              </Link>
              <Link href="/app/history" onClick={() => setIsMobileMenuOpen(false)}>
                <Button
                  variant={pathname === "/app/history" ? "secondary" : "outline"}
                  size="sm"
                  className="w-full justify-start font-mono text-xs gap-2"
                >
                  <History className="h-3.5 w-3.5" />
                  History
                </Button>
              </Link>
              <Link href="/app/notifications" onClick={() => setIsMobileMenuOpen(false)} className="col-span-2">
                <Button
                  variant={pathname === "/app/notifications" ? "secondary" : "outline"}
                  size="sm"
                  className="w-full justify-start font-mono text-xs gap-2"
                >
                  <Bell className="h-3.5 w-3.5" />
                  <span>Alerts & Notifications</span>
                  {unreadCount > 0 && (
                    <Badge variant="outline" className="ml-auto text-[10px] font-mono bg-amber-500/15 text-amber-600 border-amber-500/30">
                      {unreadCount} new
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>

            {((session.user as any).role === "ADMIN" || (session.user as any).role === "SUPERADMIN") && (
              <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                <Button variant="outline" size="sm" className="w-full justify-start font-mono text-xs gap-2 border-purple-500/40 text-purple-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Admin Control Plane
                </Button>
              </Link>
            )}

            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground truncate">
                {session.user.email}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="font-mono text-xs text-rose-500 gap-1"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* User Profile Pop-Up Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
