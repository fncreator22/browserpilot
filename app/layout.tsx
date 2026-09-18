import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "sonner/dist/styles.css";
import { ResponsiveToaster } from "@/components/providers/responsive-toaster";
import { AuthSessionProvider } from "@/components/auth/session-provider";
import { UIStateProvider } from "@/components/providers/ui-state-provider";
import { CommandPalette } from "@/components/navigation/command-palette";
import { GlobalSettingsModal } from "@/components/settings/global-settings-modal";
import { AuditInteractionListener } from "@/components/audit/audit-interaction-listener";
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
  title: "Radar | Autonomous Opportunity & Career Intelligence",
  description: "Distraction-free autonomous opportunity discovery powered by DeepSeek & Gemini reasoning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} min-h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <AuthSessionProvider>
          <UIStateProvider>
            {children}
            <CommandPalette />
            <GlobalSettingsModal />
            <AuditInteractionListener />
            <ResponsiveToaster />
          </UIStateProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
