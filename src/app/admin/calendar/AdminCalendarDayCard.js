"use client";

import { useState } from "react";
import AdminSubmitButton from "../AdminSubmitButton";
import { getDisplayTimeForTimeSlot } from "@/lib/bookingAvailability";
import {
  markTimeSlotAvailable,
  markTimeSlotUnavailable,
} from "./actions";

const TOUR_LABELS = {
  two_half_hours: "2.5 hours",
  three_hours: "3 hours",
  four_hours: "4 hours",
  sunset_three_hours: "Sunset 3 hours",
  five_hours: "5 hours",
  two_hours: "2 hours",
  special_request: "Special request",
};

function formatReferenceCode(id) {
  return id ? `CAPRI-${id.slice(0, 8).toUpperCase()}` : "CAPRI";
}

function getAllPeriodTimeSlots(periodStates) {
  return periodStates.flatMap((periodState) => periodState.period.timeSlots);
}

function getPeriodBarClass(status) {
  if (status === "booked") {
    return "border-red-300 bg-red-300 text-red-900";
  }

  if (status === "unavailable") {
    return "border-stone-300 bg-stone-300 text-stone-700";
  }

  if (status === "partly unavailable") {
    return "border-amber-300 bg-amber-300 text-amber-900";
  }

  return "border-emerald-200 bg-emerald-300 text-emerald-950";
}

function PeriodTimelineBars({ periodStates }) {
  return (
    <div className="mt-4 space-y-2">
      {periodStates.map(({ period, status }) => (
        <div
          key={period.id}
          className={`flex items-center justify-between gap-2 border px-3 py-1 text-xs ${getPeriodBarClass(status)}`}
        >
          <div>
            {/* <p className="font-medium">{period.label.replace(" schedule", "")}</p>
            <p className="mt-0.5 text-[0.65rem] opacity-70">{period.timeRange}</p> */}
          </div>
          {/* <p className="text-[0.58rem] uppercase tracking-[0.12em]">{status}</p> */}
        </div>
      ))}
    </div>
  );
}

function WholeDayAction({ date, isFullyUnavailable, month, periodStates }) {
  const unbookedPeriodTimeSlots = periodStates
    .filter((periodState) => periodState.bookings.length === 0)
    .flatMap((periodState) => periodState.period.timeSlots);
  const timeSlots = isFullyUnavailable
    ? getAllPeriodTimeSlots(periodStates)
    : unbookedPeriodTimeSlots;
  const action = isFullyUnavailable ? markTimeSlotAvailable : markTimeSlotUnavailable;
  const label = isFullyUnavailable
    ? "Make whole day available"
    : timeSlots.length === getAllPeriodTimeSlots(periodStates).length
      ? "Mark whole day unavailable"
      : "Mark open periods unavailable";

  if (timeSlots.length === 0) {
    return null;
  }

  return (
    <form action={action} className="mt-5">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="month" value={month} />
      {!isFullyUnavailable ? (
        <input type="hidden" name="reason" value="Whole day unavailable" />
      ) : null}
      {timeSlots.map((timeSlot) => (
        <input key={timeSlot} type="hidden" name="timeSlot" value={timeSlot} />
      ))}
      <AdminSubmitButton
        pendingLabel={isFullyUnavailable ? "Making available..." : "Blocking..."}
        className={`w-[300px] border  px-3 py-3 text-[0.62rem] font-medium uppercase tracking-[0.14em] transition ${
          isFullyUnavailable
            ? "border-stone-400 text-stone-700 hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7]"
            : "border-stone-950 bg-stone-950 text-[#f3eee7] hover:bg-transparent hover:text-stone-950"
        } disabled:cursor-wait disabled:opacity-60`}
      >
        {label}
      </AdminSubmitButton>
    </form>
  );
}

function UnavailableSlotAction({ date, month, period }) {
  return (
    <form action={markTimeSlotAvailable} className="mt-3">
      <input type="hidden" name="date" value={date} />
      {period.timeSlots.map((timeSlot) => (
        <input key={timeSlot} type="hidden" name="timeSlot" value={timeSlot} />
      ))}
      <input type="hidden" name="month" value={month} />
      <AdminSubmitButton
        pendingLabel="Updating..."
        className="border border-stone-400 px-2.5 py-1.5 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        Make available
      </AdminSubmitButton>
    </form>
  );
}

function AvailableSlotAction({ date, month, period }) {
  return (
    <form action={markTimeSlotUnavailable} className="mt-3 grid gap-2">
      <input type="hidden" name="date" value={date} />
      {period.timeSlots.map((timeSlot) => (
        <input key={timeSlot} type="hidden" name="timeSlot" value={timeSlot} />
      ))}
      <input type="hidden" name="month" value={month} />
      <input
        name="reason"
        placeholder="Optional reason"
        className="w-full border border-stone-300 bg-[#fbf8f3] px-2.5 py-2 text-xs outline-none focus:border-stone-950"
      />
      <AdminSubmitButton
        pendingLabel="Blocking..."
        className="w-[200px] border border-stone-950 bg-stone-950 px-2.5 py-2 text-[0.6rem] font-medium uppercase tracking-[0.12em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
      >
        Mark unavailable
      </AdminSubmitButton>
    </form>
  );
}

function PeriodCard({ date, month, periodState }) {
  const { bookings, period, status, unavailableSlots } = periodState;
  const isUnavailable = status === "unavailable";
  const isPartiallyUnavailable = status === "partly unavailable";
  const hasBookings = bookings.length > 0;
  const unavailableReason =
    unavailableSlots.find((unavailableSlot) => unavailableSlot.reason)?.reason ?? "";

  return (
    <div className={`border p-4 ${getPeriodBarClass(status)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{period.label}</p>
          <p className="mt-1 text-xs opacity-70">{period.timeRange}</p>
        </div>
        <p className="text-[0.58rem] uppercase tracking-[0.12em]">{status}</p>
      </div>

      {isUnavailable || isPartiallyUnavailable ? (
        <div className="mt-3 text-xs leading-5">
          {unavailableReason || "Manual block"}
        </div>
      ) : null}

      {hasBookings ? (
        <div className="mt-3 space-y-2">
          {bookings.map((booking) => (
            <div key={booking.id} className="border-t border-current/20 pt-2">
              <p className="text-xs font-medium">{booking.customer_name || "Guest"}</p>
              <p className="mt-1 text-[0.68rem] leading-5 opacity-80">
                {TOUR_LABELS[booking.tour_type] ?? booking.tour_type} ·{" "}
                {booking.time_window || getDisplayTimeForTimeSlot(booking.time_slot)}
              </p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.12em] opacity-70">
                {formatReferenceCode(booking.id)} · {booking.booking_status}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {hasBookings ? null : isUnavailable ? (
        <UnavailableSlotAction date={date} month={month} period={period} />
      ) : (
        <AvailableSlotAction date={date} month={month} period={period} />
      )}
    </div>
  );
}

export default function AdminCalendarDayCard({
  date,
  dayNumber,
  isFullyUnavailable,
  month,
  periodStates,
  weekday,
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="border border-stone-300 bg-[#f3eee7] p-4 text-left outline-none transition hover:border-stone-950 hover:shadow-sm focus:border-stone-950 focus:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-3xl font-light">{dayNumber}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
              {weekday}
            </p>
          </div>
          <p className="text-right text-[0.62rem] uppercase tracking-[0.14em] text-stone-500">
            {date}
          </p>
        </div>

        <PeriodTimelineBars periodStates={periodStates} />
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/50 px-4 py-8">
          <div className="mx-auto max-w-3xl border border-stone-300 bg-[#f3eee7] p-5 shadow-xl sm:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-5">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
                  {weekday} · {date}
                </p>
                <h2 className="mt-3 text-4xl font-light tracking-[-0.03em]">
                  Day {dayNumber}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="border border-stone-950 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] transition hover:bg-stone-950 hover:text-[#f3eee7]"
              >
                Close
              </button>
            </div>

            <WholeDayAction
              date={date}
              isFullyUnavailable={isFullyUnavailable}
              month={month}
              periodStates={periodStates}
            />

            <div className="mt-6 space-y-4">
              {periodStates.map((periodState) => (
                <PeriodCard
                  key={periodState.period.id}
                  date={date}
                  month={month}
                  periodState={periodState}
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
