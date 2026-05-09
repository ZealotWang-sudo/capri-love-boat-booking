"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const SESSION_STORAGE_KEY = "capri_analytics_session_id";

function getSessionId() {
  try {
    const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY);

    if (existingSessionId) {
      return existingSessionId;
    }

    const nextSessionId =
      typeof window.crypto?.randomUUID === "function"
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextSessionId);

    return nextSessionId;
  } catch {
    return null;
  }
}

export default function PageViewAnalytics({ locale }) {
  const pathname = usePathname();
  const lastTrackedPathRef = useRef("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin") || pathname.startsWith("/api")) {
      return;
    }

    if (lastTrackedPathRef.current === pathname) {
      return;
    }

    lastTrackedPathRef.current = pathname;

    const payload = {
      locale,
      path: pathname,
      referrer: document.referrer || null,
      session_id: getSessionId(),
    };

    fetch("/api/analytics/page-view", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      // Analytics should never affect the booking experience.
    });
  }, [locale, pathname]);

  return null;
}
