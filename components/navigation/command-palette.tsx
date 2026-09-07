"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  Compass, 
  Bookmark, 
  Eye, 
  Layers, 
  History, 
  Bell, 
  User, 
  KeyRound, 
  Brain, 
  CreditCard, 
  ArrowRight, 
  X,
  Sparkles,
  Command as CommandIcon,
  SlidersHorizontal,
  HelpCircle
} from "lucide-react";
import { useUIState, type ProfileTab } from "@/components/providers/ui-state-provider";
import { Badge } from "@/components/ui/badge";

interface CommandItem {
  id: string;
  label: string;
  sublabel?: string;
  category: "PAGES" | "SETTINGS" | "SEARCH";
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive";
  action: () => void;
}

export function CommandPalette() {
  const router = useRouter();
  const { 
    isCommandPaletteOpen, 
    closeCommandPalette, 
    openProfileModal, 
    unreadNotificationsCount, 
    savedCount 
  } = useUIState();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isCommandPaletteOpen]);

  const handleNavigate = (path: string) => {
    closeCommandPalette();
    router.push(path);
  };

  const handleOpenSettings = (tab: ProfileTab) => {
    closeCommandPalette();
    openProfileModal(tab);
  };

  const handleDirectSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    closeCommandPalette();
    router.push(`/app?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  // Base navigation and settings actions
  const allItems: CommandItem[] = [
    {
      id: "nav-discover",
      label: "Discover Opportunities",
      sublabel: "Autonomous search & verification engine",
      category: "PAGES",
      icon: Compass,
      action: () => handleNavigate("/app"),
    },
    {
      id: "nav-saved",
      label: "Saved Opportunities",
      sublabel: "Verified bookmarked listings",
      category: "PAGES",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      badgeVariant: "secondary",
      action: () => handleNavigate("/app/saved"),
    },
    {
      id: "nav-watch",
      label: "Autonomous Watches",
      sublabel: "Continuous headless monitoring rules",
      category: "PAGES",
      icon: Eye,
      action: () => handleNavigate("/app/watch"),
    },
    {
      id: "nav-notifications",
      label: "Opportunity Alerts",
      sublabel: "Live status changes and new matches",
      category: "PAGES",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeVariant: "destructive",
      action: () => handleNavigate("/app/notifications"),
    },
    {
      id: "nav-history",
      label: "Search & Session History",
      sublabel: "Past queries, runs, and artifacts",
      category: "PAGES",
      icon: History,
      action: () => handleNavigate("/app/history"),
    },
    {
      id: "set-account",
      label: "Account & Security",
      sublabel: "Manage credentials, password, and profile",
      category: "SETTINGS",
      icon: User,
      action: () => handleOpenSettings("ACCOUNT"),
    },
    {
      id: "set-providers",
      label: "AI Providers & Keys",
      sublabel: "Configure Gemini API keys or Puter tokens",
      category: "SETTINGS",
      icon: KeyRound,
      action: () => handleOpenSettings("PROVIDERS"),
    },
    {
      id: "set-connectors",
      label: "Data Connectors",
      sublabel: "Configure monitored ATS platforms and sources",
      category: "SETTINGS",
      icon: SlidersHorizontal,
      action: () => handleOpenSettings("CONNECTORS"),
    },
    {
      id: "set-memory",
      label: "Career Memory & Preferences",
      sublabel: "Tune personalization, roles, and skill filters",
      category: "SETTINGS",
      icon: Brain,
      action: () => handleOpenSettings("CAREER_MEMORY"),
    },
    {
      id: "set-billing",
      label: "Billing & Plans",
      sublabel: "Subscription tier, quotas, and coupon redemption",
      category: "SETTINGS",
      icon: CreditCard,
      action: () => handleOpenSettings("BILLING"),
    },
    {
      id: "set-notifications",
      label: "Notification Preferences",
      sublabel: "Alert frequency, digests, and toast preferences",
      category: "SETTINGS",
      icon: Bell,
      action: () => handleOpenSettings("NOTIFICATIONS"),
    },
    {
      id: "set-help",
      label: "Help & Learn More",
      sublabel: "Architecture overview, shortcuts, and support",
      category: "SETTINGS",
      icon: HelpCircle,
      action: () => handleOpenSettings("HELP"),
    },
  ];

  // Filter items based on query
  const trimmedQuery = query.trim().toLowerCase();
  const searchDirectItem: CommandItem | null = trimmedQuery
    ? {
        id: "search-direct",
        label: `Search for "${query}"`,
        sublabel: "Execute live multi-source discovery directly",
        category: "SEARCH",
        icon: Search,
        action: () => handleDirectSearch(query),
      }
    : null;

  const filteredItems: CommandItem[] = [
    ...(searchDirectItem ? [searchDirectItem] : []),
    ...allItems.filter((item) => {
      if (!trimmedQuery) return true;
      return (
        item.label.toLowerCase().includes(trimmedQuery) ||
        (item.sublabel && item.sublabel.toLowerCase().includes(trimmedQuery))
      );
    }),
  ];

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCommandPalette();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      } else if (trimmedQuery) {
        handleDirectSearch(query);
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIndex]);

  if (!isCommandPaletteOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeCommandPalette}
      role="dialog"
      aria-modal="true"
      aria-label="BrowserPilot Command Palette"
    >
      <div 
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-card shadow-2xl transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3 bg-[#F6F6F4]/50 dark:bg-[#121714]">
          <Search className="h-5 w-5 text-[#1F3D2E] dark:text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a search query or jump to page/settings..."
            className="w-full bg-transparent text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search or enter command"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md focus-visible:ring-2 focus-visible:ring-[#1F3D2E]"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-border bg-muted/70 px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground">
            <span className="text-xs">ESC</span>
          </kbd>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/30"
          role="listbox"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No matching pages or actions found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              const isSearchDirect = item.category === "SEARCH";

              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected 
                      ? isSearchDirect 
                        ? "bg-[#1F3D2E] text-white"
                        : "bg-[#1F3D2E]/10 dark:bg-emerald-950/40 text-foreground border border-[#1F3D2E]/20" 
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-md shrink-0 ${
                      isSelected && isSearchDirect
                        ? "bg-white/20 text-white"
                        : isSelected
                        ? "bg-[#1F3D2E] text-white dark:bg-emerald-500 dark:text-emerald-950"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2 font-sans font-medium text-sm">
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <Badge 
                            variant={item.badgeVariant || "secondary"}
                            className="text-[10px] font-mono px-1.5 py-0 h-4"
                          >
                            {item.badge}
                          </Badge>
                        )}
                      </div>
                      {item.sublabel && (
                        <p className={`text-xs truncate ${isSelected && isSearchDirect ? "text-white/80" : "text-muted-foreground"}`}>
                          {item.sublabel}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSearchDirect ? (
                      <span className="text-xs font-mono bg-white/20 px-2 py-0.5 rounded text-white flex items-center gap-1">
                        Enter <ArrowRight className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline-block">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/80 px-4 py-2 bg-[#F6F6F4]/50 dark:bg-[#121714] text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="font-semibold text-foreground">↑</kbd> <kbd className="font-semibold text-foreground">↓</kbd> to navigate</span>
            <span><kbd className="font-semibold text-foreground">Enter</kbd> to select</span>
          </div>
          <div className="flex items-center gap-1 text-[#1F3D2E] dark:text-emerald-400 font-semibold">
            <CommandIcon className="h-3 w-3" />
            <span>BrowserPilot Hub</span>
          </div>
        </div>
      </div>
    </div>
  );
}
