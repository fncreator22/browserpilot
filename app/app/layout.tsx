import React from "react";
import { AppLayoutShell } from "@/components/navigation/app-layout-shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppLayoutShell>{children}</AppLayoutShell>;
}
