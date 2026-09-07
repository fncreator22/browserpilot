import type { Metadata } from "next";
import Script from "next/script";
import { Source_Serif_4, Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { UIStateProvider } from "@/components/providers/ui-state-provider";
import { CommandPalette } from "@/components/navigation/command-palette";
import { MobileNavPill } from "@/components/navigation/mobile-nav-pill";
import { GlobalSettingsModal } from "@/components/settings/global-settings-modal";
import "./globals.css";

const sourceSerif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BrowserPilot | Autonomous Web Agent with Playwright & Gemini 2.5",
  description: "Deterministic, sandboxed browser automation with 4-level progressive disclosure and Gemini 2.5 Flash planning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <AuthSessionProvider>
          <UIStateProvider>
            {children}
            <CommandPalette />
            <MobileNavPill />
            <GlobalSettingsModal />
            <Toaster
              position="top-right"
              theme="system"
              className="toaster group"
              toastOptions={{
                classNames: {
                  toast:
                    "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:font-mono group-[.toaster]:text-xs",
                  description: "group-[.toast]:text-muted-foreground",
                  actionButton:
                    "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
                  cancelButton:
                    "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
                },
              }}
            />
          </UIStateProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
