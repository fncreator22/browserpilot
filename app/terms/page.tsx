import Link from "next/link";
import { ShieldCheck, FileText, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Terms of Service | BrowserPilot",
  description: "Terms and conditions governing the use of BrowserPilot autonomous discovery services.",
};

export default function TermsOfServicePage() {
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
            <FileText className="h-4 w-4" /> Legal Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-sans font-extrabold tracking-tight">
            Terms of Service
          </h1>
          <p className="text-xs font-mono text-muted-foreground">
            Last Updated: September 16, 2026 | Effective immediately upon account registration
          </p>
        </div>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">1. Acceptance of Terms</h2>
          <p>
            By accessing or using BrowserPilot, whether via web application, APIs, or automated integrations,
            you agree to be bound by these Terms of Service. If you do not agree to these terms, do not access
            or use the service.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">2. Description of Service</h2>
          <p>
            BrowserPilot provides autonomous web agent capabilities, opportunity discovery intelligence,
            sandboxed browser workflows via Playwright, and AI-assisted candidate and market matching. You
            acknowledge that job availability, third-party ATS listings, and external company contacts are
            derived from publicly accessible sources and indexed autonomously.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">3. User Responsibilities & Acceptable Use</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li>You must provide accurate account information and keep your credentials secure.</li>
            <li>You agree not to use the service to bypass authentication mechanisms, conduct unauthorized penetration tests, or harvest confidential third-party data without consent.</li>
            <li>You are solely responsible for ensuring your outreach communications comply with applicable anti-spam legislation (such as CAN-SPAM, GDPR, and CASL).</li>
          </ul>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">4. Subscriptions, Billing & Cancellations</h2>
          <p>
            Paid subscription plans (e.g. Starter, Professional, Enterprise) are billed on a recurring monthly
            or annual basis. All transactions are securely processed through PCI-DSS Level 1 compliant
            gateways (Stripe and Razorpay). You may cancel your subscription at any time via your Account Settings.
            Cancellations take effect at the conclusion of your current active billing cycle.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">5. Anonymized Account Deletion</h2>
          <p>
            Under our Privacy and GDPR compliance standards, you have the right to permanent account erasure.
            When you initiate account deletion from your profile, your credentials, passwords, and personal
            identifying information (PII) are permanently destroyed and your history is re-mapped to an anonymous
            system identifier.
          </p>
        </section>

        <section className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          <h2 className="text-lg font-sans font-bold text-foreground">6. Limitation of Liability</h2>
          <p>
            BrowserPilot and its operators shall not be liable for indirect, incidental, special, consequential,
            or punitive damages resulting from your access to or inability to access the service, or any content
            obtained from third-party sites indexed by our autonomous discovery agents.
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
