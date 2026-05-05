"use client";

import { useRouter } from "next/navigation";

export default function BookingForm({ locale, labels }) {
  const router = useRouter();

  function handleSubmit(event) {
    event.preventDefault();
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
            {labels.date}
          </label>
          <input
            name="date"
            type="date"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
            {labels.guests}
          </label>
          <input
            name="guests"
            type="number"
            min="1"
            required
            className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-[0.18em] text-stone-500">
          {labels.tourType}
        </label>
        <select
          name="tourType"
          required
          className="mt-3 w-full border border-stone-300 bg-transparent px-4 py-4 outline-none transition focus:border-stone-950"
          defaultValue=""
        >
          <option value="" disabled>
            {labels.tourPlaceholder}
          </option>
          {labels.tourOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

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
