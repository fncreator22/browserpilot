import Link from "next/link";
import { ShieldCheck, Cpu, ArrowLeft, KeyRound, Server, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Security & Trust Architecture | BrowserPilot",
  description: "Enterprise security standards, BYOK encryption, and automated sandboxing architecture.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/app" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-white font-mono font-bold text-xs">
              BP
            </div>
            <span className="font-sans font-bold text-sm tracking-tight">BrowserPilot</span>
          </Link>
          <Link href="/app">
            <Button variant="ghost" size="sm" className="font-mono text-xs gap-1.5 cursor-pointer">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to App
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-4xl px-4 py-12 sm:px-6 flex-1 space-y-8">
        <div className="space-y-2 border-b border-border/60 pb-6">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-mono text-xs uppercase tracking-wider">
            <ShieldCheck className="h-4 w-4" /> Zero-Trust Security Standard
          </div>
          <h1 className="text-3xl sm:text-4xl font-sans font-extrabold tracking-tight">
            Security & Trust Architecture
          </h1>
          <p className="text-xs font-mono text-muted-foreground">
            SOC 2 Type II Alignment | AES-256-GCM Envelope Encryption | Sandboxed Headless Workers
          </p>
        </div>

        {/* Security Architecture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <KeyRound className="h-4 w-4" />
              <h3 className="font-sans font-bold text-sm text-foreground">BYOK & Credential Encryption</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              All Bring-Your-Own-Key Gemini credentials and API secrets are protected using AES-256-GCM
              with authenticated ciphertext tagging. Decryption keys are managed via AWS Secrets Manager / KMS
              and never enter runtime memory logs or client-side bundles.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-2 text-cyan-600 dark:text-cyan-400">
              <Server className="h-4 w-4" />
              <h3 className="font-sans font-bold text-sm text-foreground">Sandboxed Playwright Execution</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Browser automation runs inside ephemeral containerized sandboxes with restricted network
              policies, preventing SSRF and malicious script injection while harvesting public job postings.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="h-4 w-4" />
              <h3 className="font-sans font-bold text-sm text-foreground">Timing-Safe Administrative Access</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The Administrative Control Plane utilizes timing-safe constant-time string comparisons, IP rate-limiting,
              and non-guessable cryptographic route segments to block brute-force attacks.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border/70 bg-card space-y-2">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Eye className="h-4 w-4" />
              <h3 className="font-sans font-bold text-sm text-foreground">Universal Forensic Audit Log</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every sensitive operation, search query, data export, and administrative purge generates an immutable
              audit record captured in our real-time observatory ring buffer for forensic traceability.
            </p>
          </div>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground border-t border-border/60 pt-6">
          <h2 className="text-lg font-sans font-bold text-foreground">Vulnerability Disclosure Program</h2>
          <p>
            If you discover a security vulnerability within BrowserPilot, we encourage prompt and responsible
            disclosure. Please send technical details and reproduction steps directly to:
            <code className="font-mono text-xs text-emerald-600 dark:text-emerald-400 block mt-1">security@browserpilot.internal</code>
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 text-center text-xs font-mono text-muted-foreground">
        BrowserPilot Technologies Inc. &copy; 2026. All rights reserved.
      </footer>
    </div>
  );
}
