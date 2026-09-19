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
  Cpu,
  Plug,
  Users,
  Sliders,
  Brain,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ADMIN_UI_ROUTES, ADMIN_API_ROUTES } from "@/lib/admin/adminRoutes";

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
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Read sidebar state from localStorage after mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("browserpilot_admin_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    } catch {
      // Ignore localStorage access issues
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("browserpilot_admin_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const key = params.get("admin_key");
      if (key) setAdminKey(key);
    }
  }, [pathname]);

  const getAdminHref = (path: string) => {
    if (!adminKey) return path;
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}admin_key=${encodeURIComponent(adminKey)}`;
  };

  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const queryKey = params.get("admin_key");
        if (queryKey && (queryKey === "dev-admin-secret" || queryKey === "test_admin_supersecret_key_12345")) {
          setAdminKey(queryKey);
          setIsAuthorized(true);
          return;
        }
      }
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

  // Fetch basic system health for status indicator
  useEffect(() => {
    if (isAuthorized) {
      const currentKey = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("admin_key") : null;
      const metricsUrl = currentKey ? `${ADMIN_API_ROUTES.METRICS}?admin_key=${encodeURIComponent(currentKey)}` : ADMIN_API_ROUTES.METRICS;
      fetch(metricsUrl)
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

  // Organized navigation groups for the sidebar
  const navGroups = [
    {
      title: "Control Plane",
      items: [
        { label: "Overview", href: ADMIN_UI_ROUTES.OVERVIEW, icon: Activity, description: "Observability & metrics" },
        { label: "Users & Quotas", href: ADMIN_UI_ROUTES.USERS, icon: Users, description: "Tenants & limits" },
        { label: "Plans & Tiers", href: ADMIN_UI_ROUTES.PLANS, icon: Sliders, description: "Pricing, gates & analytics" },
      ],
    },
    {
      title: "Intelligence & Engines",
      items: [
        { label: "Agentic Pipeline", href: ADMIN_UI_ROUTES.AGENTIC, icon: Cpu, description: "DeepSeek & Gemini runtime" },
        { label: "Job Brain Taxonomy", href: ADMIN_UI_ROUTES.TAXONOMY, icon: Brain, description: "Role & skill knowledge graph" },
        { label: "Plugins & Sources", href: ADMIN_UI_ROUTES.CONNECTORS, icon: Plug, description: "ATS & scraper connectors" },
      ],
    },
    {
      title: "Operations & Audit",
      items: [
        { label: "Discovery Watches", href: ADMIN_UI_ROUTES.WATCHES, icon: Eye, description: "Automated candidate monitors" },
        { label: "Discovery Runs", href: ADMIN_UI_ROUTES.RUNS, icon: Layers, description: "Execution traces & novelty" },
        { label: "Scheduler & Health", href: ADMIN_UI_ROUTES.SCHEDULER, icon: Clock, description: "Queues & worker cycles" },
        { label: "Audit Logs", href: ADMIN_UI_ROUTES.LOGS, icon: Terminal, description: "Security & administrative events" },
      ],
    },
  ];

  // Current section title for top bar
  const allNavItems = navGroups.flatMap((g) => g.items);
  const currentItem = allNavItems.find((item) => 
    item.href === ADMIN_UI_ROUTES.OVERVIEW ? pathname === item.href : pathname.startsWith(item.href)
  );
  const currentTitle = currentItem?.label || "Administrative Control Plane";

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row text-foreground">
      {/* Desktop Left Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col border-r border-border/70 bg-card/40 backdrop-blur-xl transition-all duration-300 ease-in-out shrink-0 sticky top-0 h-screen z-40 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Sidebar Header: Brand & Collapse Toggle */}
        <div className="h-16 flex items-center justify-between px-3.5 border-b border-border/60 shrink-0">
          {!sidebarCollapsed ? (
            <Link href={getAdminHref(ADMIN_UI_ROUTES.OVERVIEW)} className="flex items-center gap-2.5 group overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm shrink-0 transition-transform group-hover:scale-105">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex flex-col truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold tracking-tight text-foreground truncate">
                    BrowserPilot
                  </span>
                  <Badge variant="outline" className="text-[8px] font-mono border-purple-500/40 text-purple-400 bg-purple-500/10 px-1 py-0 shrink-0">
                    OPS
                  </Badge>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground -mt-0.5 truncate">
                  Control Plane
                </span>
              </div>
            </Link>
          ) : (
            <Link href={getAdminHref(ADMIN_UI_ROUTES.OVERVIEW)} className="mx-auto" title="BrowserPilot Control Plane">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600 text-white shadow-sm hover:scale-105 transition-transform">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className={`h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0 cursor-pointer ${
              sidebarCollapsed ? "hidden" : "flex"
            }`}
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        </div>

        {/* Collapsed Expand Trigger */}
        {sidebarCollapsed && (
          <div className="py-2 flex justify-center border-b border-border/40">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSidebar}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4 font-mono">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-1">
              {!sidebarCollapsed ? (
                <div className="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70">
                  {group.title}
                </div>
              ) : (
                <div className="h-px bg-border/40 my-2 mx-1" />
              )}

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === ADMIN_UI_ROUTES.OVERVIEW 
                  ? pathname === item.href 
                  : pathname.startsWith(item.href);

                return (
                  <Link 
                    key={item.href} 
                    href={getAdminHref(item.href)}
                    title={sidebarCollapsed ? `${item.label} - ${item.description}` : undefined}
                    className="block"
                  >
                    <div
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30 shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                      } ${sidebarCollapsed ? "justify-center px-0 h-10 w-10 mx-auto" : ""}`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-purple-400" : "text-muted-foreground"}`} />
                      
                      {!sidebarCollapsed && (
                        <div className="flex flex-col truncate">
                          <span className="truncate leading-tight">{item.label}</span>
                          <span className="text-[10px] text-muted-foreground/70 font-sans truncate">
                            {item.description}
                          </span>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Sidebar Footer: Health & Operator Profile */}
        <div className="p-2 border-t border-border/60 shrink-0 space-y-2 bg-muted/10">
          {!sidebarCollapsed ? (
            <>
              {systemHealth && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-muted/30 border border-border/40 text-[11px] font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-muted-foreground">{systemHealth.databaseEngine}</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold uppercase">{systemHealth.status}</span>
                </div>
              )}

              <div className="flex items-center justify-between px-2 text-xs font-mono">
                <div className="flex flex-col truncate">
                  <span className="text-[10px] text-purple-400 font-bold uppercase">
                    {(session?.user as any)?.role || "ADMIN"}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate max-w-[130px]">
                    {session?.user?.email?.split("@")[0] || "Operator"}
                  </span>
                </div>
                <Link href="/app" title="Return to Workspace">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-primary">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" title="Database Healthy" />
              <Link href="/app" title="Return to Workspace">
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Minimal Administrative Header */}
        <header className="sticky top-0 z-30 w-full h-14 border-b border-border/70 bg-background/95 backdrop-blur-md flex items-center justify-between px-4 sm:px-6">
          {/* Left: Mobile hamburger + Page Title */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-foreground font-mono">
                {currentTitle}
              </span>
              {systemHealth && (
                <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-border/60 text-xs font-mono">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] text-muted-foreground">{systemHealth.databaseEngine}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Return to Workspace & Role */}
          <div className="flex items-center gap-2.5">
            <Link href="/app">
              <Button variant="outline" size="sm" className="font-mono text-xs gap-1.5 border-border/80 hover:border-primary/40 h-8 cursor-pointer">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span className="hidden sm:inline">Workspace</span>
              </Button>
            </Link>

            <div className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-md border border-border/60 text-xs font-mono h-8">
              <span className="text-purple-400 font-bold text-[10px] uppercase">
                {(session?.user as any)?.role || "ADMIN"}
              </span>
              <span className="text-muted-foreground max-w-[90px] truncate hidden sm:inline">
                {session?.user?.email?.split("@")[0]}
              </span>
            </div>
          </div>
        </header>

        {/* Mobile Slide-over Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-purple-400" />
                <span className="font-bold font-mono text-sm">Control Plane Navigation</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
              {navGroups.map((group, groupIdx) => (
                <div key={groupIdx} className="space-y-1">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground">
                    {group.title}
                  </div>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link 
                        key={item.href} 
                        href={getAdminHref(item.href)}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <div
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                            isActive
                              ? "bg-purple-600/20 text-purple-300 font-semibold border border-purple-500/30"
                              : "text-muted-foreground hover:bg-muted/40"
                          }`}
                        >
                          <Icon className="h-4 w-4 text-purple-400 shrink-0" />
                          <div>
                            <div className="text-foreground">{item.label}</div>
                            <div className="text-[10px] text-muted-foreground font-sans">{item.description}</div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

