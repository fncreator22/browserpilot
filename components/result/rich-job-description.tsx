"use client";

import React, { useMemo } from "react";
import { ExternalLink, Link2, ChevronRight, Globe } from "lucide-react";

interface RichJobDescriptionProps {
  content: string;
  className?: string;
}

function YouTubeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function formatInlineWithLinks(text: string): React.ReactNode[] {
  // Matches markdown links [title](url) or raw URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<"']+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(decodeHtmlEntities(text.substring(lastIndex, match.index)));
    }

    const isMarkdown = Boolean(match[1] && match[2]);
    const label = isMarkdown ? match[1] : match[3];
    const href = isMarkdown ? match[2] : match[3];
    const isYouTube = /youtube\.com|youtu\.be/i.test(href);

    if (isYouTube) {
      nodes.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={`Watch on YouTube: ${href}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 dark:text-rose-300 font-sans font-medium text-xs border border-rose-200 dark:border-rose-800 transition-colors shadow-2xs group cursor-pointer"
        >
          <span className="text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform">
            <YouTubeIcon className="h-3 w-3" />
          </span>
          <span className="truncate max-w-[200px]">{label || "Watch Video"}</span>
          <ExternalLink className="h-2.5 w-2.5 opacity-70" />
        </a>
      );
    } else {
      nodes.push(
        <a
          key={match.index}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          title={href}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-sans font-medium text-xs border border-primary/20 transition-colors cursor-pointer"
        >
          <span className="truncate max-w-[200px]">{label}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
        </a>
      );
    }

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(decodeHtmlEntities(text.substring(lastIndex)));
  }

  return nodes;
}

export function RichJobDescription({ content, className = "" }: RichJobDescriptionProps) {
  const parsedElements = useMemo(() => {
    if (!content || !content.trim()) {
      return [<p key="empty" className="text-muted-foreground italic">No detailed description provided.</p>];
    }

    let raw = content.trim();

    // 1. Convert HTML tags to structured tokens if HTML present
    const hasHtml = /<[a-z][\s\S]*>/i.test(raw);
    if (hasHtml) {
      // Replace <a href="...">text</a> with markdown [text](href)
      raw = raw.replace(/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
        const cleanText = text.replace(/<[^>]+>/g, "").trim() || href;
        return ` [${cleanText}](${href}) `;
      });

      // Convert headings to custom delimiters
      raw = raw.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, "\n\n### $1\n\n");

      // Convert list items
      raw = raw.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n• $1\n");
      raw = raw.replace(/<\/?(ul|ol)[^>]*>/gi, "\n");

      // Convert <p> and <br>
      raw = raw.replace(/<br\s*\/?>/gi, "\n");
      raw = raw.replace(/<p[^>]*>/gi, "\n\n").replace(/<\/p>/gi, "\n\n");

      // Strip remaining tags
      raw = raw.replace(/<[^>]+>/g, " ");
    }

    // 2. Split into blocks by double newline
    const rawBlocks = raw.split(/\n\s*\n/);
    const elements: React.ReactNode[] = [];

    rawBlocks.forEach((block, bIdx) => {
      const trimmed = block.trim();
      if (!trimmed) return;

      // Check if block is a Heading
      if (trimmed.startsWith("###") || trimmed.startsWith("##") || trimmed.startsWith("#")) {
        const title = trimmed.replace(/^#+\s*/, "").replace(/<[^>]+>/g, "").trim();
        elements.push(
          <h3
            key={`h-${bIdx}`}
            className="text-sm font-sans font-bold text-foreground mt-4 mb-1.5 first:mt-0 tracking-tight"
          >
            {title}
          </h3>
        );
        return;
      }

      // Check if block contains list items (lines starting with • or - or *)
      const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
      const isList = lines.length > 0 && lines.every((l) => /^[•\-\*\d+\.]\s*/.test(l));

      if (isList) {
        elements.push(
          <ul key={`ul-${bIdx}`} className="space-y-1.5 my-2.5 pl-1 text-xs font-sans text-foreground/90">
            {lines.map((line, lIdx) => {
              const cleanLine = line.replace(/^[•\-\*\d+\.]\s*/, "");
              return (
                <li key={lIdx} className="flex items-start gap-2 leading-relaxed">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    {formatInlineWithLinks(cleanLine)}
                  </div>
                </li>
              );
            })}
          </ul>
        );
        return;
      }

      // Default: Paragraph with inline rich links
      elements.push(
        <p key={`p-${bIdx}`} className="text-xs font-sans text-foreground/90 leading-relaxed mb-3 last:mb-0">
          {formatInlineWithLinks(trimmed)}
        </p>
      );
    });

    return elements;
  }, [content]);

  return (
    <div className={`space-y-1 text-xs font-sans text-foreground/90 ${className}`}>
      {parsedElements}
    </div>
  );
}
