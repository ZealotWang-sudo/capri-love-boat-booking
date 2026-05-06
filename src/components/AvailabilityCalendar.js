"use client";

import { useMemo, useState } from "react";

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

function isBooked(date) {
  const day = date.getDate();

  return date.getDay() === 0 || day % 9 === 0;
}

function isCaptainUnavailable(date) {
  return date.getDate() % 14 === 0;
}

export default function AvailabilityCalendar({
  name = "date",
  label,
  labels,
  error,
  onSelect,
}) {
  const today = useMemo(() => {
    const now = new Date();

    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const [displayDate, setDisplayDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState("");
  const monthDays = getMonthDays(displayDate);
  const monthLabel = new Intl.DateTimeFormat(labels.locale, {
    month: "long",
    year: "numeric",
  }).format(displayDate);

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
    const dateKey = formatDateKey(date);

    setSelectedDate(dateKey);
    onSelect?.(dateKey);
  }

  return (
    <div>
      <input type="hidden" name={name} value={selectedDate} required readOnly />
      <div className="flex items-end justify-between gap-4">
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {label}
        </label>
        <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
          {selectedDate || labels.selectDate}
        </p>
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
            const unavailable = date < today || isCaptainUnavailable(date);
            const booked = !unavailable && isBooked(date);
            const disabled = booked || unavailable;
            const selected = dateKey === selectedDate;
            const statusLabel = unavailable
              ? labels.unavailable
              : booked
                ? labels.booked
                : labels.available;

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => handleSelect(date)}
                disabled={disabled}
                className={[
                  "min-h-16 border-l-4 p-2 text-left transition",
                  selected
                    ? "border-stone-950 bg-stone-950 text-[#f3eee7]"
                    : "border-y-stone-300 border-r-stone-300 border-l-emerald-600 bg-[#fbf8f3] text-stone-950 shadow-sm hover:border-stone-950",
                  booked
                    ? "cursor-not-allowed border-y-red-200 border-r-red-200 border-l-red-700 bg-red-50/70 text-stone-400 opacity-70 shadow-none hover:border-y-red-200 hover:border-r-red-200 hover:border-l-red-700"
                    : "",
                  unavailable
                    ? "cursor-not-allowed border-y-stone-200 border-r-stone-200 border-l-stone-400 bg-stone-100 text-stone-400 opacity-60 shadow-none hover:border-y-stone-200 hover:border-r-stone-200 hover:border-l-stone-400"
                    : "",
                ].join(" ")}
                aria-label={`${dateKey} ${statusLabel}`}
              >
                <span className="block text-sm">{date.getDate()}</span>
              </button>
            );
          })}
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
