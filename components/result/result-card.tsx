"use client";

import { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Table as TableIcon, 
  Code2,
  Briefcase,
  Layers,
  ShieldCheck,
  Globe,
  AlertTriangle,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JobDossierDeck, type DossierJobItem, type DossierSourceListing } from "./job-dossier-deck";
import { parseTextToDossierItems, cleanCitationMarkers } from "@/lib/scraper/textDossierParser";

interface ResultCardProps {
  title?: string;
  summary?: string;
  data?: unknown;
  confidence?: number;
  status?: string;
  jobId?: string;
}

export function ResultCard({
  title = "Final Answer & Verified Payload",
  summary = "Task completed successfully. Extracted data verified against schema.",
  data,
  confidence = 0.95,
  status = "COMPLETED",
  jobId = "search",
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  // 1. Deterministic Extraction of Structured Opportunities
  const dossierData = useMemo(() => {
    // Check direct data first
    const directResult = parseTextToDossierItems(data);
    if (directResult.items.length > 0) return directResult;

    // Fallback: parse summary string
    if (summary && typeof summary === "string" && summary.length > 20) {
      const summaryResult = parseTextToDossierItems(summary);
      if (summaryResult.items.length > 0) return summaryResult;
    }

    return { overviewText: "", items: [], sources: [] };
  }, [data, summary]);

  // 2. Parse Raw JSON / Table Data for non-opportunity outputs
  const parsedData = typeof data === "string" ? (() => {
    try { return JSON.parse(data); } catch { return data; }
  })() : data;

  const isArrayData = Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === "object";
  const tableHeaders = isArrayData ? Object.keys(parsedData[0] || {}) : [];

  const hasDossier = dossierData.items.length > 0;

  const handleCopyJson = () => {
    const textToCopy = typeof parsedData === "object" ? JSON.stringify(parsedData, null, 2) : String(parsedData || summary);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
    if (hasDossier) {
      const headers = ["Title", "Company", "Location", "Work Mode", "Salary", "Apply URL"];
      const rows = dossierData.items.map((it) => [
        JSON.stringify(it.title),
        JSON.stringify(it.company || it.companyName || ""),
        JSON.stringify(it.location || ""),
        JSON.stringify(it.workMode || it.workplaceType || ""),
        JSON.stringify(it.salary || ""),
        JSON.stringify(it.applyUrl || it.primaryApplyUrl || ""),
      ]);
      const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `opportunities_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!isArrayData) return;
    const headers = tableHeaders.join(",");
    const rows = (parsedData as Record<string, unknown>[]).map((row) =>
      tableHeaders.map((h) => JSON.stringify(row[h] ?? "")).join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `result_payload_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clean overview description: strip raw markdown links for clean prose display
  const displaySummary = useMemo(() => {
    if (dossierData.overviewText) return dossierData.overviewText;
    if (!summary) return "";
    return cleanCitationMarkers(
      summary
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, "$1")
        .replace(/\[\d+\]/g, "")
    );
  }, [summary, dossierData.overviewText]);

  const isHighConfidence = confidence >= 0.7 && status !== "BLOCKED" && status !== "FAILED";
  const isMediumConfidence = confidence >= 0.4 && status !== "BLOCKED" && status !== "FAILED";

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-marble-2 transition-all space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            {isHighConfidence ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : isMediumConfidence ? (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
              </span>
            ) : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </span>
            )}
            <h3 className="font-sans text-base sm:text-lg font-bold tracking-tight text-foreground">
              {title}
            </h3>
            {isHighConfidence ? (
              <Badge variant="outline" className="text-[10px] font-mono text-primary bg-primary/10 border-primary/30 rounded-full">
                {Math.round(confidence * 100)}% Confident
              </Badge>
            ) : isMediumConfidence ? (
              <Badge variant="outline" className="text-[10px] font-mono text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 rounded-full">
                {Math.round(confidence * 100)}% Partial
              </Badge>
            ) : status === "BLOCKED" ? (
              <Badge variant="outline" className="text-[10px] font-mono text-destructive bg-destructive/10 border-destructive/30 rounded-full">
                Blocked / 0% Confident
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground bg-muted border-border rounded-full">
                Unverified ({Math.round(confidence * 100)}%)
              </Badge>
            )}
          </div>
          {displaySummary && (
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed max-w-4xl font-sans">
              {displaySummary.length > 300 && hasDossier ? displaySummary.slice(0, 300) + "..." : displaySummary}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="font-mono text-xs gap-1.5 h-9 min-h-[44px] sm:min-h-[36px] rounded-lg border-border text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer focus-visible:ring-2 focus-visible:ring-primary shadow-2xs"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Payload"}
          </Button>
          {(hasDossier || isArrayData) && (
            <Button
              size="sm"
              onClick={handleExportCsv}
              className="font-mono text-xs gap-1.5 h-9 min-h-[44px] sm:min-h-[36px] px-3.5 rounded-lg bg-primary hover:bg-primary/90 text-white shadow-marble-1 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        <Tabs defaultValue={hasDossier ? "dossier" : isArrayData ? "table" : "json"} className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="h-8 p-0.5 bg-muted/60">
              {hasDossier && (
                <TabsTrigger value="dossier" className="text-xs px-3 py-1 gap-1.5 font-medium">
                  <Briefcase className="h-3.5 w-3.5" />
                  Opportunity Dossier ({dossierData.items.length})
                </TabsTrigger>
              )}
              {isArrayData && (
                <TabsTrigger value="table" className="text-xs px-3 py-1 gap-1.5">
                  <TableIcon className="h-3.5 w-3.5" />
                  Structured Table ({(parsedData as unknown[]).length})
                </TabsTrigger>
              )}
              <TabsTrigger value="json" className="text-xs px-3 py-1 gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                Raw JSON / Payload
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: Structured Opportunity Dossier */}
          {hasDossier && (
            <TabsContent value="dossier" className="mt-0 space-y-6">
              <JobDossierDeck jobs={dossierData.items} jobId={jobId} />

              {/* Sources & References Dedicated Footer Section */}
              {dossierData.sources.length > 0 && (
                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider font-mono">
                      Sources & References ({dossierData.sources.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {dossierData.sources.map((src, sIdx) => (
                      <a
                        key={sIdx}
                        href={src.applyUrl || src.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border/50 bg-background/80 hover:bg-muted/50 transition-colors text-xs group"
                      >
                        <span className="font-medium text-foreground truncate group-hover:text-primary">
                          {src.sourcePlatform} Listing #{sIdx + 1}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary flex-shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          )}

          {/* TAB 2: Table Data */}
          {isArrayData && (
            <TabsContent value="table" className="mt-0">
              <div className="rounded-xl border border-border/60 overflow-hidden bg-background max-h-[400px] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      {tableHeaders.map((head) => (
                        <TableHead key={head} className="font-mono text-xs capitalize">
                          {head}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(parsedData as Record<string, unknown>[]).map((item, idx) => (
                      <TableRow key={idx} className="text-xs hover:bg-muted/30">
                        {tableHeaders.map((head) => (
                          <TableCell key={head} className="font-medium text-foreground max-w-xs truncate">
                            {typeof item[head] === "object" ? JSON.stringify(item[head]) : String(item[head] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          )}

          {/* TAB 3: JSON / Raw Payload */}
          <TabsContent value="json" className="mt-0">
            <div className="rounded-xl border border-border/60 bg-background/90 p-4 font-mono text-xs overflow-x-auto max-h-[360px]">
              <pre className="text-foreground leading-relaxed">
                {typeof parsedData === "object" ? JSON.stringify(parsedData, null, 2) : String(parsedData || summary)}
              </pre>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
