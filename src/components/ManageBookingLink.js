"use client";

import { useState } from "react";

function getStoredSummary() {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSummary = window.sessionStorage.getItem("bookingRequestSummary");

  if (!storedSummary) {
    return null;
  }

  try {
    return JSON.parse(storedSummary);
  } catch {
    return null;
  }
}

export default function ManageBookingLink({ labels }) {
  const [summary] = useState(getStoredSummary);
  const manageUrl = typeof summary?.manageUrl === "string" ? summary.manageUrl : "";

  if (!manageUrl) {
    return null;
  }

  return (
    <a
      href={manageUrl}
      className="border border-stone-300 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
    >
      {labels.manageBookingPage}
    </a>
  );
}
