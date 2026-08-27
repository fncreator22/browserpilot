/**
 * §SEMANTIC HTML DISTILLER & TOKEN DEFLUFFER
 * Strips noise (scripts, styles, SVGs, classes, tracking IDs) to reduce
 * LLM token footprint by 80–90% while preserving tables, lists, text, and link hierarchies.
 */

export interface DistillerOptions {
  maxCharacters?: number;
  preserveLinks?: boolean;
  extractTablesOnly?: boolean;
}

export function distillHtml(rawHtml: string, options: DistillerOptions = {}): string {
  if (!rawHtml || typeof rawHtml !== "string") return "";

  const maxChars = options.maxCharacters || 35000;
  const preserveLinks = options.preserveLinks !== false;

  let cleaned = rawHtml;

  // 1. Remove comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, " ");

  // 2. Remove non-content tags completely (scripts, styles, SVGs, iframes, noscripts, canvas)
  cleaned = cleaned.replace(/<(script|style|svg|noscript|iframe|canvas|video|audio|template|object|embed)[\s\S]*?<\/\1>/gi, " ");

  // 3. Remove inline SVG and base64 data URIs
  cleaned = cleaned.replace(/src=["']data:image\/[^"']+["']/gi, 'src=""');

  // 4. Remove noisy attributes (class, style, data-*, aria-*, on*, id)
  cleaned = cleaned.replace(/\s+(class|style|data-[a-z0-9_-]+|aria-[a-z0-9_-]+|on[a-z]+|id|tabindex|role)=["'][^"']*["']/gi, "");

  // 5. Convert links to clean Markdown [Text](URL) if preserveLinks is enabled
  if (preserveLinks) {
    cleaned = cleaned.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, text) => {
      const cleanText = text.replace(/<[^>]+>/g, "").trim();
      const cleanHref = href.trim();
      if (!cleanText || cleanHref.startsWith("javascript:") || cleanHref.startsWith("#")) {
        return cleanText || "";
      }
      return ` [${cleanText}](${cleanHref}) `;
    });
  }

  // 6. Convert headings, paragraphs, and list items to structured markdown
  cleaned = cleaned.replace(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi, "\n\n### $1\n");
  cleaned = cleaned.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, "\n\n#### $1\n");
  cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n* $1");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  cleaned = cleaned.replace(/<hr\s*\/?>/gi, "\n---\n");

  // 7. Format table cells and rows into readable text
  cleaned = cleaned.replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, " | $1 ");
  cleaned = cleaned.replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, " | $1 ");
  cleaned = cleaned.replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, "\n$1 |");

  // 8. Strip all remaining HTML tags
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 9. Decode common HTML entities
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");

  // 10. Normalize whitespace, remove excessive blank lines
  cleaned = cleaned
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();

  // 11. Bounded character slice to prevent token overflow
  if (cleaned.length > maxChars) {
    cleaned = cleaned.slice(0, maxChars) + "\n\n... [Content truncated for optimal token processing]";
  }

  return cleaned;
}

/**
 * Extracts page title from raw HTML
 */
export function extractPageTitle(rawHtml: string): string {
  if (!rawHtml) return "Webpage";
  const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    return titleMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  const h1Match = rawHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    return h1Match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }
  return "Webpage";
}
