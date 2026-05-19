"use client";

import { useState } from "react";
import { formatCustomerDate } from "@/lib/formatCustomerDate";

export default function BookingRequestSummary({ labels, locale }) {
  const [summary] = useState(() => {
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
      window.sessionStorage.removeItem("bookingRequestSummary");
      return null;
    }
  });

  if (!summary) {
    return null;
  }

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
  ].filter(([, value]) => value);

  return (
    <div className="relative mx-auto  mt-10 max-w-xl border border-stone-300 bg-[#fbf8f3] p-5 text-left
      after:pointer-events-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-6 after:bg-gradient-to-t after:from-[#fbf8f3] after:to-[#fbf8f300] after:content-['']"
    >

      <dl className=" divide-y divide-stone-300">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-2 py-3 text-sm leading-6 sm:grid-cols-[160px_1fr]"
          >
            <dt className="text-stone-500">{label}</dt>
            <dd className="text-stone-950">{value}</dd>
          </div>
        ))}
      </dl>
      {summary.message ? (
        <div className="mt-4 border-t border-stone-300 pt-4 text-sm leading-7">
          <p className="text-stone-500">{labels.message}</p>
          <p className="mt-1 text-stone-950">{summary.message}</p>
        </div>
      ) : null}
    </div>
  );
}
