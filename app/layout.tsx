import type { Metadata } from "next";
import { Suspense } from "react";
import Script from "next/script";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "sonner/dist/styles.css";
import { ResponsiveToaster } from "@/components/providers/responsive-toaster";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { UIStateProvider } from "@/components/providers/ui-state-provider";
import { CommandPalette } from "@/components/navigation/command-palette";
import { GlobalSettingsModal } from "@/components/settings/global-settings-modal";
import { AuditInteractionListener } from "@/components/audit/audit-interaction-listener";
import { AnalyticsProvider } from "@/components/analytics/analytics-provider";
import { RouteProgressBar } from "@/components/navigation/route-progress-bar";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || "https://browserpilot-gold.vercel.app"),
  title: {
    default: "Radar | Autonomous Opportunity & Career Intelligence",
    template: "%s | Radar Intelligence",
  },
  description: "Distraction-free autonomous opportunity discovery and career intelligence powered by DeepSeek and Gemini reasoning.",
  keywords: [
    "autonomous job search",
    "career radar",
    "software engineer jobs",
    "remote tech jobs",
    "real-time opportunity intelligence",
    "generative engine optimization",
    "GEO",
  ],
  authors: [{ name: "BrowserPilot Team" }],
  creator: "BrowserPilot",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/favicon.svg" },
    ],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Radar | Autonomous Opportunity & Career Intelligence",
    description: "Autonomous career agent detecting verified, unlisted, and novel opportunities in real time.",
    url: "https://browserpilot-gold.vercel.app",
    siteName: "Radar Intelligence",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Radar | Autonomous Opportunity & Career Intelligence",
    description: "Autonomous career agent detecting verified, unlisted, and novel opportunities in real time.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Suspense fallback={null}>
          <RouteProgressBar />
        </Suspense>
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <AuthSessionProvider>
          <UIStateProvider>
            <AnalyticsProvider>
              {children}
              <CommandPalette />
              <GlobalSettingsModal />
              <AuditInteractionListener />
              <ResponsiveToaster />
            </AnalyticsProvider>
          </UIStateProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
