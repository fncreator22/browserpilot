"use client";

import { useState, useMemo } from "react";
import { 
  Table, 
  Download, 
  Copy, 
  Check, 
  Search, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  FileSpreadsheet,
  FileCode,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import Papa from "papaparse";
import type { InferredExtractionSchema } from "@/lib/scraper/schemaInferrer";

interface DataTableCardProps {
  data: Array<Record<string, unknown>> | string;
  schema?: InferredExtractionSchema;
  title?: string;
  jobId?: string;
}

export function DataTableCard({ data, schema, title = "Extracted Dataset", jobId }: DataTableCardProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const pageSize = 10;

  // Parse data into array of records if passed as JSON string
  const rows: Array<Record<string, unknown>> = useMemo(() => {
    if (Array.isArray(data)) return data;
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
        if (parsed.items && Array.isArray(parsed.items)) return parsed.items;
      } catch {}
    }
    return [];
  }, [data]);

  // Derive column headers from schema or first item
  const columns: string[] = useMemo(() => {
    if (schema?.fields && schema.fields.length > 0) {
      return schema.fields.map((f) => f.name);
    }
    if (rows.length > 0) {
      return Object.keys(rows[0]);
    }
    return [];
  }, [schema, rows]);

  // Filter rows based on search input
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((row) =>
      Object.values(row).some((val) => {
        if (val === null || val === undefined) return false;
        return String(val).toLowerCase().includes(q);
      })
    );
  }, [rows, searchQuery]);

  // Sort rows
  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows;
    return [...filteredRows].sort((a, b) => {
      const valA = a[sortColumn];
      const valB = b[sortColumn];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      const comparison = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredRows, sortColumn, sortDirection]);

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [sortedRows, currentPage, pageSize]);

  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  const handleCopyJson = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(rows, null, 2));
      setCopied(true);
      toast.success("Dataset copied to clipboard as JSON.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy dataset.");
    }
  };

  const handleDownloadCsv = () => {
    if (rows.length === 0) return;
    try {
      const csvContent = Papa.unparse(rows, {
        quotes: true,
        header: true,
        columns: columns.length > 0 ? columns : undefined,
      });

      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `dataset_${jobId || Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV export downloaded successfully!");
    } catch {
      toast.error("Failed to generate CSV export.");
    }
  };

  const handleDownloadJson = () => {
    if (rows.length === 0) return;
    try {
      const jsonContent = JSON.stringify(rows, null, 2);
      const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `dataset_${jobId || Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("JSON export downloaded successfully!");
    } catch {
      toast.error("Failed to generate JSON export.");
    }
  };

  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card p-5 sm:p-6 shadow-md space-y-4">
      {/* Header with Title and Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
            <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs">
              {rows.length} rows extracted
            </Badge>
          </div>
          {schema?.description && (
            <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
          )}
        </div>

        {/* 1-Click Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyJson}
            className="font-mono text-xs h-8 gap-1.5"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy JSON"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadJson}
            className="font-mono text-xs h-8 gap-1.5"
          >
            <FileCode className="h-3.5 w-3.5 text-blue-500" />
            JSON
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleDownloadCsv}
            className="font-mono text-xs h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Download CSV
          </Button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search in extracted rows..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Interactive Data Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-background">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-mono text-[11px] text-muted-foreground">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              {columns.map((col) => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="py-2.5 px-3 font-semibold text-foreground cursor-pointer select-none hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="capitalize">{col.replace(/([A-Z])/g, " $1")}</span>
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {paginatedRows.map((row, idx) => (
              <tr key={idx} className="hover:bg-muted/20 transition-colors">
                <td className="py-2.5 px-3 text-center font-mono text-[11px] text-muted-foreground">
                  {(currentPage - 1) * pageSize + idx + 1}
                </td>
                {columns.map((col) => {
                  const val = row[col];
                  const strVal = val === null || val === undefined ? "—" : typeof val === "object" ? JSON.stringify(val) : String(val);
                  const isUrl = typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"));

                  return (
                    <td key={col} className="py-2.5 px-3 max-w-[280px] truncate text-foreground font-sans">
                      {isUrl ? (
                        <a
                          href={val as string}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline hover:text-primary/80 truncate block"
                        >
                          {strVal}
                        </a>
                      ) : (
                        <span title={strVal}>{strVal}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 font-mono text-xs text-muted-foreground">
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedRows.length)} of {sortedRows.length} items
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
