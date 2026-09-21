import Link from "next/link";
import { Compass, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-marble-3 space-y-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-marble-1">
          <Compass className="h-6 w-6 stroke-[2]" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-mono font-bold text-foreground tracking-tight">404</h1>
          <h2 className="text-base font-sans font-semibold text-foreground">Page Not Found</h2>
          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
            The opportunity or destination you requested could not be located in the active directory index.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-marble-1 hover:bg-primary/90 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Workspace</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
