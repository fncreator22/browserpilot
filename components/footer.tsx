import Link from "next/link";
import { 
  Bot, 
  ShieldCheck, 
  Terminal, 
  Layers, 
  Star, 
  ExternalLink,
  Sparkles,
  Heart
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

function GithubIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LinkedInIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
    </svg>
  );
}

function XTwitterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border bg-card/50 text-muted-foreground transition-colors">
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Brand & Creator Bio */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <span className="font-bold text-base text-foreground tracking-tight">BrowserPilot</span>
                <span className="ml-2 text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">v0.1.0</span>
              </div>
            </div>
            
            <p className="text-xs leading-relaxed text-muted-foreground max-w-sm">
              Autonomous AI web agent platform orchestrating deterministic browser automation, Playwright sandboxing, and verifiable task outcomes.
            </p>

            {/* GitHub Star & Social Proof Badge */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <a
                href="https://github.com/fncreator22/browserpilot"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-lg border border-border bg-background/80 hover:bg-accent hover:text-foreground transition-all shadow-2xs group"
              >
                <GithubIcon className="h-3.5 w-3.5" />
                <span className="font-medium">Star on GitHub</span>
                <span className="inline-flex items-center gap-0.5 text-amber-500 font-semibold ml-1">
                  <Star className="h-3 w-3 fill-amber-500" />
                </span>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity ml-0.5" />
              </a>

              <a
                href="https://github.com/fncreator22/browserpilot/fork"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-mono rounded-lg border border-border/80 bg-background/50 hover:bg-accent hover:text-foreground transition-all text-muted-foreground"
              >
                <Layers className="h-3 w-3" />
                <span>Fork & Build</span>
              </a>
            </div>

            {/* Creator Social Handles */}
            <div className="pt-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground/80 block mb-2">
                Connect with Creator
              </span>
              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/fncreator22"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub Profile"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background/60 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                >
                  <GithubIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://linkedin.com/in/fncreator22"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn Profile"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background/60 hover:bg-blue-500/10 hover:text-blue-500 hover:border-blue-500/30 transition-colors"
                >
                  <LinkedInIcon className="h-4 w-4" />
                </a>
                <a
                  href="https://x.com/fncreator22"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter) Profile"
                  className="h-8 w-8 flex items-center justify-center rounded-lg border border-border bg-background/60 hover:bg-sky-500/10 hover:text-sky-500 hover:border-sky-500/30 transition-colors"
                >
                  <XTwitterIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: Architecture & Engine */}
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
              <li>
                <Link href="/#showcase" className="hover:text-foreground transition-colors">
                  Interactive State Catalog
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Agent Execution */}
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

          {/* Column 4: Security & Sandboxing */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3 font-mono">
              Security & Sandboxing
            </h4>
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 text-foreground font-medium">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Ephemeral Sandboxing
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Browser contexts are strictly incognito, isolated per tenant, and destroyed upon task termination.
              </p>
              <div className="pt-1">
                <Badge variant="outline" className="text-[10px] font-mono py-0.5 px-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                  Zero-Bypass Policy
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Tech Stack */}
        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-center sm:text-left">
            <span>© 2026 BrowserPilot Platform. Built with</span>
            <Heart className="h-3 w-3 text-rose-500 fill-rose-500 inline-block" />
            <span>by <strong className="text-foreground font-medium">fncreator22</strong>.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 font-mono text-[11px] text-muted-foreground/80">
            <span>Next.js 16</span>
            <span>•</span>
            <span>TypeScript</span>
            <span>•</span>
            <span>Tailwind v4</span>
            <span>•</span>
            <span>Playwright</span>
            <span>•</span>
            <span>Gemini 2.5 Flash</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
