/**
 * §DIRECT ATS COMPANY DIRECTORY
 * 
 * Comprehensive directory of tech companies, startups, unicorns, YC companies,
 * and remote employers with verified public ATS job board slugs (Greenhouse, Ashby, Lever, Workable).
 * Provides direct zero-bot-block candidate harvesting via official public JSON endpoints.
 */

import type { AtsCompanyTarget } from "./atsProvider";

export interface CategorizedAtsCompany extends AtsCompanyTarget {
  category: "AI_ML" | "INFRASTRUCTURE_CLOUD" | "FINTECH" | "CONSUMER_SAAS" | "ENTERPRISE" | "DEVTOOLS" | "WEB3_CRYPTO" | "STARTUP_YC";
  remoteFriendly?: boolean;
}

export const COMPREHENSIVE_ATS_COMPANIES: CategorizedAtsCompany[] = [
  // AI & Machine Learning
  { name: "Anthropic", ashbySlug: "anthropic", category: "AI_ML", remoteFriendly: true },
  { name: "OpenAI", greenhouseSlug: "openai", category: "AI_ML", remoteFriendly: false },
  { name: "Perplexity", ashbySlug: "perplexity", category: "AI_ML", remoteFriendly: true },
  { name: "Cohere", leverSlug: "cohere", category: "AI_ML", remoteFriendly: true },
  { name: "Mistral AI", ashbySlug: "mistral", category: "AI_ML", remoteFriendly: true },
  { name: "Scale AI", greenhouseSlug: "scaleai", category: "AI_ML", remoteFriendly: true },
  { name: "Hugging Face", workableSlug: "huggingface", category: "AI_ML", remoteFriendly: true },
  { name: "Weights and Biases", greenhouseSlug: "weightsandbiases", category: "AI_ML", remoteFriendly: true },
  { name: "Jasper", greenhouseSlug: "jasper", category: "AI_ML", remoteFriendly: true },
  { name: "ElevenLabs", ashbySlug: "elevenlabs", category: "AI_ML", remoteFriendly: true },
  { name: "RunPod", ashbySlug: "runpod", category: "AI_ML", remoteFriendly: true },
  { name: "Together AI", ashbySlug: "togetherai", category: "AI_ML", remoteFriendly: true },
  { name: "Character.ai", greenhouseSlug: "characterai", category: "AI_ML", remoteFriendly: false },
  { name: "Glean", greenhouseSlug: "glean", category: "AI_ML", remoteFriendly: true },
  { name: "Anysphere (Cursor)", ashbySlug: "cursor", category: "AI_ML", remoteFriendly: true },
  { name: "Modal Labs", ashbySlug: "modal", category: "AI_ML", remoteFriendly: true },
  { name: "Replicate", ashbySlug: "replicate", category: "AI_ML", remoteFriendly: true },
  { name: "Fireworks AI", ashbySlug: "fireworks-ai", category: "AI_ML", remoteFriendly: true },
  { name: "LangChain", ashbySlug: "langchain", category: "AI_ML", remoteFriendly: true },
  { name: "Pinecone", greenhouseSlug: "pinecone", category: "AI_ML", remoteFriendly: true },
  { name: "Qdrant", ashbySlug: "qdrant", category: "AI_ML", remoteFriendly: true },
  { name: "Weaviate", ashbySlug: "weaviate", category: "AI_ML", remoteFriendly: true },
  { name: "Writer", greenhouseSlug: "writer", category: "AI_ML", remoteFriendly: true },
  { name: "Midjourney", leverSlug: "midjourney", category: "AI_ML", remoteFriendly: true },
  { name: "Synthesia", greenhouseSlug: "synthesia", category: "AI_ML", remoteFriendly: true },

  // Developer Tools & Infrastructure
  { name: "GitLab", greenhouseSlug: "gitlab", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Vercel", ashbySlug: "vercel", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Supabase", ashbySlug: "supabase", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Linear", ashbySlug: "linear", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Sentry", ashbySlug: "sentry", category: "DEVTOOLS", remoteFriendly: true },
  { name: "PostHog", ashbySlug: "posthog", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Retool", ashbySlug: "retool", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Docker", greenhouseSlug: "docker", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Prisma", ashbySlug: "prisma", category: "DEVTOOLS", remoteFriendly: true },
  { name: "PlanetScale", ashbySlug: "planetscale", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Pulumi", greenhouseSlug: "pulumi", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Temporal", ashbySlug: "temporal", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Cockroach Labs", greenhouseSlug: "cockroachlabs", category: "DEVTOOLS", remoteFriendly: true },
  { name: "HashiCorp", greenhouseSlug: "hashicorp", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Datadog", greenhouseSlug: "datadog", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Cloudflare", greenhouseSlug: "cloudflare", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Fastly", greenhouseSlug: "fastly", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "LaunchDarkly", greenhouseSlug: "launchdarkly", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Confluent", greenhouseSlug: "confluent", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "MongoDB", greenhouseSlug: "mongodb", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Redis", greenhouseSlug: "redis", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Elastic", greenhouseSlug: "elastic", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Kong", greenhouseSlug: "kong", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Grafana Labs", greenhouseSlug: "grafanalabs", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Render", ashbySlug: "render", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Railway", ashbySlug: "railway", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Fly.io", ashbySlug: "fly", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Tailscale", ashbySlug: "tailscale", category: "INFRASTRUCTURE_CLOUD", remoteFriendly: true },
  { name: "Netlify", greenhouseSlug: "netlify", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Depot", ashbySlug: "depot", category: "DEVTOOLS", remoteFriendly: true },
  { name: "WorkOS", ashbySlug: "workos", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Clerk", ashbySlug: "clerk", category: "DEVTOOLS", remoteFriendly: true },
  { name: "Resend", ashbySlug: "resend", category: "DEVTOOLS", remoteFriendly: true },

  // FinTech & Payments
  { name: "Stripe", greenhouseSlug: "stripe", category: "FINTECH", remoteFriendly: true },
  { name: "Ramp", ashbySlug: "ramp", category: "FINTECH", remoteFriendly: true },
  { name: "Brex", greenhouseSlug: "brex", category: "FINTECH", remoteFriendly: true },
  { name: "Plaid", greenhouseSlug: "plaid", category: "FINTECH", remoteFriendly: true },
  { name: "Chime", greenhouseSlug: "chime", category: "FINTECH", remoteFriendly: true },
  { name: "Robinhood", greenhouseSlug: "robinhood", category: "FINTECH", remoteFriendly: true },
  { name: "Revolut", leverSlug: "revolut", category: "FINTECH", remoteFriendly: true },
  { name: "Monzo", leverSlug: "monzo", category: "FINTECH", remoteFriendly: true },
  { name: "Klarna", greenhouseSlug: "klarna", category: "FINTECH", remoteFriendly: true },
  { name: "Affirm", greenhouseSlug: "affirm", category: "FINTECH", remoteFriendly: true },
  { name: "Carta", greenhouseSlug: "carta", category: "FINTECH", remoteFriendly: true },
  { name: "Gusto", greenhouseSlug: "gusto", category: "FINTECH", remoteFriendly: true },
  { name: "Deel", ashbySlug: "deel", category: "FINTECH", remoteFriendly: true },
  { name: "Remote", ashbySlug: "remote", category: "FINTECH", remoteFriendly: true },
  { name: "Rippling", greenhouseSlug: "rippling", category: "FINTECH", remoteFriendly: true },
  { name: "Mercury", greenhouseSlug: "mercury", category: "FINTECH", remoteFriendly: true },

  // Consumer Tech & Marketplaces
  { name: "Figma", greenhouseSlug: "figma", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Notion", leverSlug: "notion", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Canva", greenhouseSlug: "canva", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Loom", greenhouseSlug: "loom", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Miro", greenhouseSlug: "miro", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Webflow", greenhouseSlug: "webflow", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Airtable", greenhouseSlug: "airtable", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Discord", greenhouseSlug: "discord", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "DoorDash", greenhouseSlug: "doordash", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Instacart", greenhouseSlug: "instacart", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Pinterest", greenhouseSlug: "pinterest", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Reddit", greenhouseSlug: "reddit", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Spotify", leverSlug: "spotify", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Duolingo", greenhouseSlug: "duolingo", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Etsy", greenhouseSlug: "etsy", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Automattic", greenhouseSlug: "automattic", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Snap", greenhouseSlug: "snap", category: "CONSUMER_SAAS", remoteFriendly: false },
  { name: "Dropbox", greenhouseSlug: "dropbox", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Asana", greenhouseSlug: "asana", category: "CONSUMER_SAAS", remoteFriendly: true },
  { name: "Grammarly", greenhouseSlug: "grammarly", category: "CONSUMER_SAAS", remoteFriendly: true },

  // Enterprise Software & Cybersecurity
  { name: "Palantir", leverSlug: "palantir", category: "ENTERPRISE", remoteFriendly: false },
  { name: "Databricks", greenhouseSlug: "databricks", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Snowflake", greenhouseSlug: "snowflake", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Wiz", greenhouseSlug: "wiz", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Snyk", greenhouseSlug: "snyk", category: "ENTERPRISE", remoteFriendly: true },
  { name: "1Password", greenhouseSlug: "1password", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Verkada", greenhouseSlug: "verkada", category: "ENTERPRISE", remoteFriendly: false },
  { name: "Samsara", greenhouseSlug: "samsara", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Okta", greenhouseSlug: "okta", category: "ENTERPRISE", remoteFriendly: true },
  { name: "CrowdStrike", greenhouseSlug: "crowdstrike", category: "ENTERPRISE", remoteFriendly: true },
  { name: "SentinelOne", greenhouseSlug: "sentinelone", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Bitwarden", greenhouseSlug: "bitwarden", category: "ENTERPRISE", remoteFriendly: true },
  { name: "ServiceTitan", greenhouseSlug: "servicetitan", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Toast", greenhouseSlug: "toast", category: "ENTERPRISE", remoteFriendly: true },
  { name: "Rubrik", greenhouseSlug: "rubrik", category: "ENTERPRISE", remoteFriendly: true },

  // Web3 & Crypto
  { name: "Coinbase", greenhouseSlug: "coinbase", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "Kraken", leverSlug: "kraken", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "Uniswap Labs", ashbySlug: "uniswap", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "Alchemy", greenhouseSlug: "alchemy", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "Chainlink Labs", greenhouseSlug: "chainlink", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "ConsenSys", greenhouseSlug: "consensys", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "OpenSea", greenhouseSlug: "opensea", category: "WEB3_CRYPTO", remoteFriendly: true },
  { name: "dYdX", ashbySlug: "dydx", category: "WEB3_CRYPTO", remoteFriendly: true },

  // High-Growth YC & Early Stage Startups
  { name: "Monad Labs", ashbySlug: "monad", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Baseten", ashbySlug: "baseten", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Decagon", ashbySlug: "decagon", category: "STARTUP_YC", remoteFriendly: false },
  { name: "Cognition AI", ashbySlug: "cognition", category: "STARTUP_YC", remoteFriendly: false },
  { name: "Sierra AI", ashbySlug: "sierra", category: "STARTUP_YC", remoteFriendly: false },
  { name: "Harvey AI", ashbySlug: "harvey", category: "STARTUP_YC", remoteFriendly: false },
  { name: "Mercor", ashbySlug: "mercor", category: "STARTUP_YC", remoteFriendly: true },
  { name: "LlamaIndex", ashbySlug: "llamaindex", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Helicone", ashbySlug: "helicone", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Vapi", ashbySlug: "vapi", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Cartesia", ashbySlug: "cartesia", category: "STARTUP_YC", remoteFriendly: false },
  { name: "PlayHT", ashbySlug: "playht", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Pika Labs", ashbySlug: "pika", category: "STARTUP_YC", remoteFriendly: false },
  { name: "HeyGen", ashbySlug: "heygen", category: "STARTUP_YC", remoteFriendly: false },
  { name: "Cursor", ashbySlug: "cursor", category: "STARTUP_YC", remoteFriendly: true },
  { name: "E2B", ashbySlug: "e2b", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Daytona", ashbySlug: "daytona", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Speakeasy", ashbySlug: "speakeasy", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Inngest", ashbySlug: "inngest", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Dub", ashbySlug: "dub", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Cal.com", ashbySlug: "cal", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Trigger.dev", ashbySlug: "triggerdev", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Mintlify", ashbySlug: "mintlify", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Documenso", ashbySlug: "documenso", category: "STARTUP_YC", remoteFriendly: true },
  { name: "Novu", ashbySlug: "novu", category: "STARTUP_YC", remoteFriendly: true },
];

export function searchAtsDirectory(options: {
  query?: string;
  category?: string;
  remoteOnly?: boolean;
  limit?: number;
}): AtsCompanyTarget[] {
  const { query = "", category, remoteOnly = false, limit = 40 } = options;
  const qLower = query.toLowerCase().trim();

  const matches = COMPREHENSIVE_ATS_COMPANIES.filter((company) => {
    if (remoteOnly && !company.remoteFriendly) return false;
    if (category && category !== "ALL" && company.category !== category) return false;

    if (!qLower) return true;

    const nameMatch = company.name.toLowerCase().includes(qLower);
    const slugMatch =
      company.greenhouseSlug?.toLowerCase().includes(qLower) ||
      company.ashbySlug?.toLowerCase().includes(qLower) ||
      company.leverSlug?.toLowerCase().includes(qLower) ||
      company.workableSlug?.toLowerCase().includes(qLower);

    return nameMatch || slugMatch;
  });

  return matches.slice(0, limit);
}

export function resolveAtsCompany(nameOrDomain: string): AtsCompanyTarget {
  const clean = nameOrDomain
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.(com|io|ai|co|org|dev|net|app).*$/, "")
    .replace(/[^a-z0-9]/g, "");

  const existing = COMPREHENSIVE_ATS_COMPANIES.find(
    (c) => c.name.toLowerCase().replace(/[^a-z0-9]/g, "") === clean
  );

  if (existing) return existing;

  return {
    name: nameOrDomain.replace(/^https?:\/\//, "").replace(/^www\./, ""),
    greenhouseSlug: clean,
    ashbySlug: clean,
    leverSlug: clean,
  };
}
