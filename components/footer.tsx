import Link from "next/link";
import { Bot, ShieldCheck, Terminal, Layers } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/40 text-muted-foreground">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <span className="font-bold text-foreground">BrowserPilot</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Autonomous AI web agent platform orchestrating deterministic browser automation and structured outcome verification.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Architecture & Engine
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/#architecture" className="hover:text-foreground transition-colors">
                  Playwright Sandbox Pool
                </Link>
              </li>
              <li>
                <Link href="/#reliability" className="hover:text-foreground transition-colors">
                  Zero Arbitrary Eval Policy
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
                  4-Level Progressive Disclosure
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Agent Execution
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <Link href="/app" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Task Dispatcher Workspace
                </Link>
              </li>
              <li>
                <Link href="/#architecture" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Deterministic Sandbox Engine
                </Link>
              </li>
              <li>
                <Link href="/#reliability" className="hover:text-foreground transition-colors flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Capability & Interaction Guards
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Security & Sandboxing
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Deterministic Sandboxing
              </div>
              <p className="text-[11px] leading-relaxed">
                Incognito browser contexts are ephemeral and destroyed immediately upon task termination.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <p>© 2026 BrowserPilot Platform. Built for autonomous web agent orchestration.</p>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <span>Next.js 16</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>Tailwind v4</span>
            <span>•</span>
            <span>Playwright</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
