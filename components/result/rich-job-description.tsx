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

export function decodeHtmlEntities(str: string): string {
  if (!str) return "";
  return str
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&mdash;/gi, "-")
    .replace(/&ndash;/gi, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')
    .replace(/&bull;/gi, "•")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Strips all HTML markup, decodes entities, removes em-dashes and en-dashes, and produces a clean plain text snippet.
 * Handles both raw HTML (<p>, <div>) and entity-escaped HTML (&lt;div&gt;, &amp;lt;p&amp;gt;).
 * Ideal for job cards, lists, and summary previews.
 */
export function cleanTextSnippet(text?: string | null): string {
  if (!text) return "";
  let clean = text;

  // 1. Resolve entity-escaped tags (e.g. &lt;div, &amp;lt;p&gt;) up to two passes
  for (let pass = 0; pass < 2; pass++) {
    if (/&(?:amp;)?(?:lt|gt|quot|#39|apos);/i.test(clean)) {
      clean = clean
        .replace(/&amp;lt;/gi, "<")
        .replace(/&amp;gt;/gi, ">")
        .replace(/&amp;quot;/gi, '"')
        .replace(/&amp;apos;/gi, "'")
        .replace(/&amp;#39;/gi, "'")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&apos;/gi, "'");
    }
  }

  // 2. Remove script and style elements and contents
  clean = clean.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  // 3. Replace line break and block tags with whitespace
  clean = clean.replace(/<br\s*\/?>/gi, " ");
  clean = clean.replace(/<\/?(p|div|h[1-6]|li|ul|ol|section|article|header|footer|aside|main|tr|td|th)[^>]*>/gi, " ");
  // 4. Strip remaining HTML tags
  clean = clean.replace(/<[^>]+>/g, " ");
  // 5. Decode text entities and convert em-dashes/en-dashes into hyphens (multi-pass to resolve double-encoded entities like &amp;amp;)
  for (let pass = 0; pass < 3; pass++) {
    const decoded = decodeHtmlEntities(clean);
    if (decoded === clean) break;
    clean = decoded;
  }
  // 6. Clean markdown artifacts if any
  clean = clean.replace(/(\*\*|\*|__|_|##+|```)/g, "");
  // 7. Normalize whitespace
  return clean.replace(/\s+/g, " ").trim();
}

function renderFormattedText(str: string): React.ReactNode[] {
  const parts = str.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-foreground">{decodeHtmlEntities(part.slice(2, -2))}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={idx} className="italic text-foreground/90">{decodeHtmlEntities(part.slice(1, -1))}</em>;
    }
    return decodeHtmlEntities(part);
  });
}

function formatInlineWithLinks(text: string): React.ReactNode[] {
  // Matches markdown links [title](url) or raw URLs
  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<"']+)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(...renderFormattedText(text.substring(lastIndex, match.index)));
    }

    const isMarkdown = Boolean(match[1] && match[2]);
    let label = isMarkdown ? match[1] : match[3];
    let href = isMarkdown ? match[2] : match[3];

    // Trim trailing punctuation from raw URLs so they don't break links or previews
    let trailingPunct = "";
    if (!isMarkdown && href) {
      const punctMatch = href.match(/[.,;:!)]+$/);
      if (punctMatch) {
        trailingPunct = punctMatch[0];
        href = href.slice(0, -trailingPunct.length);
        label = label.slice(0, -trailingPunct.length);
      }
    }

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

    if (trailingPunct) {
      nodes.push(trailingPunct);
    }

    lastIndex = linkRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(...renderFormattedText(text.substring(lastIndex)));
  }

  return nodes;
}

export function RichJobDescription({ content, className = "" }: RichJobDescriptionProps) {
  const parsedElements = useMemo(() => {
    if (!content || !content.trim()) {
      return [<p key="empty" className="text-muted-foreground italic">No detailed description provided.</p>];
    }

    let raw = content.trim();

    // 0. Resolve entity-escaped tags (e.g. &lt;div, &amp;lt;p&gt;) so structured HTML parsing succeeds
    for (let pass = 0; pass < 2; pass++) {
      if (/&(?:amp;)?(?:lt|gt);/i.test(raw)) {
        raw = raw
          .replace(/&amp;lt;/gi, "<")
          .replace(/&amp;gt;/gi, ">")
          .replace(/&lt;/gi, "<")
          .replace(/&gt;/gi, ">");
      }
    }

    // 1. Convert HTML tags to structured tokens if HTML present
    const hasHtml = /<[a-z][\s\S]*>/i.test(raw);
    if (hasHtml) {
      // Strip script and style blocks entirely
      raw = raw.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");

      // Preserve bold and italics
      raw = raw.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, "**$1**");
      raw = raw.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, "*$1*");

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

      // Convert structural containers into block separators
      raw = raw.replace(/<\/?(?:div|section|article|header|footer|aside|main|nav)[^>]*>/gi, "\n");

      // Convert <p> and <br>
      raw = raw.replace(/<br\s*\/?>/gi, "\n");
      raw = raw.replace(/<p[^>]*>/gi, "\n\n").replace(/<\/p>/gi, "\n\n");

      // Strip remaining tags
      raw = raw.replace(/<[^>]+>/g, " ");

      // Decode entities on raw text
      raw = decodeHtmlEntities(raw);
    }

    // 2. Split into blocks by double newline
    const rawBlocks = raw.split(/\n\s*\n/);
    const elements: React.ReactNode[] = [];

    const bulletRegex = /^(?:[•\-\*]|\(?\d+[\.\)])\s+/;
    const topicHeadingRegex = /^(?:#{1,6}\s+.*|\*\*[A-Za-z0-9\s/&\u2014\u2013',:?-]{2,60}:?\*\*|[A-Z][A-Za-z0-9\s/&\u2014\u2013',?-]{2,50}:)$/;

    rawBlocks.forEach((block, bIdx) => {
      const trimmed = block.trim();
      if (!trimmed) return;

      // Check if block is an explicit markdown heading
      if (trimmed.startsWith("###") || trimmed.startsWith("##") || trimmed.startsWith("#")) {
        const rawTitle = trimmed.replace(/^#+\s*/, "").replace(/<[^>]+>/g, "").trim();
        const title = rawTitle
          .replace(/^\*\*+|\*\*+$/g, "")
          .replace(/^__+|__+$/g, "")
          .replace(/:$/, "")
          .trim();
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

      // Process lines, clustering consecutive list items
      const rawLines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
      let currentListItems: string[] = [];

      const flushList = (keyPrefix: string) => {
        if (currentListItems.length === 0) return;
        const items = [...currentListItems];
        currentListItems = [];
        elements.push(
          <ul key={`${keyPrefix}-ul`} className="space-y-1.5 my-2 pl-1 text-xs font-sans text-foreground/90">
            {items.map((item, lIdx) => (
              <li key={lIdx} className="flex items-start gap-2 leading-relaxed">
                <span className="flex h-1.5 w-1.5 rounded-full bg-primary/70 shrink-0 mt-1.5" />
                <div className="flex-1 min-w-0">
                  {formatInlineWithLinks(item)}
                </div>
              </li>
            ))}
          </ul>
        );
      };

      rawLines.forEach((line, lIdx) => {
        const isBullet = bulletRegex.test(line);
        if (isBullet) {
          currentListItems.push(line.replace(bulletRegex, ""));
        } else {
          flushList(`b-${bIdx}-l-${lIdx}`);

          // Check if line is a semantic topic heading (e.g. "Role Overview:", "Requirements:", "**What you'll do:**")
          if (topicHeadingRegex.test(line) && line.length < 60) {
            const cleanTitle = line
              .replace(/^#+\s*/, "")
              .replace(/^\*\*|\*\*$/g, "")
              .replace(/:$/, "")
              .trim();
            elements.push(
              <h4
                key={`subh-${bIdx}-${lIdx}`}
                className="text-xs font-sans font-bold text-foreground mt-3 mb-1 first:mt-0 flex items-center gap-1.5 tracking-tight"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                {cleanTitle}
              </h4>
            );
          } else {
            elements.push(
              <p key={`p-${bIdx}-${lIdx}`} className="text-xs font-sans text-foreground/90 leading-relaxed mb-2.5 last:mb-0">
                {formatInlineWithLinks(line)}
              </p>
            );
          }
        }
      });

      flushList(`b-${bIdx}-end`);
    });

    return elements;
  }, [content]);

  return (
    <div className={`space-y-1 text-xs font-sans text-foreground/90 ${className}`}>
      {parsedElements}
    </div>
  );
}
