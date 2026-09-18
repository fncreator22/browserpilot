"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeroAuthFormProps {
  isLoggedIn?: boolean;
  userEmail?: string | null;
  align?: "center" | "left";
}

export function HeroAuthForm({ 
  isLoggedIn = false, 
  userEmail,
  align = "center"
}: HeroAuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    router.push(`/login?email=${encodeURIComponent(email.trim())}`);
  };

  const isLeft = align === "left";

  if (isLoggedIn) {
    return (
      <div className={`flex flex-col gap-3 pt-2 ${isLeft ? "items-start" : "items-center"}`}>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-[#d4e0ed] shadow-marble-1 text-sm font-medium text-[#0b3558]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-600" />
          </span>
          <span>
            Welcome back{userEmail ? `, ${userEmail}` : ""} • Radar Active
          </span>
        </div>

        <Link href="/app">
          <Button
            size="lg"
            className="h-12 px-8 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-base shadow-marble-3 gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
          >
            <span>Open Workspace</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3 w-full pt-1 ${isLeft ? "items-start max-w-2xl" : "items-center max-w-xl mx-auto"}`}>
      {/* OAuth + Direct Email Input Row */}
      <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full ${isLeft ? "justify-start" : "justify-center"}`}>
        {/* Email Input Form First or Google */}
        <form onSubmit={handleSubmit} className="flex items-center w-full sm:w-auto relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your work email"
            required
            className="h-12 w-full sm:w-72 pl-4 pr-28 rounded-lg border border-[#d4e0ed] bg-white text-sm text-[#0b3558] placeholder:text-[#476788]/70 focus:outline-none focus:border-[#006bff] focus:ring-2 focus:ring-[#006bff]/20 shadow-marble-1"
          />
          <Button
            type="submit"
            size="sm"
            className="absolute right-1.5 top-1.5 h-9 px-3 rounded-md bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-xs shadow-marble-1 cursor-pointer"
          >
            <span>Sign Up</span>
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </form>

        {/* Google OAuth Button */}
        <Link href="/login" className="w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto h-12 px-4 rounded-lg bg-white hover:bg-[#f0f3f8] text-[#0b3558] border border-[#d4e0ed] font-semibold text-sm shadow-marble-1 gap-2 cursor-pointer flex items-center justify-center transition-all"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            <span>Sign in with Google</span>
          </Button>
        </Link>
      </div>

      {/* Trust Micro-Badge */}
      <p className={`text-xs font-mono text-[#476788] flex items-center gap-2 pt-1 ${isLeft ? "justify-start" : "justify-center"}`}>
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Free 14-day trial • No credit card required • Instant access</span>
      </p>
    </div>
  );
}
