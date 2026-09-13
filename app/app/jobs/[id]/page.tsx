"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCw } from "lucide-react";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;
  const router = useRouter();

  useEffect(() => {
    // Seamlessly forward to active discovery workspace without flashing legacy UI
    router.replace(`/app?searchId=${encodeURIComponent(jobId)}`);
  }, [jobId, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
      <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[#1F3D2E]/10 text-[#1F3D2E]">
        <RotateCw className="h-6 w-6 animate-spin stroke-[1.75]" />
      </div>
      <div className="space-y-1">
        <h3 className="text-base font-serif font-bold text-foreground">
          Forwarding to Career Discovery Workspace
        </h3>
        <p className="text-xs text-muted-foreground font-sans">
          Loading verified opportunity dossiers for your active session...
        </p>
      </div>
    </div>
  );
}
