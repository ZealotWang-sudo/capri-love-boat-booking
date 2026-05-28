"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

function addMonths(month, offset) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

export default function AdminCalendarMonthNavigation({ month }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function navigateToMonth(offset) {
    const nextMonth = addMonths(month, offset);

    startTransition(() => {
      router.push(`/admin/calendar?month=${nextMonth}`);
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => navigateToMonth(-1)}
        disabled={isPending}
        aria-busy={isPending}
        className="border border-stone-300 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        Previous
      </button>
      <button
        type="button"
        onClick={() => navigateToMonth(1)}
        disabled={isPending}
        aria-busy={isPending}
        className="border border-stone-300 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        Next
      </button>
      {isPending ? (
        <span className="inline-flex items-center gap-2 border border-stone-300 px-3 py-2 text-[0.65rem] uppercase tracking-[0.16em] text-stone-600">
          <span
            aria-hidden="true"
            className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
          />
          Loading month...
        </span>
      ) : null}
    </div>
  );
}
