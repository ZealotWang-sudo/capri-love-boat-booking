import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TOUR_PRICE_SELECT, isTourPricesTableMissing } from "@/lib/tourPrices";
import AdminHeader from "../AdminHeader";
import AdminNotice from "../AdminNotice";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";
import TourPriceForm from "./TourPriceForm";

function getNoticeText(searchParams, key) {
  const value = searchParams?.[key];

  return typeof value === "string" ? value : "";
}

export default async function AdminPricingPage({ searchParams }) {
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
  const resolvedSearchParams = await searchParams;
  const successNotice = getNoticeText(resolvedSearchParams, "updated")
    ? "Price updated successfully."
    : "";
  const errorNotice = getNoticeText(resolvedSearchParams, "error");

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminHeader active="pricing" title="Pricing" userEmail={user.email} />

        <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 text-sm leading-7 text-stone-600 sm:p-6">
          Manual prices are used for new booking requests only. Existing bookings
          keep their saved price snapshot.
        </section>

        {successNotice ? <AdminNotice>{successNotice}</AdminNotice> : null}
        {errorNotice ? (
          <AdminNotice tone="error">{errorNotice}</AdminNotice>
        ) : null}

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm leading-7 text-red-900">
            {isTourPricesTableMissing(error)
              ? "Could not load tour prices. Run supabase/tour-prices.sql in Supabase first."
              : `Could not load tour prices: ${error.message}`}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5">
          {(tourPrices ?? []).map((tourPrice) => (
            <TourPriceForm key={tourPrice.id} tourPrice={tourPrice} />
          ))}
        </div>
      </section>
    </main>
  );
}
