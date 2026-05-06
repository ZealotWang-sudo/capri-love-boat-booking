"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import StyledCheckbox from "@/components/StyledCheckbox";

export default function BookingForm({ locale, labels }) {
  const router = useRouter();
  const [dateError, setDateError] = useState(false);
  const [tourInfoOpen, setTourInfoOpen] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    if (!formData.get("date")) {
      setDateError(true);
      return;
    }

    router.push(`/${locale}/thank-you`);
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.name}
          </label>
          <input
            name="name"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.contact}
          </label>
          <input
            name="contact"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.guests}
          </label>
          <input
            name="guests"
            type="number"
            min="1"
            max="4"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.tourType}
        </label>
        <div className="mt-3 flex items-center justify-between gap-4">
          <p className="text-sm leading-6 text-stone-600">
            {labels.tourPlaceholder}
          </p>
          <button
            type="button"
            onClick={() => setTourInfoOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-stone-300 text-xs uppercase text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
            aria-label={labels.tourInfoButton}
            aria-expanded={tourInfoOpen}
            aria-haspopup="dialog"
          >
           ?
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {labels.tourOptions.map((option) => (
            <StyledCheckbox
              key={option.value}
              type="radio"
              name="tourType"
              value={option.value}
              label={option.label}
              required
            />
          ))}
        </div>
        {tourInfoOpen ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-5 py-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-info-title"
          >
            <div className="w-full max-w-lg border border-stone-950 bg-[#fbf8f3] p-6 shadow-xl sm:p-8">
              <div className="flex items-start justify-between gap-4 border-b border-stone-300 pb-5">
                <h2
                  id="tour-info-title"
                  className="text-2xl font-light tracking-[-0.03em]"
                >
                  {labels.tourInfoTitle}
                </h2>
                <button
                  type="button"
                  onClick={() => setTourInfoOpen(false)}
                  className="border border-stone-300 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-600 transition hover:border-stone-950 hover:text-stone-950"
                >
                  {labels.tourInfoClose}
                </button>
              </div>
              <div className="mt-6 space-y-5">
                {labels.tourOptions.map((option) => (
                  <article
                    key={option.value}
                    className="border-l border-stone-950 pl-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="text-lg font-normal">{option.label}</h3>
                      <p className="shrink-0 text-xs uppercase tracking-[0.18em] text-stone-500">
                        {option.price}
                      </p>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-600">
                      {option.info}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <AvailabilityCalendar
        label={labels.date}
        labels={labels.calendar}
        error={dateError}
        onSelect={() => setDateError(false)}
      />

      <div>
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.message}
        </label>
        <textarea
          name="message"
          className="mt-3 min-h-32 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
        />
      </div>

      <button
        type="submit"
        className="w-full border border-stone-950 bg-stone-950 px-6 py-4 text-xs font-medium uppercase tracking-[0.22em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
      >
        {labels.submit}
      </button>
    </form>
  );
}
