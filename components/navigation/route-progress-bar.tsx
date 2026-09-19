"use client";

import React, { useEffect, useState, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Complete progress on route change
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept link clicks to start progress bar early
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        !target.hasAttribute("download") &&
        target.getAttribute("target") !== "_blank"
      ) {
        // Only trigger if going to a different route
        const currentFull = window.location.pathname + window.location.search;
        if (href !== currentFull) {
          setIsNavigating(true);
          setProgress(25);

          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setProgress((prev) => {
              if (prev >= 85) {
                if (timerRef.current) clearInterval(timerRef.current);
                return prev;
              }
              return prev + (prev < 50 ? 15 : 8);
            });
          }, 120);
        }
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => {
      document.removeEventListener("click", handleClick, { capture: true });
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress}
      className="fixed top-0 left-0 right-0 h-[2.5px] z-[9999] pointer-events-none overflow-hidden bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-200 ease-out shadow-[0_0_8px_rgba(16,185,129,0.7)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transition: progress === 100 ? "all 300ms ease-out" : "width 200ms ease-out",
        }}
      />
    </div>
  );
}
