import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  TOUR_PRICE_SELECT,
  formatEuro,
  isTourPricesTableMissing,
} from "@/lib/tourPrices";
import AdminHeader from "../AdminHeader";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";
import { updateTourPrice } from "./actions";

function PriceInput({ defaultValue, label, name, required = true }) {
  return (
    <label className="block">
      <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <input
        className="mt-2 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-stone-950"
        defaultValue={defaultValue ?? ""}
        min={0}
        name={name}
        required={required}
        type="number"
      />
    </label>
  );
}

function TourPriceCard({ tourPrice }) {
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
          <p className="mt-1 text-sm text-stone-600">
            Current total: {formatEuro(tourPrice.total_price_eur)}
          </p>
        </div>
        <label className="flex items-center gap-3 text-xs font-medium uppercase tracking-[0.16em] text-stone-700">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={tourPrice.is_active}
            className="h-4 w-4 accent-stone-950"
          />
          Active
        </label>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PriceInput
          defaultValue={tourPrice.total_price_eur}
          label="Total"
          name="total_price_eur"
        />
        <PriceInput
          defaultValue={tourPrice.reservation_fee_eur}
          label="Reservation fee"
          name="reservation_fee_eur"
        />
        <PriceInput
          defaultValue={tourPrice.pay_on_board_eur}
          label="Pay on board"
          name="pay_on_board_eur"
        />
        <PriceInput
          defaultValue={tourPrice.captain_price_eur}
          label="Captain price"
          name="captain_price_eur"
          required={false}
        />
      </div>

      <label className="mt-5 block">
        <span className="text-[0.65rem] uppercase tracking-[0.16em] text-stone-500">
          Notes
        </span>
        <textarea
          className="mt-2 min-h-24 w-full border border-stone-300 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-stone-950"
          defaultValue={tourPrice.notes ?? ""}
          name="notes"
        />
      </label>

      <div className="mt-5 flex justify-end">
        <button
          type="submit"
          className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950"
        >
          Save price
        </button>
      </div>
    </form>
  );
}

export default async function AdminPricingPage() {
  const user = await getAdminUser("/admin/pricing");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: tourPrices, error } = await supabase
    .from("tour_prices")
    .select(TOUR_PRICE_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminHeader active="pricing" title="Pricing" userEmail={user.email} />

        <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 text-sm leading-7 text-stone-600 sm:p-6">
          Manual prices are used for new booking requests only. Existing bookings
          keep their saved price snapshot.
        </section>

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm leading-7 text-red-900">
            {isTourPricesTableMissing(error)
              ? "Could not load tour prices. Run supabase/tour-prices.sql in Supabase first."
              : `Could not load tour prices: ${error.message}`}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5">
          {(tourPrices ?? []).map((tourPrice) => (
            <TourPriceCard key={tourPrice.id} tourPrice={tourPrice} />
          ))}
        </div>
      </section>
    </main>
  );
}
