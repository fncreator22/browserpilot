import Link from "next/link";
import { ShieldCheck, Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy | BrowserPilot",
  description: "Privacy practices, GDPR/CCPA rights, and credential protection at BrowserPilot.",
};

export default function PrivacyPolicyPage() {
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
            <Lock className="h-4 w-4" /> Data Governance & Security
          </div>
          <h1 className="text-3xl sm:text-4xl font-sans font-extrabold tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-xs font-mono text-muted-foreground">
            Last Updated: September 16, 2026 | Compliant with GDPR, CCPA, and Global Privacy Standards
          </p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">1. Introduction & Principles</h2>
          <p>
            At BrowserPilot, we believe privacy is an intrinsic engineering requirement, not an afterthought.
            We design our systems to minimize data collection, encrypt credentials using military-grade standards
            (AES-256-GCM), and provide total user control over their personal telemetry.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">2. Information We Collect</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong className="text-foreground">Account Identification:</strong> Your name, email address, and hashed authentication secrets.</li>
            <li><strong className="text-foreground">Bring-Your-Own-Key (BYOK):</strong> If you supply your personal Gemini API key, it is encrypted immediately upon submission with AES-256-GCM and stored as an opaque ciphertext blob. It is never logged in plaintext.</li>
            <li><strong className="text-foreground">System Audit Logs:</strong> Low-level UI interaction telemetry (such as button clicks and navigation routes) recorded in our in-memory audit ring buffer for system observability and debugging.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">3. How We Use Information</h2>
          <p>
            Your information is exclusively utilized to:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Execute autonomous search pipelines and personalize discovery criteria according to your saved preferences.</li>
            <li>Enforce quota boundaries and authenticate session access.</li>
            <li>Deliver real-time job alerts and watch notifications via in-app feeds.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">4. Anonymization & Account Deletion Protocol</h2>
          <p>
            You may request complete account deletion at any time from your Account Settings. Under our
            automated Anonymized Account Service:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Your password hashes, BYOK tokens, and personal names are permanently destroyed.</li>
            <li>Your account record is converted into an anonymous tombstone identifier (e.g. <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">anon_deleted_xxxx</code>).</li>
            <li>Your former credentials can never be authenticated or restored again.</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">5. Contact Our Data Protection Officer</h2>
          <p>
            For GDPR data subject requests, CCPA inquiries, or security disclosures, please contact:
            <code className="font-mono text-xs text-emerald-600 dark:text-emerald-400 block mt-1">dpo@browserpilot.internal</code>
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
