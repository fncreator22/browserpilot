"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";
import { 
  Bot, 
  Mail, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (cleanPassword.length < 8) {
      setErrorMsg("Password must be at least 8 characters long.");
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Call registration API
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      const data = await regRes.json().catch(() => ({}));

      if (!regRes.ok) {
        setErrorMsg(data.message || "Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      // 2. Immediately sign in on successful registration (no separate "go log in" step)
      const signinRes = await signIn("credentials", {
        email: cleanEmail,
        password: cleanPassword,
        redirect: false,
        callbackUrl: "/app",
      });

      if (signinRes?.error) {
        setErrorMsg("Account created, but automatic sign-in failed. Please log in.");
        router.push("/login");
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || "An unexpected error occurred during signup.");
    } finally {
      setIsLoading(false);
    }
  };

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
            Create your account
          </h1>
          <p className="text-xs text-muted-foreground">
            Sign up to deploy autonomous browser workers and view execution telemetry
          </p>
        </div>

        {/* Signup Card */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-xl backdrop-blur-xl space-y-5">
          <form onSubmit={handleSignupSubmit} className="space-y-4">
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
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                Password (min 8 characters)
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-10 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center gap-1.5 font-mono">
                <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                Confirm Password
              </label>
              <Input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="h-10 text-xs font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email.trim() || !password.trim() || !confirmPassword.trim()}
              className="w-full h-10 font-semibold gap-2 shadow-md mt-2"
            >
              {isLoading ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating Account...
                </>
              ) : (
                <>
                  Sign Up & Continue
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>

            <div className="pt-2 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        </div>

        {/* Security Footer Notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground font-mono">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          Bcrypt Hashed • Minimal Data Policy
        </div>
      </motion.div>
    </div>
  );
}
