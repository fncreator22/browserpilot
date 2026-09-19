"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Compass, 
  Bookmark, 
  Eye, 
  Bell, 
  User, 
  KeyRound, 
  Brain, 
  CreditCard, 
  ArrowRight, 
  X, 
  Command as CommandIcon, 
  SlidersHorizontal, 
  HelpCircle,
  Blocks
} from "lucide-react";
import { useUIState, type ProfileTab } from "@/components/providers/ui-state-provider";

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
      sublabel: "Autonomous multi-source job search & verification engine",
      category: "PAGES",
      icon: Compass,
      action: () => handleNavigate("/app"),
    },
    {
      id: "nav-watch",
      label: "Autonomous Watch",
      sublabel: "Continuous background monitoring and alert rules",
      category: "PAGES",
      icon: Eye,
      action: () => handleNavigate("/app/watch"),
    },
    {
      id: "nav-saved",
      label: "Saved Opportunities",
      sublabel: "Verified bookmarked roles in your workspace",
      category: "PAGES",
      icon: Bookmark,
      badge: savedCount > 0 ? savedCount : undefined,
      action: () => handleNavigate("/app/saved"),
    },
    {
      id: "nav-plans",
      label: "Subscription Plans & Quotas",
      sublabel: "Manage tier capabilities, tokens, and upgrades",
      category: "PAGES",
      icon: CreditCard,
      action: () => handleNavigate("/app/plans"),
    },
    {
      id: "nav-notifications",
      label: "Opportunity Alerts",
      sublabel: "Live status shifts, stale removals, and new matches",
      category: "PAGES",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
      badgeVariant: "destructive",
      action: () => handleNavigate("/app/notifications"),
    },
    {
      id: "nav-plugins",
      label: "Plugins Marketplace",
      sublabel: "Scraper plugins, active connections, and priority ATS sources",
      category: "PAGES",
      icon: Blocks,
      action: () => handleNavigate("/app/plugins"),
    },
    {
      id: "nav-memory-vault",
      label: "User Memory Vault & Preferences",
      sublabel: "Durable search preferences remembered by AI Brain",
      category: "PAGES",
      icon: Brain,
      action: () => handleNavigate("/app/settings/memory"),
    },
    {
      id: "set-providers",
      label: "AI Providers & Keys",
      sublabel: "Connect Puter AI or configure Gemini BYOK API keys",
      category: "SETTINGS",
      icon: KeyRound,
      action: () => handleOpenSettings("PROVIDERS"),
    },
    {
      id: "set-memory",
      label: "Career Memory Vault",
      sublabel: "Tune personalization, experience level, and skills",
      category: "SETTINGS",
      icon: Brain,
      action: () => handleOpenSettings("CAREER_MEMORY"),
    },
    {
      id: "set-plugins",
      label: "Plugins & Monitored Sources",
      sublabel: "Configure high-priority plugins and verified ATS sources",
      category: "SETTINGS",
      icon: Blocks,
      action: () => handleNavigate("/app/plugins"),
    },
    {
      id: "set-billing",
      label: "Billing & Coupons",
      sublabel: "Active subscription, usage meters, and voucher codes",
      category: "SETTINGS",
      icon: CreditCard,
      action: () => handleOpenSettings("BILLING"),
    },
    {
      id: "set-account",
      label: "Account & Profile",
      sublabel: "Manage account email, password, and security",
      category: "SETTINGS",
      icon: User,
      action: () => handleOpenSettings("ACCOUNT"),
    },
    {
      id: "set-notifications",
      label: "Notification Preferences",
      sublabel: "Configure email alerts and toast notifications",
      category: "SETTINGS",
      icon: Bell,
      action: () => handleOpenSettings("NOTIFICATIONS"),
    },
    {
      id: "set-help",
      label: "Help & Engine Details",
      sublabel: "BrowserPilot architecture overview and keyboard shortcuts",
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

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 sm:pt-20 bg-black/40 backdrop-blur-sm"
          onClick={closeCommandPalette}
          role="dialog"
          aria-modal="true"
          aria-label="BrowserPilot Command Palette"
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.98, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border/80 bg-card text-foreground shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-border/80 px-4 py-3.5 bg-muted/30">
          <Search className="h-5 w-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search opportunities or jump to pages and settings..."
            className="w-full bg-transparent text-sm sm:text-base font-sans text-foreground placeholder:text-muted-foreground focus:outline-none"
            aria-label="Search or enter command"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors cursor-pointer"
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="kbd kbd-xs font-mono px-2 py-0.5 rounded bg-muted/80 text-muted-foreground border border-border/60">
            ESC
          </kbd>
        </div>

        {/* Results / Commands List */}
        <div 
          ref={listRef}
          className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/30"
          role="listbox"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm font-sans text-muted-foreground">
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
                  className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected 
                      ? isSearchDirect 
                        ? "bg-emerald-600 text-white"
                        : "bg-emerald-600/10 dark:bg-slate-800 text-foreground border border-emerald-500/20 dark:border-slate-700" 
                      : "hover:bg-muted/50 text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isSelected && isSearchDirect
                        ? "bg-white/20 text-white"
                        : isSelected
                        ? "bg-emerald-600 text-white dark:bg-white/10 dark:text-white"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="h-4 w-4 stroke-[1.75]" />
                    </div>
                    <div className="min-w-0 truncate">
                      <div className="flex items-center gap-2 font-sans font-medium text-sm">
                        <span className="truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span 
                            className={`badge badge-sm font-mono text-[10px] ${
                              item.badgeVariant === "destructive" ? "badge-error text-white" : "badge-neutral"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.sublabel && (
                        <p className={`text-xs truncate font-sans ${isSelected && isSearchDirect ? "text-white/80" : "text-muted-foreground"}`}>
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
                      <span className="text-[10px] font-mono uppercase text-muted-foreground hidden sm:inline-block px-1.5 py-0.5 rounded bg-muted/60">
                        {item.category}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Info */}
        <div className="flex items-center justify-between border-t border-border/80 px-4 py-2.5 bg-muted/30 text-[11px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <span>Use <kbd className="kbd kbd-xs bg-card border border-border/70 text-foreground">↑</kbd> <kbd className="kbd kbd-xs bg-card border border-border/70 text-foreground">↓</kbd> to navigate</span>
            <span><kbd className="kbd kbd-xs bg-card border border-border/70 text-foreground">↵</kbd> to select</span>
          </div>
          <div className="flex items-center gap-1 text-primary font-semibold">
            <CommandIcon className="h-3 w-3 stroke-[1.75]" />
            <span>BrowserPilot Hub</span>
          </div>
        </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
  );
}

