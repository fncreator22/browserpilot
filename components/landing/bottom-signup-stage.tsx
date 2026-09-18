"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Sparkles, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomSignupStageProps {
  isLoggedIn?: boolean;
  userEmail?: string | null;
}

export function BottomSignupStage({ isLoggedIn = false, userEmail }: BottomSignupStageProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    router.push(`/login?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <section className="py-20 lg:py-28 bg-[#0b3558] text-white relative overflow-hidden">
      {/* Volumetric background gradients */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[#006bff]/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-[#004eba]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mx-auto max-w-[1000px] px-6 lg:px-8 text-center space-y-8">
        {/* Display Headline */}
        <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight">
          Never miss your next career breakthrough.
        </h2>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-[#a6bbd1] max-w-2xl mx-auto leading-relaxed">
          Continuous radar scans, verified hiring managers, and zero ghost listings. Set up your autonomous search agent in less than two minutes.
        </p>

        {/* Dynamic Auth Action */}
        <div className="pt-4 max-w-xl mx-auto">
          {isLoggedIn ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <div className="text-sm text-[#a6bbd1]">
                Signed in as <strong className="text-white">{userEmail || "Active Member"}</strong>
              </div>
              <Link href="/app">
                <Button
                  size="lg"
                  className="h-12 px-8 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-base shadow-marble-3 gap-2 cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  <span>Open Discovery Workspace</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Email Form */}
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your work email"
                  required
                  className="h-12 w-full sm:w-80 px-4 rounded-lg bg-white/10 border border-white/20 text-sm text-white placeholder:text-[#a6bbd1]/70 focus:outline-none focus:border-[#0099ff] focus:ring-2 focus:ring-[#0099ff]/30 backdrop-blur-md"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full sm:w-auto h-12 px-6 rounded-lg bg-[#006bff] hover:bg-[#006bff]/90 text-white font-semibold text-sm shadow-marble-3 gap-2 cursor-pointer transition-all hover:scale-[1.02]"
                >
                  <span>Start Free</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>

              {/* Alternative Google Sign In */}
              <div className="flex items-center justify-center gap-3 text-xs text-[#a6bbd1] pt-1">
                <span>Or</span>
                <Link
                  href="/login"
                  className="text-white hover:text-[#0099ff] font-semibold underline underline-offset-4 transition-colors"
                >
                  Sign up with Google
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Micro-telemetry & trust badges */}
        <div className="flex flex-wrap items-center justify-center gap-6 pt-6 text-xs text-[#a6bbd1]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-[#0099ff]" />
            Free 14-day full radar trial
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-[#0099ff]" />
            No credit card required
          </span>
          <span className="flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-[#0099ff]" />
            Instant webhook configuration
          </span>
        </div>
      </div>
    </section>
  );
}
