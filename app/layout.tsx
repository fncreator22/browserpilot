import type { Metadata } from "next";
import Script from "next/script";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "sonner/dist/styles.css";
import { Toaster } from "sonner";
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
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
        <AuthSessionProvider>
          <UIStateProvider>
            {children}
            <CommandPalette />
            <GlobalSettingsModal />
            <AuditInteractionListener />
            <Toaster
              position="top-right"
              closeButton
              expand={true}
              className="toaster group"
              toastOptions={{
                className:
                  "group toast !bg-card !text-foreground !border !border-border shadow-xl font-sans text-xs rounded-xl p-4 !h-auto !min-h-[52px] !w-full max-w-[400px] flex items-start gap-3 transition-all",
                classNames: {
                  toast:
                    "group toast !bg-card !text-foreground !border !border-border shadow-xl font-sans text-xs rounded-xl p-4 !h-auto !min-h-[52px] !w-full max-w-[400px] flex items-start gap-3 transition-all",
                  title: "font-semibold !text-foreground text-sm leading-tight",
                  description: "!text-muted-foreground text-xs mt-1 leading-relaxed break-words whitespace-normal",
                  actionButton:
                    "bg-primary text-primary-foreground font-medium text-xs px-3 py-1.5 rounded-lg shrink-0",
                  cancelButton:
                    "bg-muted text-muted-foreground font-medium text-xs px-3 py-1.5 rounded-lg shrink-0",
                  closeButton:
                    "!bg-muted/80 !border-border !text-muted-foreground hover:!text-foreground shrink-0",
                },
              }}
            />
          </UIStateProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
