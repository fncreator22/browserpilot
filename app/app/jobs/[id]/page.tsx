"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { toast } from "sonner";
import { 
  Bot, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Radio,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { StatusTimeline, type TimelineStep } from "@/components/execution/status-timeline";
import { WorkerMetrics } from "@/components/execution/worker-metrics";
import { ExecutionLogs } from "@/components/execution/execution-logs";
import { ResultCard } from "@/components/result/result-card";
import { ScreenshotCard } from "@/components/result/screenshot-card";
import { BlockedStateCard } from "@/components/execution/blocked-state-card";
import { UplinkExecutionVisualizer, type ExecutionState } from "@/components/threeui/uplink-execution-visualizer";

interface DbJobData {
  id: string;
  prompt: string;
  status: "QUEUED" | "PLANNING" | "WORKING" | "VERIFYING" | "COMPLETED" | "FAILED" | "BLOCKED";
  progress: number;
  allowedDomains: string;
  maxStepsBudget: number;
  goal?: string;
  confidence?: number;
  summary?: string;
  error?: string;
  result?: string;
  totalDurationMs?: number;
  tokensUsed?: number;
  memoryMb?: number;
  maxDurationMs?: number;
  startedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  steps: Array<{
    id: string;
    stepNumber: number;
    tool: string;
    actionPayload: string;
    rationale?: string;
    status: string;
    createdAt: string;
  }>;
  observations: Array<{
    id: string;
    stepIndex: number;
    tool: string;
    status: "SUCCESS" | "FAILED" | "BLOCKED";
    currentUrl: string;
    title: string;
    pageSummary?: string;
    extractedData?: string;
    screenshotPath?: string;
    error?: string;
    elapsedMs: number;
    timestamp: string;
  }>;
  artifacts: Array<{
    id: string;
    filename: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
}

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;

  const [job, setJob] = useState<DbJobData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const previousStatusRef = useRef<string | null>(null);

  const isActive = job ? ["QUEUED", "PLANNING", "WORKING", "VERIFYING"].includes(job.status) : false;

  // Live Time Budget Countdown Timer (§Prompt C2)
  useEffect(() => {
    if (!job || !isActive || job.status === "QUEUED") {
      setSecondsRemaining(null);
      return;
    }

    const budgetSec = Math.round((job.maxDurationMs || 120000) / 1000);
    const startMs = job.startedAt ? new Date(job.startedAt).getTime() : new Date(job.createdAt).getTime();

    const updateTimer = () => {
      const elapsedSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const remaining = Math.max(0, budgetSec - elapsedSec);
      setSecondsRemaining(remaining);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [job, isActive]);

  // Poll job data from real API
  const fetchJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`Job "${jobId}" not found in database.`);
        }
        throw new Error(`Failed to load job: ${res.statusText}`);
      }
      const data = await res.json();
      const currentJob: DbJobData = data.job;
      setJob(currentJob);
      setFetchError(null);

      // Transient state toasts
      if (previousStatusRef.current !== currentJob.status) {
        if (currentJob.status === "WORKING" && previousStatusRef.current === "QUEUED") {
          toast.info("Browser execution started in sandboxed Playwright worker.");
        } else if (currentJob.status === "VERIFYING") {
          toast.info("Evaluating extraction payload against Zod contract.");
        } else if (currentJob.status === "COMPLETED") {
          toast.success("Task completed successfully! Verified result ready.");
        } else if (currentJob.status === "BLOCKED" || currentJob.status === "FAILED") {
          toast.error("Execution halted. Security boundary or failure encountered.");
        }
        previousStatusRef.current = currentJob.status;
      }
    } catch (err: unknown) {
      setFetchError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    let isSubscribed = true;
    const initialTimer = setTimeout(() => {
      if (isSubscribed) {
        fetchJob();
      }
    }, 0);

    // Poll every 1000ms while job is in active execution state
    const interval = setInterval(() => {
      if (isSubscribed) {
        fetchJob();
      }
    }, 1500);

    return () => {
      isSubscribed = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [fetchJob]);

  // Map real job status to ThreeUI UplinkLoader state per Prompt 05 mapping
  const getUplinkState = (): ExecutionState => {
    if (!job) return "PLANNING";
    switch (job.status) {
      case "QUEUED":
      case "PLANNING":
        return "PLANNING";
      case "WORKING":
        return job.progress < 40 ? "CONNECTING" : "RUNNING";
      case "VERIFYING":
        return "VERIFYING";
      case "COMPLETED":
        return "SUCCESS";
      case "BLOCKED":
      case "FAILED":
        return "BLOCKED";
      default:
        return "RUNNING";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 container mx-auto max-w-7xl px-4 py-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-mono text-muted-foreground">Loading job telemetry from database...</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (fetchError || !job) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        <Navbar />
        <main className="flex-1 container mx-auto max-w-7xl px-4 py-16 space-y-6">
          <Link href="/app">
            <Button variant="ghost" size="sm" className="font-mono text-xs gap-1.5 text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Dispatcher
            </Button>
          </Link>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
            <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
            <h2 className="text-base font-bold text-rose-400">Job Not Found or Database Offline</h2>
            <p className="text-xs font-mono text-muted-foreground max-w-md mx-auto">{fetchError}</p>
            <Button variant="outline" size="sm" onClick={() => fetchJob()} className="mt-2 text-xs font-mono">
              Retry Connection
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const parsedError = job.error ? (() => {
    try { return JSON.parse(job.error); } catch { return { message: job.error }; }
  })() : null;

  // Convert real DB steps & observations into StatusTimeline format (Level 2)
  const timelineSteps: TimelineStep[] = (job.steps.length > 0 ? job.steps : [
    {
      id: "step-plan",
      stepNumber: 1,
      tool: "ai.planGoal",
      actionPayload: JSON.stringify({ goal: job.prompt }),
      rationale: "Deconstructing goal into structured action plan",
      status: job.status === "COMPLETED" ? "COMPLETED" : (job.status === "FAILED" || job.status === "BLOCKED") ? (job.status === "BLOCKED" ? "BLOCKED" : "FAILED") : (job.progress >= 25 ? "COMPLETED" : "RUNNING"),
      createdAt: job.createdAt,
    }
  ]).map((st) => {
    const matchingObs = job.observations.find((o) => o.stepIndex === st.stepNumber);
    const isTerminal = job.status === "COMPLETED" || job.status === "FAILED" || job.status === "BLOCKED";
    let stepStatus: TimelineStep["status"] = "PENDING";

    if (matchingObs) {
      stepStatus = matchingObs.status === "SUCCESS" ? "COMPLETED" : matchingObs.status === "BLOCKED" ? "BLOCKED" : "FAILED";
    } else if (isTerminal) {
      stepStatus = job.status === "COMPLETED" ? "COMPLETED" : job.status === "BLOCKED" ? "BLOCKED" : "FAILED";
    } else if (job.progress > (st.stepNumber / (job.steps.length || 1)) * 80) {
      stepStatus = "RUNNING";
    }

    let parsedAction: { tool?: string; parameters?: Record<string, unknown> } = {};
    try { parsedAction = JSON.parse(st.actionPayload); } catch {}

    return {
      id: st.id,
      name: `Step ${st.stepNumber}: ${st.tool}`,
      description: st.rationale || matchingObs?.pageSummary || `Executed ${st.tool} in Playwright sandbox`,
      status: stepStatus,
      durationMs: matchingObs?.elapsedMs,
      toolCall: `${st.tool}(${JSON.stringify(parsedAction.parameters || {})})`,
    };
  });

  // Convert observations to ExecutionLogs format (Level 4)
  const toolLogs = job.observations.map((obs) => {
    let parsedParams = {};
    try {
      const stepMatch = job.steps.find((s) => s.stepNumber === obs.stepIndex);
      if (stepMatch) {
        const actionObj = JSON.parse(stepMatch.actionPayload);
        parsedParams = actionObj.parameters || {};
      }
    } catch {}

    return {
      id: obs.id,
      step: obs.stepIndex,
      tool: obs.tool,
      parameters: parsedParams,
      observation: {
        status: obs.status,
        url: obs.currentUrl,
        domSummary: obs.pageSummary || undefined,
        elapsedMs: obs.elapsedMs,
      },
      timestamp: new Date(obs.timestamp).toLocaleTimeString(),
    };
  });

  // Artifact for ScreenshotCard
  const latestArtifact = job.artifacts[job.artifacts.length - 1];
  const lastObservation = job.observations[job.observations.length - 1];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-8">
        {/* Navigation Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <Link href="/app">
              <Button variant="ghost" size="sm" className="font-mono text-xs gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Dispatcher
              </Button>
            </Link>
            <span className="text-muted-foreground">•</span>
            <span className="font-mono text-xs text-muted-foreground">
              Job ID: <strong className="text-foreground">{job.id}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[11px] gap-1.5 py-1 px-3 bg-secondary/40">
              <Clock className="h-3 w-3" />
              {new Date(job.createdAt).toLocaleTimeString()}
            </Badge>
          </div>
        </motion.div>

        {/* Job Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border/60">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                {job.status === "COMPLETED" && (
                  <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs gap-1.5 py-1 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    TASK COMPLETE (VERIFIED)
                  </Badge>
                )}
                {job.status === "QUEUED" && (
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-mono text-xs gap-1.5 py-1 px-3">
                    <Clock className="h-3.5 w-3.5" />
                    Queued — Waiting for available worker slot
                  </Badge>
                )}
                {isActive && job.status !== "QUEUED" && (
                  <>
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-xs gap-1.5 py-1 px-3 animate-pulse">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      {job.status} ({job.progress}%)
                    </Badge>
                    {secondsRemaining !== null && (
                      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-xs gap-1.5 py-1 px-3">
                        <Clock className="h-3.5 w-3.5 animate-pulse" />
                        Running — {secondsRemaining}s of {Math.round((job.maxDurationMs || 120000) / 1000)}s remaining
                      </Badge>
                    )}
                  </>
                )}
                {(job.status === "BLOCKED" || job.status === "FAILED") && (
                  <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-mono text-xs gap-1.5 py-1 px-3">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {parsedError?.code || (job.status === "BLOCKED" ? "VERIFICATION_BLOCKED" : "EXECUTION_HALTED")}
                  </Badge>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-snug">
                {job.prompt}
              </h2>
            </div>
          </div>

          {/* Quick Sub-Stats */}
          <div className="mt-4 flex flex-wrap items-center gap-6 font-mono text-xs text-muted-foreground">
            <div>Engine: <strong className="text-foreground">Playwright Sandboxed</strong></div>
            <div>•</div>
            <div>Model: <strong className="text-foreground">Gemini 3.6 Flash</strong></div>
            <div>•</div>
            <div>Time Budget: <strong className="text-foreground">{Math.round((job.maxDurationMs || 120000) / 1000)}s (5m hard ceiling)</strong></div>
            <div>•</div>
            <div>Progress: <strong className="text-foreground">{job.progress}%</strong></div>
          </div>
        </motion.div>

        {/* Real ThreeUI UplinkLoader visualizer (Active Execution State Only per §19) */}
        {isActive && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="h-3.5 w-3.5 text-primary" /> Active WebGL Uplink Channel (§19)
              </span>
              <span className="text-[11px] font-mono text-emerald-500">Live Telemetry Feed</span>
            </div>
            <UplinkExecutionVisualizer
              currentState={getUplinkState()}
              interactiveControls={false}
            />
          </motion.div>
        )}

        {/* If BLOCKED or FAILED, show §26 Human-Readable Error Card with 0 raw enum leak */}
        {(job.status === "BLOCKED" || job.status === "FAILED") && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="space-y-6"
          >
            <BlockedStateCard
              rawError={parsedError}
              errorCode={parsedError?.code}
              customMessage={parsedError?.userMessage || job.summary}
            />
          </motion.div>
        )}

        {/* Level 1: Final Answer & Verified Result Card (If Complete) */}
        {job.status === "COMPLETED" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45 }}
            className="space-y-3"
          >
            <ResultCard
              title="Verified Execution Result"
              summary={job.summary || "Task completed successfully."}
              data={job.result}
              confidence={job.confidence || 0.95}
              status={job.status}
            />
          </motion.div>
        )}

        {/* Level 2 Timeline & Viewport Snapshot Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-6 space-y-6"
          >
            <StatusTimeline steps={timelineSteps} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-6 space-y-6"
          >
            <ScreenshotCard
              url={lastObservation?.currentUrl || "about:blank"}
              step={lastObservation?.stepIndex || 1}
              timestamp={lastObservation?.timestamp ? new Date(lastObservation.timestamp).toLocaleTimeString() : undefined}
              isWorking={isActive}
              jobId={job.id}
              filename={latestArtifact?.filename}
            />
          </motion.div>
        </div>

        {/* Level 3: Worker & Job Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.2 }}
        >
          <WorkerMetrics
            durationSeconds={job.totalDurationMs ? Math.round((job.totalDurationMs / 1000) * 10) / 10 : Math.max(0, Math.round((new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()) / 1000))}
            stepsCompleted={job.observations.length}
            maxSteps={job.maxStepsBudget}
            tokensUsed={job.tokensUsed ?? undefined}
            memoryMb={job.memoryMb ?? undefined}
            confidenceScore={job.confidence ? Math.round(job.confidence * 100) : 95.0}
            status={job.status}
          />
        </motion.div>

        {/* Level 4: Raw Logs & Telemetry Drawer */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.25 }}
        >
          <ExecutionLogs logs={toolLogs} />
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
