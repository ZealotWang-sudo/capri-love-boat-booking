"use client";

import { useState } from "react";

const NOTICE_STYLES = {
  error: "border-red-900/30 bg-red-50 text-red-900",
  success: "border-emerald-900/20 bg-emerald-50 text-emerald-900",
};

export default function AdminNotice({ children, tone = "success" }) {
  const [isVisible, setIsVisible] = useState(true);
  const toneClass = NOTICE_STYLES[tone] ?? NOTICE_STYLES.success;

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed right-5 top-5 z-[80] w-[calc(100vw-2.5rem)] max-w-md">
      <div
        className={`flex items-start justify-between gap-4 border p-4 text-sm leading-6 shadow-xl ${toneClass}`}
      >
        <div>{children}</div>
        <button
          type="button"
          aria-label="Dismiss notification"
          onClick={() => setIsVisible(false)}
          className="shrink-0 text-lg leading-none opacity-70 transition hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}
