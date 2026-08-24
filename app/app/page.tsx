"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { 
  Bot, 
  Sparkles, 
  ArrowRight, 
  Clock, 
  Layers, 
  RefreshCw,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TaskInput } from "@/components/agent/task-input";

interface RecentJobSummary {
  id: string;
  prompt: string;
  status: string;
  progress: number;
  createdAt: string;
  _count?: {
    steps: number;
    observations: number;
    artifacts: number;
  };
}

export default function AppPage() {
  const [recentJobs, setRecentJobs] = useState<RecentJobSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        if (data.jobs) {
          setRecentJobs(data.jobs);
        }
      })
      .catch((err) => console.error("Error loading recent jobs:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
      case "WORKING":
      case "PLANNING":
      case "QUEUED":
        return "bg-primary/10 text-primary border-primary/20 animate-pulse";
      case "BLOCKED":
      case "FAILED":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-10">
        {/* Header Title Bar */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/60"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
                Autonomous Task Dispatcher
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Define target goals, configure domain whitelists, and launch sandboxed browser agent executions.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-border/60 bg-muted/40 px-3 py-1.5 font-mono text-xs flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Active Jobs:</span>
              <span className="font-semibold text-foreground">{recentJobs.length} recorded</span>
            </div>
          </div>
        </motion.div>

        {/* Primary Task Input Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-4xl mx-auto space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              New Autonomous Goal
            </h2>
            <span className="text-xs text-muted-foreground">
              Level 1–4 Progressive Disclosure Ready
            </span>
          </div>

          <TaskInput />
        </motion.div>

        {/* Recent Jobs Section */}
        {recentJobs.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Recent Agent Executions ({recentJobs.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any job below to inspect its live 4-level progressive disclosure telemetry and artifacts.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {recentJobs.map((job, idx) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 + idx * 0.05 }}
                >
                  <Link
                    href={`/app/jobs/${job.id}`}
                    className="block rounded-2xl border border-border/80 bg-card p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-md group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono font-medium border ${getStatusBadge(job.status)}`}>
                            {job.status}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            ID: {job.id}
                          </span>
                          <span className="text-muted-foreground text-[11px]">•</span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {new Date(job.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-snug">
                          {job.prompt}
                        </p>

                        <div className="flex items-center gap-4 text-[11px] font-mono text-muted-foreground pt-1">
                          <span>Progress: <strong className="text-foreground">{job.progress}%</strong></span>
                          <span>•</span>
                          <span>Observations: <strong className="text-foreground">{job._count?.observations || 0}</strong></span>
                          <span>•</span>
                          <span>Artifacts: <strong className="text-foreground">{job._count?.artifacts || 0}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:self-center">
                        <Button variant="ghost" size="sm" className="font-mono text-xs gap-1 group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                          Inspect Telemetry <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
