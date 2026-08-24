"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { 
  Bot, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  Sparkles, 
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password: password.trim(),
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setErrorMsg(res.error);
      } else if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "An error occurred during authentication.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail("dev@browserpilot.ai");
    setPassword("BrowserPilot2026!");
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-5">
      {/* GitHub OAuth Button */}
      <Button
        variant="outline"
        onClick={() => signIn("github", { callbackUrl })}
        className="w-full font-mono text-xs gap-2.5 h-10 border-border/80 hover:bg-muted font-semibold shadow-xs"
      >
        <GithubIcon className="h-4 w-4" />
        Continue with GitHub
      </Button>

      <div className="relative flex items-center justify-center">
        <div className="border-t border-border/60 w-full" />
        <span className="bg-card px-3 text-[11px] font-mono text-muted-foreground uppercase">
          Or with email
        </span>
      </div>

      {/* Credentials Form */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Email Address
          </label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="developer@example.com"
            className="h-10 text-xs font-mono"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Password
            </label>
          </div>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••••"
            className="h-10 text-xs font-mono"
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading || !email.trim() || !password.trim()}
          className="w-full h-10 font-semibold gap-2 shadow-md"
        >
          {isLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Authenticating...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {/* Quick Demo Fill */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={handleFillDemo}
            className="text-[11px] font-mono text-primary hover:underline inline-flex items-center gap-1"
          >
            <Sparkles className="h-3 w-3" /> Fill Developer Test Credentials
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground p-4 selection:bg-primary/20 selection:text-primary">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="w-full max-w-md space-y-6"
      >
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-105">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-foreground font-mono">
              BrowserPilot
            </span>
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            Sign in to your account
          </h1>
          <p className="text-xs text-muted-foreground">
            Access your autonomous browser worker sessions and execution logs
          </p>
        </div>

        {/* Suspense Wrapper for Next.js searchParams */}
        <Suspense fallback={
          <div className="rounded-2xl border border-border/80 bg-card p-12 text-center">
            <RefreshCw className="h-6 w-6 text-primary animate-spin mx-auto" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          JWT Sessions • Sandboxed Isolations
        </div>
      </motion.div>
    </div>
  );
}
