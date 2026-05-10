"use client";

import { useMemo, useState } from "react";
import { formatEuro } from "@/lib/tourPrices";
import { updateTourPrice } from "./actions";

function parseInteger(value) {
  if (value.trim() === "") {
    return null;
  }

  const number = Number(value);

  return Number.isInteger(number) ? number : null;
}

function PriceInput({ label, min, name, onChange, value }) {
  return (
    <label className="block">
      <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <input
        className="mt-2 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-stone-950"
        min={min}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required
        step="1"
        type="number"
        value={value}
      />
    </label>
  );
}

export default function TourPriceForm({ tourPrice }) {
  const initialReservationFee = String(tourPrice.reservation_fee_eur ?? "");
  const initialCaptainPrice = String(
    tourPrice.captain_price_eur ?? tourPrice.pay_on_board_eur ?? "",
  );
  const initialIsActive = Boolean(tourPrice.is_active);
  const initialNotes = tourPrice.notes ?? "";
  const [reservationFee, setReservationFee] = useState(initialReservationFee);
  const [captainPrice, setCaptainPrice] = useState(initialCaptainPrice);
  const [isActive, setIsActive] = useState(initialIsActive);
  const [notes, setNotes] = useState(initialNotes);

  const pricing = useMemo(() => {
    const reservationFeeEur = parseInteger(reservationFee);
    const captainPriceEur = parseInteger(captainPrice);
    const isValid =
      reservationFeeEur !== null &&
      captainPriceEur !== null &&
      reservationFeeEur > 0 &&
      captainPriceEur >= 0;

    return {
      captainPriceEur,
      isValid,
      reservationFeeEur,
      totalPriceEur: isValid ? reservationFeeEur + captainPriceEur : null,
    };
  }, [captainPrice, reservationFee]);

  const hasChanges =
    reservationFee !== initialReservationFee ||
    captainPrice !== initialCaptainPrice ||
    isActive !== initialIsActive ||
    notes !== initialNotes;

  return (
    <form
      action={updateTourPrice}
      className="border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6"
    >
      <input type="hidden" name="id" value={tourPrice.id} />
      <div className="flex flex-col justify-between gap-4 border-b border-stone-300 pb-5 sm:flex-row">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-500">
            {tourPrice.tour_type}
          </p>
          <h2 className="mt-3 text-3xl font-light tracking-[-0.03em]">
            {tourPrice.display_name_en}
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {tourPrice.display_name_zh} · {tourPrice.display_name_it} ·{" "}
            {tourPrice.duration_hours ?? "-"} hours
          </p>
        </div>
        <label className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-700">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4 accent-stone-950"
          />
          Active
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="border border-stone-300 bg-[#f3eee7]/50 px-3 py-2">
          <p className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
            Total
          </p>
          <p className="mt-2 text-xl font-light">
            {formatEuro(pricing.totalPriceEur)}
          </p>
        </div>
        <PriceInput
          label="Reservation fee"
          min={1}
          name="reservation_fee_eur"
          onChange={setReservationFee}
          value={reservationFee}
        />
        <PriceInput
          label="Captain / pay on board"
          min={0}
          name="captain_price_eur"
          onChange={setCaptainPrice}
          value={captainPrice}
        />
      </div>

      <label className="mt-5 block">
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
          Notes
        </span>
        <textarea
          className="mt-2 min-h-24 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-stone-950"
          name="notes"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
      </label>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          disabled={!hasChanges || !pricing.isValid}
          className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-stone-950 disabled:hover:text-[#f3eee7]"
        >
          Save price
        </button>
      </div>
    </form>
  );
}
