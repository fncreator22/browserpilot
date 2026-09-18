import { toast } from "sonner";

export function showDeduplicatedCancelToast(description: string = "Search execution was cancelled.") {
  const g = (typeof window !== "undefined" ? window : globalThis) as any;
  const now = Date.now();
  if (g.__browserpilot_last_cancel_toast && now - g.__browserpilot_last_cancel_toast < 3500) {
    return;
  }
  g.__browserpilot_last_cancel_toast = now;
  try {
    toast.dismiss("search-cancelled-singleton");
  } catch {}
  toast.info("Search Cancelled", {
    id: "search-cancelled-singleton",
    description,
    duration: 3000,
  });
}

