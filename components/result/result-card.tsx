"use client";

import { useState } from "react";
import { 
  CheckCircle2, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Table as TableIcon, 
  Code2,
  FileText
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

interface ResultCardProps {
  title?: string;
  summary?: string;
  data?: unknown;
  confidence?: number;
  status?: string;
}

export function ResultCard({
  title = "Extracted Verified Payload",
  summary = "Task completed successfully. Extracted data verified against schema.",
  data,
  confidence = 0.95,
  status = "COMPLETED",
}: ResultCardProps) {
  const [copied, setCopied] = useState(false);

  const parsedData = typeof data === "string" ? (() => {
    try { return JSON.parse(data); } catch { return data; }
  })() : data;

  const isArrayData = Array.isArray(parsedData) && parsedData.length > 0 && typeof parsedData[0] === "object";
  const tableHeaders = isArrayData ? Object.keys(parsedData[0] || {}) : [];

  const handleCopyJson = () => {
    const textToCopy = typeof parsedData === "object" ? JSON.stringify(parsedData, null, 2) : String(parsedData || summary);
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCsv = () => {
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

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-md transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <h3 className="text-base font-bold tracking-tight text-foreground">
              Final Answer & Verified Payload (Level 1 Disclosure)
            </h3>
            <Badge variant="outline" className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border-emerald-500/20">
              {Math.round(confidence * 100)}% Confident
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-2 leading-relaxed whitespace-pre-line">
            {summary}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="font-mono text-xs gap-1.5 h-8"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy Payload"}
          </Button>
          {isArrayData && (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportCsv}
              className="font-mono text-xs gap-1.5 h-8 shadow-sm"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {parsedData && (
        <div className="mt-5">
          <Tabs defaultValue={isArrayData ? "table" : "json"} className="w-full">
            <div className="flex items-center justify-between mb-3">
              <TabsList className="h-8 p-0.5 bg-muted/60">
                {isArrayData && (
                  <TabsTrigger value="table" className="text-xs px-3 py-1 gap-1.5">
                    <TableIcon className="h-3.5 w-3.5" />
                    Structured Table ({(parsedData as unknown[]).length})
                  </TabsTrigger>
                )}
                <TabsTrigger value="json" className="text-xs px-3 py-1 gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  JSON Payload
                </TabsTrigger>
              </TabsList>
            </div>

            {isArrayData && (
              <TabsContent value="table" className="mt-0">
                <div className="rounded-xl border border-border/60 overflow-hidden bg-background max-h-[360px] overflow-y-auto">
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

            <TabsContent value="json" className="mt-0">
              <div className="rounded-xl border border-border/60 bg-background/90 p-4 font-mono text-xs overflow-x-auto max-h-[320px]">
                <pre className="text-foreground leading-relaxed">
                  {typeof parsedData === "object" ? JSON.stringify(parsedData, null, 2) : String(parsedData)}
                </pre>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
