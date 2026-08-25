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
  ShieldCheck,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
        email: email.trim().toLowerCase(),
        password: password.trim(),
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setErrorMsg("Invalid email or password");
      } else if (res?.ok) {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setErrorMsg("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-5">
      {/* Credentials Form */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        {errorMsg && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 font-mono">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />
            Email Address
          </label>
          <Input
            id="email"
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
            <label htmlFor="password" className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
              <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
              Password
            </label>
          </div>
          <Input
            id="password"
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
          className="w-full h-10 font-semibold gap-2 shadow-md mt-2"
        >
          {isLoading ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Signing in...
            </>
          ) : (
            <>
              Sign In
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <div className="pt-2 text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
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
