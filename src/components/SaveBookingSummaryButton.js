"use client";

import { useState } from "react";
import { formatCustomerDate } from "@/lib/formatCustomerDate";

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

function buildSummaryText(summary, labels, locale) {
  const rows = [
    [labels.reference, summary.referenceCode],
    [labels.name, summary.customerName],
    [labels.email, summary.email],
    [labels.phone, summary.phone],
    [labels.guests, summary.guestCount],
    [labels.date, formatCustomerDate(summary.requestedDate, locale)],
    [labels.tour, summary.tourLabel],
    [labels.time, summary.timeLabel],
    [labels.totalPrice, summary.totalPrice],
    [labels.originalReservationFee, summary.promoCode ? summary.originalReservationFee : ""],
    [labels.promoCode, summary.promoCode],
    [labels.promoDiscount, summary.promoDiscount],
    [labels.reserveToday, summary.reserveToday],
    [labels.payOnBoard, summary.payOnBoard],
    [labels.message, summary.message],
  ].filter(([, value]) => value);

  return [
    labels.title,
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
  ].join("\n");
}

export default function SaveBookingSummaryButton({ labels, locale }) {
  const [summary] = useState(getStoredSummary);

  if (!summary) {
    return null;
  }

  function handleDownload() {
    const text = buildSummaryText(summary, labels, locale);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const reference = summary.referenceCode || "capri-booking-request";

    link.href = url;
    link.download = `${reference}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="border border-stone-300 px-8 py-4 text-xs font-medium uppercase tracking-[0.22em] text-stone-700 transition hover:border-stone-950 hover:text-stone-950"
    >
      {labels.saveToComputer}
    </button>
  );
}
