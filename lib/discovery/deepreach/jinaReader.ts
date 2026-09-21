/**
 * §DEEPREACH JINA READER TRANSPORT
 * Zero-fee public web scraping & markdown extraction via Jina Reader.
 */

export async function fetchViaJinaReader(url: string, timeoutMs?: number): Promise<string | null> {
  const isServerless = Boolean(process.env.VERCEL === "1" || process.env.NEXT_SERVERLESS === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const effectiveTimeout = timeoutMs ?? (isServerless ? 2500 : 8000);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), effectiveTimeout);

    const jinaUrl = `https://r.jina.ai/${url.trim()}`;
    const response = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/markdown",
        "User-Agent": "BrowserPilot/1.0 (DeepReach)",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return null;
    }

    const text = await response.text();
    if (
      text.includes("Unfortunately, bots use DuckDuckGo too") ||
      text.includes("Select all squares containing a duck") ||
      text.includes("Attention Required! | Cloudflare") ||
      text.includes("Please complete the following challenge") ||
      text.includes("challenge to confirm this search was made by a human")
    ) {
      console.warn(`[DeepReach JinaReader] Upstream bot/CAPTCHA challenge detected for URL: ${url}`);
      return null;
    }

    return text;
  } catch {
    return null;
  }
}
