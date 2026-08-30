"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  ShieldCheck, 
  Activity, 
  Eye, 
  Clock, 
  Terminal, 
  Database, 
  RotateCw, 
  ArrowLeft, 
  AlertTriangle,
  Server,
  Layers,
  Cpu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [systemHealth, setSystemHealth] = useState<{
    status: string;
    databaseEngine: string;
    uptimeSeconds: number;
    memoryRssMb: number;
  } | null>(null);

  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      setIsAuthorized(false);
      return;
    }

    const userRole = (session.user as any).role;
    if (userRole === "ADMIN" || userRole === "SUPERADMIN") {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, [session, status]);

  // Fetch basic system health for header status indicator
  useEffect(() => {
    if (isAuthorized) {
      fetch("/api/admin/metrics")
        .then((res) => {
          if (res.ok) return res.json();
          if (res.status === 403) setIsAuthorized(false);
          return null;
        })
        .then((data) => {
          if (data?.system) {
            setSystemHealth(data.system);
          }
        })
        .catch(() => {});
    }
  }, [isAuthorized]);

  if (status === "loading" || isAuthorized === null) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="flex items-center gap-3 text-muted-foreground font-mono text-sm">
          <RotateCw className="h-4 w-4 animate-spin text-purple-400" />
          Verifying administrative authorization...
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-center space-y-4 shadow-xl">
          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">403 Forbidden: Access Denied</h1>
          <p className="text-sm text-muted-foreground">
            The BrowserPilot Administrative Control Plane is restricted to authorized operators and administrators.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Link href="/app">
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Return to Workspace
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: "Overview", href: "/admin", icon: Activity },
    { label: "Discovery Watches", href: "/admin/watches", icon: Eye },
    { label: "Discovery Runs", href: "/admin/runs", icon: Layers },
    { label: "Scheduler & Workers", href: "/admin/scheduler", icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Administrative Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-600 text-white shadow-md transition-transform group-hover:scale-105">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-foreground">
                    BrowserPilot
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono border-purple-500/40 text-purple-400 bg-purple-500/10 px-1.5 py-0">
                    CONTROL PLANE
                  </Badge>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground -mt-0.5">
                  Administrative Observatory
                </span>
              </div>
            </Link>

            {/* System Health Indicators */}
            {systemHealth && (
              <div className="hidden lg:flex items-center gap-2.5 pl-4 border-l border-border/60 text-xs font-mono">
                <div className="flex items-center gap-1.5 bg-muted/40 px-2 py-0.5 rounded border border-border/50">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-muted-foreground">Status:</span>
                  <span className="text-emerald-400 font-semibold">{systemHealth.status}</span>
                </div>
                <div className="flex items-center gap-1 bg-muted/40 px-2 py-0.5 rounded border border-border/50 text-muted-foreground">
                  <Database className="h-3 w-3 text-purple-400" />
                  <span>{systemHealth.databaseEngine}</span>
                </div>
              </div>
            )}
          </div>

          {/* Nav Links */}
          <nav className="hidden md:flex items-center gap-1 bg-muted/30 p-1 rounded-lg border border-border/60">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`font-mono text-xs gap-1.5 px-3 h-8 ${
                      isActive
                        ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <Link href="/app">
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 border-border/80 hover:border-primary/40">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Workspace</span>
              </Button>
            </Link>
            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-md border border-border/60 text-xs font-mono">
              <span className="text-purple-400 font-bold text-[10px] uppercase">
                {(session?.user as any)?.role || "ADMIN"}
              </span>
              <span className="text-muted-foreground max-w-[120px] truncate">
                {session?.user?.email?.split("@")[0]}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Navigation bar */}
        <div className="flex md:hidden items-center justify-around border-t border-border/60 bg-muted/20 px-2 py-1.5 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`font-mono text-[11px] gap-1 px-2 h-7 ${
                    isActive ? "text-purple-400 font-bold" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </header>

      {/* Main Admin Content Body */}
      <main className="flex-1 container mx-auto max-w-7xl p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}
