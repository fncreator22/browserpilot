/**
 * §PLUGINS & CONNECTORS MARKETPLACE TYPES & CONSTANTS
 * 
 * Shared types and constants safe for both Client and Server bundles.
 * Strictly no Node.js built-ins or database drivers in this file.
 */

export type PluginType = "DIRECT_FREE" | "AUTH_REQUIRED";
export type PluginCategory = "ATS_BOARD" | "TECH_COMMUNITY" | "PROFESSIONAL_NETWORK" | "SEARCH_ENGINE" | "NOTIFICATION_INTEGRATION";
export type AuthMethodType = "DIRECT_FREE" | "OAUTH" | "BYOC_COOKIE" | "SESSION_TOKEN" | "API_TOKEN";

export interface MarketplacePlugin {
  id: string;
  name: string;
  displayName: string;
  category: PluginCategory;
  type: PluginType;
  authProvider?: "GOOGLE" | "LINKEDIN" | "TWITTER" | "REDDIT" | "CUSTOM";
  supportedAuthTypes?: AuthMethodType[];
  iconUrl?: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  isPrototype?: boolean;
  prototypeTag?: string;
}

export interface UserPluginStatus extends MarketplacePlugin {
  isConnected: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "REQUIRES_AUTH" | "EXPIRED" | "REQUIRES_REAUTH";
  connectedAt?: string | null;
  maskedAccount?: string | null;
  expiresAt?: string | null;
  authMethod?: AuthMethodType | string;
  reauthRequired?: boolean;
  reauthReason?: string | null;
  lastHealthCheck?: string | null;
}

export const MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  // 1-Click Direct Free Plugins
  {
    id: "greenhouse",
    name: "Greenhouse",
    displayName: "Greenhouse ATS Engine",
    category: "ATS_BOARD",
    type: "DIRECT_FREE",
    description: "Direct real-time job stream from 15,000+ top tech employers hiring on Greenhouse.",
    features: ["Zero API key required", "Direct 1-click connect", "Continuous auto-sync"],
    isPopular: true,
  },
  {
    id: "lever",
    name: "Lever",
    displayName: "Lever Portal Scout",
    category: "ATS_BOARD",
    type: "DIRECT_FREE",
    description: "Harvest open roles, internships, and recruiter listings directly from Lever career boards.",
    features: ["Instant access", "Fresh listings verification", "Full JD parsing"],
    isPopular: true,
  },
  {
    id: "ashby",
    name: "Ashby",
    displayName: "Ashby High-Growth Board",
    category: "ATS_BOARD",
    type: "DIRECT_FREE",
    description: "Connects to next-generation AI and high-growth venture-backed company job boards.",
    features: ["Modern startups", "Fast application links", "Salary transparency"],
    isPopular: true,
  },
  {
    id: "ycombinator",
    name: "Y Combinator",
    displayName: "YC Work at a Startup",
    category: "TECH_COMMUNITY",
    type: "DIRECT_FREE",
    description: "Pulls early-stage, Series A-C venture-funded technical openings and founder postings.",
    features: ["Founder-led hiring", "Remote & Bay Area", "Verified startup roles"],
    isPopular: true,
  },
  {
    id: "hackernews",
    name: "Hacker News",
    displayName: "HN Who is Hiring?",
    category: "TECH_COMMUNITY",
    type: "DIRECT_FREE",
    description: "Analyzes monthly Who is Hiring threads with engineering manager direct contact info.",
    features: ["Direct hiring manager emails", "Transparent compensation", "Zero middlemen"],
  },
  {
    id: "wellfound",
    name: "Wellfound",
    displayName: "Wellfound (AngelList)",
    category: "ATS_BOARD",
    type: "DIRECT_FREE",
    description: "Discovers tech internships, engineering fellowships, and junior developer positions.",
    features: ["Internship focus", "Startup ecosystem", "Skill matching"],
  },

  // Authenticated Plugins (User Authorization & Permission Based)
  {
    id: "google_jobs",
    name: "Google",
    displayName: "Google Search & Jobs Connector",
    category: "SEARCH_ENGINE",
    type: "AUTH_REQUIRED",
    authProvider: "GOOGLE",
    supportedAuthTypes: ["OAUTH"],
    description: "Connect via your Google account to query Google Jobs index with elevated rate limits.",
    features: ["Google Jobs API permission", "Personalized recommendations", "Location radius search"],
    isPopular: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    displayName: "LinkedIn Recruiter Intelligence",
    category: "PROFESSIONAL_NETWORK",
    type: "AUTH_REQUIRED",
    authProvider: "LINKEDIN",
    supportedAuthTypes: ["BYOC_COOKIE", "SESSION_TOKEN", "OAUTH"],
    description: "Search LinkedIn public feeds & recruiter profiles safely using permissioned session grants.",
    features: ["HR & recruiter discovery", "Company headcount intelligence", "Employee profile links"],
    isPopular: true,
  },
  {
    id: "x_twitter",
    name: "X (Twitter)",
    displayName: "X Technical Hiring Wire",
    category: "PROFESSIONAL_NETWORK",
    type: "AUTH_REQUIRED",
    authProvider: "TWITTER",
    supportedAuthTypes: ["BYOC_COOKIE", "SESSION_TOKEN", "OAUTH"],
    description: "Scouts hiring announcements, engineering lead posts, and stealth startup job flyers.",
    features: ["Real-time tweet monitoring", "Engineering manager DMs", "Early stealth roles"],
  },
  {
    id: "reddit",
    name: "Reddit",
    displayName: "Reddit Hiring Communities",
    category: "TECH_COMMUNITY",
    type: "AUTH_REQUIRED",
    authProvider: "REDDIT",
    supportedAuthTypes: ["BYOC_COOKIE", "SESSION_TOKEN", "OAUTH"],
    description: "Crawls r/forhire, r/cscareerquestions, r/remotework with anti-bot rate management.",
    features: ["Community job posts", "Freelance & contract roles", "Salary discussions"],
  },

  // Prototype Plugins (Features under active integration)
  {
    id: "email_digest",
    name: "Email Sync",
    displayName: "Email Application & Alert Sync",
    category: "NOTIFICATION_INTEGRATION",
    type: "AUTH_REQUIRED",
    authProvider: "CUSTOM",
    description: "Automatic email parsing for application receipts, interview requests, and new job notifications.",
    features: ["Inbox parsing", "Status tracking", "Alert dispatch"],
    isPrototype: true,
    prototypeTag: "Prototype",
  },
  {
    id: "slack_alerts",
    name: "Slack",
    displayName: "Slack Direct Notification Hook",
    category: "NOTIFICATION_INTEGRATION",
    type: "AUTH_REQUIRED",
    authProvider: "CUSTOM",
    description: "Post instantaneous high-scoring match alerts directly into your private Slack channel.",
    features: ["Custom webhook", "High match threshold", "Real-time pings"],
    isPrototype: true,
    prototypeTag: "Prototype",
  },
  {
    id: "github_curated",
    name: "GitHub Curated",
    displayName: "GitHub Hiring Repository Crawler",
    category: "TECH_COMMUNITY",
    type: "DIRECT_FREE",
    description: "Parses monthly trending hiring repositories, open issues, and startup job lists on GitHub.",
    features: ["Repo monitoring", "Markdown parsing", "Commit tracking"],
    isPrototype: true,
    prototypeTag: "Prototype",
  },
];
