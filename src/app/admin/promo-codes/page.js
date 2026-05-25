import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROMO_CODE_SELECT } from "@/lib/promoCodes";
import AdminHeader from "../AdminHeader";
import AdminNotice from "../AdminNotice";
import AdminSubmitButton from "../AdminSubmitButton";
import { getAdminUser, isAllowedAdmin } from "../auth";
import UnauthorizedAdmin from "../UnauthorizedAdmin";
import { createPromoCode, deletePromoCode, updatePromoCodeStatus } from "./actions";

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(new Date(value));
}

function formatEuro(value) {
  return typeof value === "number" ? `€${value}` : "-";
}

function getNoticeText(searchParams, key) {
  const value = searchParams?.[key];

  return typeof value === "string" ? value : "";
}

function PromoCodeStatusForm({ promoCode }) {
  const nextIsActive = !promoCode.is_active;

  return (
    <form action={updatePromoCodeStatus}>
      <input type="hidden" name="id" value={promoCode.id} />
      <input type="hidden" name="is_active" value={String(nextIsActive)} />
      <AdminSubmitButton
        pendingLabel={promoCode.is_active ? "Deactivating..." : "Activating..."}
        className="border border-stone-300 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-stone-700 transition hover:border-stone-950 hover:bg-stone-950 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        {promoCode.is_active ? "Deactivate" : "Activate"}
      </AdminSubmitButton>
    </form>
  );
}

function PromoCodeDeleteForm({ promoCode }) {
  return (
    <form action={deletePromoCode}>
      <input type="hidden" name="id" value={promoCode.id} />
      <AdminSubmitButton
        pendingLabel="Deleting..."
        className="border border-red-900/30 px-3 py-2 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-red-900 transition hover:border-red-900 hover:bg-red-900 hover:text-[#f3eee7] disabled:cursor-wait disabled:opacity-60"
      >
        Delete
      </AdminSubmitButton>
    </form>
  );
}

function PromoCodeCard({ promoCode }) {
  return (
    <article className="border border-stone-300 bg-[#fbf8f3] p-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-light tracking-[-0.03em]">
              {promoCode.code}
            </h2>
            <span
              className={`border px-2 py-1 text-[0.6rem] uppercase tracking-[0.14em] ${
                promoCode.is_active
                  ? "border-emerald-700/30 text-emerald-800"
                  : "border-stone-300 text-stone-500"
              }`}
            >
              {promoCode.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <p className="mt-2 text-sm text-stone-600">
            Discount: {formatEuro(promoCode.discount_eur)}
          </p>
          {promoCode.notes ? (
            <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-stone-600">
              {promoCode.notes}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-stone-500">
            Created {formatDateTime(promoCode.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          <PromoCodeStatusForm promoCode={promoCode} />
          <PromoCodeDeleteForm promoCode={promoCode} />
        </div>
      </div>
    </article>
  );
}

export default async function AdminPromoCodesPage({ searchParams }) {
  const user = await getAdminUser("/admin/promo-codes");

  if (!isAllowedAdmin(user)) {
    return <UnauthorizedAdmin />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: promoCodes, error } = await supabase
    .from("promo_codes")
    .select(PROMO_CODE_SELECT)
    .order("created_at", { ascending: false });
  const resolvedSearchParams = await searchParams;
  const createdNotice = getNoticeText(resolvedSearchParams, "created")
    ? "Promo code created successfully."
    : "";
  const deletedNotice = getNoticeText(resolvedSearchParams, "deleted")
    ? "Promo code deleted."
    : "";
  const updatedNotice = getNoticeText(resolvedSearchParams, "updated");
  const successNotice =
    createdNotice ||
    deletedNotice ||
    (updatedNotice === "active"
      ? "Promo code activated."
      : updatedNotice === "inactive"
        ? "Promo code deactivated."
        : "");
  const errorNotice = getNoticeText(resolvedSearchParams, "error");

  return (
    <main className="min-h-screen bg-[#f3eee7] px-5 py-10 text-stone-950 sm:px-8">
      <section className="mx-auto max-w-7xl">
        <AdminHeader active="promo-codes" title="Promo Codes" userEmail={user.email} />

        {successNotice ? <AdminNotice>{successNotice}</AdminNotice> : null}
        {errorNotice ? (
          <AdminNotice tone="error">{errorNotice}</AdminNotice>
        ) : null}

        <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 text-sm leading-7 text-stone-600 sm:p-6">
          Promo codes reduce only the reservation fee due now. The captain&apos;s
          pay-on-board amount is never discounted, and the final reservation fee
          cannot go below €10.
        </section>

        <section className="mt-8 border border-stone-300 bg-[#fbf8f3] p-5 sm:p-6">
          <h2 className="text-2xl font-light tracking-[-0.03em]">
            Create promo code
          </h2>
          <form action={createPromoCode} className="mt-5 grid gap-4 lg:grid-cols-4">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Code
              </span>
              <input
                name="code"
                required
                placeholder="CAPRI20"
                className="mt-2 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm uppercase outline-none transition focus:border-stone-950"
              />
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Discount (€)
              </span>
              <input
                name="discount_eur"
                type="number"
                min="1"
                step="1"
                required
                className="mt-2 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>
            <label className="block lg:col-span-2">
              <span className="text-xs uppercase tracking-[0.18em] text-stone-500">
                Notes
              </span>
              <input
                name="notes"
                className="mt-2 w-full border border-stone-300 bg-transparent px-4 py-3 text-sm outline-none transition focus:border-stone-950"
              />
            </label>
            <label className="flex items-center gap-3 text-sm text-stone-700">
              <input
                type="checkbox"
                name="is_active"
                value="true"
                defaultChecked
                className="h-4 w-4 accent-stone-950"
              />
              Active
            </label>
            <AdminSubmitButton
              pendingLabel="Creating..."
              className="border border-stone-950 bg-stone-950 px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[#f3eee7] transition hover:bg-transparent hover:text-stone-950 disabled:cursor-wait disabled:opacity-60 lg:col-start-4"
            >
              Create promo
            </AdminSubmitButton>
          </form>
        </section>

        {error ? (
          <div className="mt-8 border border-red-900/30 bg-red-50 p-5 text-sm leading-7 text-red-900">
            Could not load promo codes. Run supabase/promo-codes.sql in Supabase
            first. {error.message}
          </div>
        ) : null}

        <div className="mt-8 grid gap-5">
          {(promoCodes ?? []).map((promoCode) => (
            <PromoCodeCard key={promoCode.id} promoCode={promoCode} />
          ))}
          {!error && (promoCodes ?? []).length === 0 ? (
            <div className="border border-stone-300 bg-[#fbf8f3] p-8 text-center text-sm text-stone-500">
              No promo codes yet.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
