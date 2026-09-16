"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("browserpilot-theme");
    if (stored === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("browserpilot-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("browserpilot-theme", "light");
    }
  };

  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className={`h-8 w-8 p-0 text-muted-foreground border border-border/40 ${className || ""}`}
        aria-label="Toggle theme"
      >
        <span className="h-3.5 w-3.5" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={`h-8 w-8 p-0 text-muted-foreground hover:text-foreground border border-border/40 hover:border-border cursor-pointer transition-colors ${className || ""}`}
      title={isDark ? "Switch to Porcelain Light" : "Switch to Obsidian Dark"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform rotate-0" />
      ) : (
        <Moon className="h-3.5 w-3.5 text-foreground transition-transform -rotate-12" />
      )}
    </Button>
  );
}
