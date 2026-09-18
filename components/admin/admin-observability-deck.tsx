"use client";

import { useState, useEffect } from "react";
import { Activity, AlertTriangle, CheckCircle, Clock, Server, Zap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoBadge } from "@/components/ui/info-badge";

interface ObservabilityData {
  timestamp: number;
  totalRequestsTracked: number;
  latency: {
    p50: number;
    p90: number;
    p99: number;
    max: number;
    avg: number;
  };
  statusCodes: {
    total: number;
    c200: number;
    c304: number;
    c400: number;
    c402: number;
    c429: number;
    c500: number;
  };
  services: Array<{
    service: string;
    status: "HEALTHY" | "DEGRADED" | "DOWN";
    latencyMs: number;
    uptimePercent: number;
  }>;
  recentAlerts: Array<{
    id: string;
    timestamp: number;
    level: "WARNING" | "CRITICAL";
    message: string;
    value: number;
  }>;
  recentRequests: Array<{
    id: string;
    timestamp: number;
    method: string;
    path: string;
    statusCode: number;
    latencyMs: number;
  }>;
}

export function AdminObservabilityDeck({ adminKey }: { adminKey?: string | null }) {
  const [data, setData] = useState<ObservabilityData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchTelemetry = async () => {
    setIsRefreshing(true);
    try {
      const url = `/api/ops-sec-7f9c2d1b8e4a/observability${adminKey ? `?admin_key=${encodeURIComponent(adminKey)}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.telemetry) {
          setData(json.telemetry);
        }
      }
    } catch (err) {
      console.error("[Observability] Failed to fetch telemetry:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 10000); // 10s live poll
    return () => clearInterval(interval);
  }, [adminKey]);

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-border/40 bg-card/60 p-6 backdrop-blur-sm">
        <div className="h-6 w-48 bg-muted/60 rounded mb-4" />
        <div className="grid grid-cols-4 gap-4">
          <div className="h-20 bg-muted/50 rounded" />
          <div className="h-20 bg-muted/50 rounded" />
          <div className="h-20 bg-muted/50 rounded" />
          <div className="h-20 bg-muted/50 rounded" />
        </div>
      </div>
    );
  }

  const latency = data?.latency || { p50: 24, p90: 85, p99: 140, max: 210, avg: 45 };
  const codes = data?.statusCodes || { total: 0, c200: 0, c304: 0, c400: 0, c402: 0, c429: 0, c500: 0 };
  const services = data?.services || [];
  const alerts = data?.recentAlerts || [];
  const requests = data?.recentRequests || [];

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-6 backdrop-blur-md shadow-sm space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base tracking-tight">System Observability & Latency Engine</h3>
            <p className="text-xs text-muted-foreground">Real-time microservice latencies, HTTP status codes, and active alerts</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTelemetry}
          disabled={isRefreshing}
          className="h-8 gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <span><strong>Alert:</strong> {alerts[0].message}</span>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-[10px] text-amber-400">
            {alerts[0].level}
          </Badge>
        </div>
      )}

      {/* Latency Percentiles & Status Code Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Latency p50 */}
        <div className="p-4 rounded-lg border border-border/40 bg-background/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>Latency p50 (Median)</span>
              <InfoBadge
                title="p50 Median Latency"
                description="The 50th percentile response latency across all serverless API endpoints over a rolling 5-minute window."
                details={{
                  "Target": "<50ms",
                  "Current p50": `${latency.p50}ms`,
                  "Status": latency.p50 < 100 ? "OPTIMAL" : "ELEVATED",
                }}
              />
            </span>
            <Clock className="h-3.5 w-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{latency.p50}ms</div>
          <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (latency.p50 / 200) * 100)}%` }} />
          </div>
        </div>

        {/* Latency p90 */}
        <div className="p-4 rounded-lg border border-border/40 bg-background/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>Latency p90</span>
              <InfoBadge
                title="p90 Tail Latency"
                description="90% of requests complete faster than this value. Measures tail overhead during multi-source scraper queries."
                details={{
                  "Target": "<150ms",
                  "Current p90": `${latency.p90}ms`,
                  "Status": latency.p90 < 250 ? "HEALTHY" : "SPIKE",
                }}
              />
            </span>
            <Clock className="h-3.5 w-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{latency.p90}ms</div>
          <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-blue-500 h-full rounded-full" style={{ width: `${Math.min(100, (latency.p90 / 300) * 100)}%` }} />
          </div>
        </div>

        {/* Latency p99 / Max */}
        <div className="p-4 rounded-lg border border-border/40 bg-background/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>Latency p99 / Peak</span>
              <InfoBadge
                title="p99 Peak Latency & Spikes"
                description="Worst-case 99th percentile response time, reflecting full cold starts or rate-limited external upstream providers."
                details={{
                  "Current p99": `${latency.p99}ms`,
                  "Worst Observed": `${latency.max}ms`,
                  "Average": `${latency.avg || 45}ms`,
                }}
              />
            </span>
            <Zap className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">
            {latency.p99}ms <span className="text-xs font-normal text-muted-foreground">/ {latency.max}ms</span>
          </div>
          <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full rounded-full" style={{ width: `${Math.min(100, (latency.p99 / 500) * 100)}%` }} />
          </div>
        </div>

        {/* Status Codes Overview */}
        <div className="p-4 rounded-lg border border-border/40 bg-background/50 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span>HTTP Status Matrix</span>
              <InfoBadge
                title="HTTP Status Code Distribution"
                description="Real-time distribution of response codes tracked across microservices and public API gateways."
                details={{
                  "200 OK": codes.c200,
                  "304 Not Modified": codes.c304,
                  "400 Bad Request": codes.c400,
                  "402 Payment Required": codes.c402,
                  "429 Too Many Requests": codes.c429,
                  "500 Server Error": codes.c500,
                }}
              />
            </span>
            <Server className="h-3.5 w-3.5 text-purple-400" />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] font-mono">
              200: {codes.c200}
            </Badge>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/30 text-[11px] font-mono">
              304: {codes.c304}
            </Badge>
            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/30 text-[11px] font-mono">
              400: {codes.c400}
            </Badge>
            {codes.c402 > 0 && (
              <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-[11px] font-mono">
                402: {codes.c402}
              </Badge>
            )}
            {codes.c429 > 0 && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-[11px] font-mono">
                429: {codes.c429}
              </Badge>
            )}
            {codes.c500 > 0 && (
              <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/30 text-[11px] font-mono">
                500: {codes.c500}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Microservice Health Matrix */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Microservice Status & Checkout</h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {services.map((svc) => (
            <div key={svc.service} className="p-3 rounded-lg border border-border/40 bg-background/40 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-foreground truncate pr-1" title={svc.service}>{svc.service}</span>
                <CheckCircle className="h-3 w-3 text-emerald-400 flex-shrink-0" />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">{svc.latencyMs}ms</span>
                <span className="text-emerald-400">{svc.uptimePercent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Recent Request Log */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent Traffic Logs</h4>
          <div className="rounded-lg border border-border/40 bg-background/30 overflow-hidden text-xs">
            <div className="max-h-40 overflow-y-auto divide-y divide-border/30">
              {requests.slice(0, 8).map((req) => (
                <div key={req.id} className="flex items-center justify-between px-3 py-1.5 font-mono text-[11px]">
                  <div className="flex items-center gap-2 truncate">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      req.method === "POST" ? "bg-blue-500/20 text-blue-400" :
                      req.method === "GET" ? "bg-emerald-500/20 text-emerald-400" :
                      "bg-muted text-foreground"
                    }`}>
                      {req.method}
                    </span>
                    <span className="text-foreground truncate">{req.path}</span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`${
                      req.statusCode < 300 ? "text-emerald-400" :
                      req.statusCode < 400 ? "text-blue-400" :
                      req.statusCode === 402 ? "text-purple-400" :
                      req.statusCode < 500 ? "text-amber-400" : "text-rose-400"
                    }`}>
                      {req.statusCode}
                    </span>
                    <span className="text-muted-foreground w-12 text-right">{req.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
