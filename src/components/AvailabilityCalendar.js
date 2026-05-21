"use client";

import { useEffect, useMemo, useState } from "react";

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMonthKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function getMonthDays(displayDate) {
  const year = displayDate.getFullYear();
  const month = displayDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    days.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    days.push(new Date(year, month, day));
  }

  return days;
}

export default function AvailabilityCalendar({
  alternativeAvailableDates = [],
  fullyBookedDates = [],
  name = "date",
  label,
  labels,
  error,
  isLoading = false,
  loadingLabel,
  onMonthChange,
  onSelect,
  partiallyBookedDates = [],
  value,
}) {
  const today = useMemo(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [displayDate, setDisplayDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState("");
  const selectedDateValue = value ?? selectedDate;
  const alternativeAvailableDateSet = useMemo(
    () => new Set(alternativeAvailableDates),
    [alternativeAvailableDates],
  );
  const fullyBookedDateSet = useMemo(
    () => new Set(fullyBookedDates),
    [fullyBookedDates],
  );
  const partiallyBookedDateSet = useMemo(
    () => new Set(partiallyBookedDates),
    [partiallyBookedDates],
  );
  const monthDays = getMonthDays(displayDate);
  const monthLabel = new Intl.DateTimeFormat(labels.locale, {
    month: "long",
    year: "numeric",
  }).format(displayDate);

  useEffect(() => {
    onMonthChange?.(formatMonthKey(displayDate));
  }, [displayDate, onMonthChange]);

  function moveMonth(direction) {
    setDisplayDate(
      (currentDate) =>
        new Date(
          currentDate.getFullYear(),
          currentDate.getMonth() + direction,
          1,
        ),
    );
  }

  function handleSelect(date) {
    if (isLoading) {
      return;
    }

    const dateKey = formatDateKey(date);

    setSelectedDate(dateKey);
    onSelect?.(dateKey);
  }

  return (
    <div>
      <input
        type="hidden"
        name={name}
        value={selectedDateValue}
        required
        readOnly
      />
      <div className="flex items-end justify-between gap-4">
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {label}
        </label>
        <div className="text-right">
          <p className="mt-1 border border-stone-950 bg-stone-950 px-3 py-1.5 text-sm font-medium tracking-[0.08em] text-[#f3eee7]">
            {selectedDateValue || "—"}
          </p>
        </div>
      </div>

      <div className="mt-3 border border-stone-300 bg-[#f3eee7]/40 p-4">
        <div className="flex items-center justify-between gap-4 border-b border-stone-300 pb-4">
          <button
            type="button"
            onClick={() => moveMonth(-1)}
            className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
            aria-label={labels.previousMonth}
          >
            {labels.previous}
          </button>
          <h2 className="text-center text-lg font-light capitalize tracking-[-0.02em]">
            {monthLabel}
          </h2>
          <button
            type="button"
            onClick={() => moveMonth(1)}
            className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
            aria-label={labels.nextMonth}
          >
            {labels.next}
          </button>
        </div>

        <div className="relative" aria-busy={isLoading} aria-live="polite">
        {isLoading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#f3eee7]/80 backdrop-blur-[1px]">
            <p className="border border-stone-300 bg-[#fbf8f3] px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 shadow-sm">
              {loadingLabel || labels.loading}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-5 border-b border-stone-300 pb-4 text-xs uppercase tracking-[0.16em] text-stone-500">
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 bg-emerald-600"
              aria-hidden="true"
            />
            {labels.available}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 bg-red-700"
              aria-hidden="true"
            />
            {labels.booked}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 bg-orange-500"
              aria-hidden="true"
            />
            {labels.partiallyBooked}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 bg-amber-500"
              aria-hidden="true"
            />
            {labels.otherTourAvailable}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 bg-stone-400"
              aria-hidden="true"
            />
            {labels.unavailable}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {labels.weekdays.map((weekday) => (
            <div
              key={weekday}
              className="pb-1 text-center text-[10px] uppercase tracking-[0.16em] text-stone-500"
            >
              {weekday}
            </div>
          ))}
          {monthDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} aria-hidden="true" />;
            }

            const dateKey = formatDateKey(date);
            const todayDateKey = formatDateKey(today);
            const isToday = dateKey === todayDateKey;
            const unavailable = date <= today;
            const booked = !unavailable && fullyBookedDateSet.has(dateKey);
            const otherTourAvailable =
              !unavailable &&
              booked &&
              alternativeAvailableDateSet.has(dateKey);
            const partiallyBooked =
              !unavailable && !booked && partiallyBookedDateSet.has(dateKey);
            const disabled = unavailable || (booked && !otherTourAvailable);
            const selected = dateKey === selectedDateValue;
            const statusLabel = unavailable
              ? labels.unavailable
              : otherTourAvailable
                ? labels.otherTourAvailable
                : booked
                  ? labels.booked
                  : partiallyBooked
                    ? labels.partiallyBooked
                    : labels.available;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => handleSelect(date)}
                disabled={isLoading || disabled}
                className={[
                  "flex min-h-16 flex-col items-start justify-start border-b-4 p-2 text-left transition",
                  selected
                    ? "border-stone-950 bg-stone-950 text-[#f3eee7]"
                    : otherTourAvailable
                      ? "border-x-amber-200 border-t-amber-200 border-b-amber-500 bg-amber-50/80 text-stone-950 shadow-sm"
                      : booked
                        ? "cursor-not-allowed border-x-red-200 border-t-red-200 border-b-red-700 bg-red-50/70 text-stone-400 opacity-70 shadow-none"
                        : unavailable
                          ? "cursor-not-allowed border-x-stone-200 border-t-stone-200 border-b-stone-400 bg-stone-100 text-stone-400 opacity-60 shadow-none"
                          : partiallyBooked
                            ? "border-x-orange-200 border-t-orange-200 border-b-orange-500 bg-orange-50/80 text-stone-950 shadow-sm"
                            : "border-x-stone-300 border-t-stone-300 border-b-emerald-600 bg-[#fbf8f3] text-stone-950 shadow-sm",
                  isToday ? "ring-2 ring-stone-950 ring-offset-2" : "",
                  isLoading ? "cursor-wait opacity-60 shadow-none" : "",
                ].join(" ")}
                aria-label={`${dateKey} ${statusLabel}${
                  isToday ? ` ${labels.today}` : ""
                }`}
              >
                <span className="block text-sm">{date.getDate()}</span>
                {isToday ? (
                  <span className="mt-2 hidden px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] sm:inline-block">
                    {labels.today}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-sm leading-6 text-red-900">
          {labels.required}
        </p>
      ) : null}
    </div>
  );
}
