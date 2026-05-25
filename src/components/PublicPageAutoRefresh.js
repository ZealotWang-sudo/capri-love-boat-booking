"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_REFRESH_INTERVAL_MS = 30 * 1000;

export default function PublicPageAutoRefresh({
  intervalMs = DEFAULT_REFRESH_INTERVAL_MS,
}) {
  const router = useRouter();

  useEffect(() => {
    const refreshPage = () => {
      router.refresh();
    };
    const interval = window.setInterval(refreshPage, intervalMs);

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshPage();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
